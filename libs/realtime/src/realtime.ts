import { effect, inject, Injectable, InjectionToken, signal, type Signal } from '@angular/core';
import { Client, type IMessage, type StompConfig, type StompSubscription } from '@stomp/stompjs';
import { Observable, Subject, filter } from 'rxjs';

export type RealtimeConnectionState =
  'idle' | 'connecting' | 'connected' | 'disconnected' | 'disabled' | 'error';

export type SpaceElementState =
  'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'OUT_OF_SERVICE';

export interface SpaceElementStatePayload {
  readonly spaceElementId: string;
  readonly previousState?: SpaceElementState;
  readonly state: SpaceElementState;
}

export interface RealtimeEventEnvelope {
  readonly eventId: string;
  readonly eventType: 'space-element.state.changed.v1';
  readonly schemaVersion: 1;
  readonly occurredAt: string;
  readonly establishmentId: string;
  readonly sectorId?: string;
  readonly aggregateVersion: number;
  readonly payload: SpaceElementStatePayload;
}

export interface RealtimeConfig {
  /** Lee el valor runtime en cada intento de conexión. */
  readonly brokerUrl: () => string;
  /** Lee el JWT actual; solo se envía en STOMP CONNECT. */
  readonly accessToken: () => string | null;
  /** Kill switch. En false, el cliente desconecta y no reintenta. */
  readonly enabled: () => boolean;
  readonly reconnectInitialDelayMs?: number;
  readonly reconnectMaxDelayMs?: number;
}

export const REALTIME_CONFIG = new InjectionToken<RealtimeConfig>('mapit.realtime.config', {
  providedIn: 'root',
  factory: () => ({
    brokerUrl: () => '',
    accessToken: () => null,
    enabled: () => false,
  }),
});

export type StompClientLike = Pick<
  Client,
  | 'active'
  | 'reconnectDelay'
  | 'connectHeaders'
  | 'beforeConnect'
  | 'onConnect'
  | 'onStompError'
  | 'onWebSocketClose'
  | 'onWebSocketError'
  | 'activate'
  | 'deactivate'
  | 'subscribe'
>;

export type StompClientFactory = (config: StompConfig) => StompClientLike;

export const REALTIME_STOMP_CLIENT_FACTORY = new InjectionToken<StompClientFactory>(
  'mapit.realtime.stomp-client-factory',
  { providedIn: 'root', factory: () => (config) => new Client(config) },
);

export function provideRealtime(configFactory: () => RealtimeConfig): {
  provide: typeof REALTIME_CONFIG;
  useFactory: () => RealtimeConfig;
} {
  return { provide: REALTIME_CONFIG, useFactory: configFactory };
}

interface TopicState {
  readonly references: Set<symbol>;
  subscription: StompSubscription | undefined;
}

const TOPIC_PREFIX = '/topic/establishments/';

/**
 * Cliente STOMP agnóstico de la aplicación.
 *
 * <p>No importa autenticación ni feature flags concretos: la app entrega funciones para leer el
 * token y el kill switch. Así el mismo adaptador sirve para consola, tests y futuras superficies.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeClient {
  private readonly config = inject(REALTIME_CONFIG);
  private readonly factory = inject(REALTIME_STOMP_CLIENT_FACTORY);
  private readonly estado = signal<RealtimeConnectionState>('idle');
  private readonly errores = new Subject<unknown>();
  private readonly eventos = new Subject<RealtimeEventEnvelope>();
  private readonly topics = new Map<string, TopicState>();
  private client: StompClientLike | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private retryAttempt = 0;
  private requested = false;
  private stopping = false;

  readonly connectionState: Signal<RealtimeConnectionState> = this.estado.asReadonly();
  readonly errors = this.errores.asObservable();
  readonly events = this.eventos.asObservable();

  constructor() {
    effect(() => {
      if (!this.config.enabled()) {
        void this.stopForKillSwitch();
      } else if (this.requested && this.estado() === 'disabled') {
        this.startTransport();
      }
    });
  }

  /** Solicita una conexión. Sin flag o JWT no abre el socket. */
  connect(): void {
    this.requested = true;
    if (!this.config.enabled()) {
      this.estado.set('disabled');
      return;
    }
    this.startTransport();
  }

  /** Cierra el socket y, por defecto, olvida las salas solicitadas. */
  async disconnect(clearSubscriptions = true): Promise<void> {
    this.requested = false;
    this.stopping = true;
    this.clearRetryTimer();
    if (clearSubscriptions) this.clearTopics();
    await this.deactivateClient();
    this.client = null;
    this.stopping = false;
    this.estado.set('idle');
  }

  /** Se suscribe a todos los eventos de un establecimiento. */
  subscribeEstablishment(establishmentId: string): Observable<RealtimeEventEnvelope> {
    return this.subscribeTopic(
      `${TOPIC_PREFIX}${encodeURIComponent(establishmentId)}`,
      (event) => event.establishmentId === establishmentId,
    );
  }

  /** Se suscribe a los eventos del sector dentro de un establecimiento. */
  subscribeSector(establishmentId: string, sectorId: string): Observable<RealtimeEventEnvelope> {
    return this.subscribeTopic(
      `${TOPIC_PREFIX}${encodeURIComponent(establishmentId)}/sectors/${encodeURIComponent(sectorId)}`,
      (event) => event.establishmentId === establishmentId && event.sectorId === sectorId,
    );
  }

  private startTransport(): void {
    if (this.client?.active || this.estado() === 'connecting') return;
    const brokerUrl = this.config.brokerUrl();
    const token = this.config.accessToken();
    if (!brokerUrl || !token) {
      this.estado.set('disconnected');
      return;
    }

    this.stopping = false;
    this.clearRetryTimer();
    this.estado.set('connecting');
    const client = this.factory({
      brokerURL: brokerUrl,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 0,
    });
    this.client = client;
    client.reconnectDelay = 0;
    client.beforeConnect = () => {
      if (!this.config.enabled()) throw new Error('realtime.websocket está desactivado');
      const currentToken = this.config.accessToken();
      if (!currentToken) throw new Error('No hay JWT para abrir WebSocket');
      client.connectHeaders = { Authorization: `Bearer ${currentToken}` };
    };
    client.onConnect = () => {
      this.retryAttempt = 0;
      this.estado.set('connected');
      for (const topic of this.topics.keys()) this.ensureTopicSubscription(topic);
    };
    client.onStompError = (frame) => {
      this.errores.next(frame);
      this.estado.set('error');
    };
    client.onWebSocketError = (error) => {
      this.errores.next(error);
      this.estado.set('error');
    };
    client.onWebSocketClose = () => {
      this.disposeTopicSubscriptions();
      if (this.stopping) return;
      if (!this.config.enabled()) {
        this.estado.set('disabled');
        return;
      }
      this.estado.set('disconnected');
      this.scheduleReconnect();
    };
    client.activate();
  }

  private scheduleReconnect(): void {
    if (!this.requested || this.stopping || !this.config.enabled() || this.retryTimer) return;
    const initial = this.config.reconnectInitialDelayMs ?? 250;
    const maximum = this.config.reconnectMaxDelayMs ?? 30_000;
    const delay = Math.min(initial * 2 ** this.retryAttempt, maximum);
    this.retryAttempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      if (this.requested) this.startTransport();
    }, delay);
  }

  private subscribeTopic(
    topic: string,
    matches: (event: RealtimeEventEnvelope) => boolean,
  ): Observable<RealtimeEventEnvelope> {
    return new Observable<RealtimeEventEnvelope>((subscriber) => {
      const reference = Symbol(topic);
      const state: TopicState = this.topics.get(topic) ?? {
        references: new Set<symbol>(),
        subscription: undefined,
      };
      state.references.add(reference);
      this.topics.set(topic, state);
      this.ensureTopicSubscription(topic);
      const events = this.eventos.pipe(filter(matches)).subscribe(subscriber);
      return () => {
        events.unsubscribe();
        const current = this.topics.get(topic);
        if (!current) return;
        current.references.delete(reference);
        if (current.references.size === 0) {
          current.subscription?.unsubscribe();
          this.topics.delete(topic);
        }
      };
    });
  }

  private ensureTopicSubscription(topic: string): void {
    const client = this.client;
    const state = this.topics.get(topic);
    if (!client || !state || state.subscription || this.estado() !== 'connected') return;
    state.subscription = client.subscribe(topic, (message) => this.acceptMessage(message));
  }

  private acceptMessage(message: IMessage): void {
    try {
      const parsed: unknown = JSON.parse(message.body);
      if (isRealtimeEventEnvelope(parsed)) this.eventos.next(parsed);
      else this.errores.next(new Error('Envelope STOMP inválido'));
    } catch (error) {
      this.errores.next(error);
    }
  }

  private disposeTopicSubscriptions(): void {
    for (const state of this.topics.values()) {
      state.subscription?.unsubscribe();
      state.subscription = undefined;
    }
  }

  private clearTopics(): void {
    this.disposeTopicSubscriptions();
    this.topics.clear();
  }

  private async stopForKillSwitch(): Promise<void> {
    if (!this.client && this.estado() === 'disabled') return;
    this.stopping = true;
    this.clearRetryTimer();
    this.disposeTopicSubscriptions();
    await this.deactivateClient();
    this.client = null;
    this.stopping = false;
    this.estado.set('disabled');
  }

  private async deactivateClient(): Promise<void> {
    if (!this.client?.active) return;
    try {
      await this.client.deactivate();
    } catch (error) {
      this.errores.next(error);
    }
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  }
}

function isRealtimeEventEnvelope(value: unknown): value is RealtimeEventEnvelope {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<RealtimeEventEnvelope>;
  const payload = event.payload;
  return (
    typeof event.eventId === 'string' &&
    event.eventType === 'space-element.state.changed.v1' &&
    event.schemaVersion === 1 &&
    typeof event.occurredAt === 'string' &&
    typeof event.establishmentId === 'string' &&
    typeof event.aggregateVersion === 'number' &&
    Number.isInteger(event.aggregateVersion) &&
    event.aggregateVersion > 0 &&
    !!payload &&
    typeof payload === 'object' &&
    typeof payload.spaceElementId === 'string' &&
    isState(payload.state) &&
    (payload.previousState === undefined || isState(payload.previousState))
  );
}

function isState(value: unknown): value is SpaceElementState {
  return (
    value === 'AVAILABLE' ||
    value === 'OCCUPIED' ||
    value === 'RESERVED' ||
    value === 'CLEANING' ||
    value === 'OUT_OF_SERVICE'
  );
}
