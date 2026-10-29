import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REALTIME_CONFIG,
  REALTIME_STOMP_CLIENT_FACTORY,
  RealtimeClient,
  type RealtimeConfig,
  type RealtimeEventEnvelope,
  type StompClientFactory,
  type StompClientLike,
} from './realtime';
import type { IMessage, StompHeaders, StompSubscription } from '@stomp/stompjs';

class FakeStompClient implements StompClientLike {
  active = false;
  reconnectDelay = 0;
  connectHeaders: Record<string, string> = {};
  beforeConnect: StompClientLike['beforeConnect'] = () => {};
  onConnect: StompClientLike['onConnect'] = () => {};
  onStompError: StompClientLike['onStompError'] = () => {};
  onWebSocketClose: StompClientLike['onWebSocketClose'] = () => {};
  onWebSocketError: StompClientLike['onWebSocketError'] = () => {};
  readonly subscriptions = new Map<string, (message: IMessage) => void>();

  activate(): void {
    this.active = true;
    void this.beforeConnect({} as never);
    this.onConnect({} as never);
  }

  deactivate(): Promise<void> {
    this.active = false;
    return Promise.resolve();
  }

  subscribe(
    destination: string,
    callback: (message: IMessage) => void,
    _headers?: StompHeaders,
  ): StompSubscription {
    this.subscriptions.set(destination, callback);
    return {
      id: destination,
      unsubscribe: () => {
        this.subscriptions.delete(destination);
      },
    };
  }

  emit(destination: string, body: string): void {
    this.subscriptions.get(destination)?.({ body } as IMessage);
  }

  close(): void {
    this.active = false;
    this.onWebSocketClose({});
  }
}

const event = {
  eventId: 'event-1',
  eventType: 'space-element.state.changed.v1' as const,
  schemaVersion: 1 as const,
  occurredAt: '2026-09-17T18:00:00Z',
  establishmentId: 'est-1',
  sectorId: 'sector-1',
  aggregateVersion: 1,
  payload: { spaceElementId: 'element-1', state: 'OCCUPIED' as const },
};

describe('RealtimeClient', () => {
  let enabled: ReturnType<typeof vi.fn<() => boolean>>;
  let clients: FakeStompClient[];
  let factory: StompClientFactory;

  beforeEach(() => {
    enabled = vi.fn(() => true);
    clients = [];
    factory = vi.fn(() => {
      const client = new FakeStompClient();
      clients.push(client);
      return client;
    });
    const config: RealtimeConfig = {
      brokerUrl: () => 'ws://localhost:8080/ws',
      accessToken: () => 'jwt-1',
      enabled,
      reconnectInitialDelayMs: 10,
      reconnectMaxDelayMs: 100,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: REALTIME_CONFIG, useValue: config },
        { provide: REALTIME_STOMP_CLIENT_FACTORY, useValue: factory },
      ],
    });
  });

  afterEach(async () => {
    const client = TestBed.inject(RealtimeClient);
    await client.disconnect();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('respeta el kill switch y no abre el socket cuando está apagado', () => {
    enabled.mockReturnValue(false);
    const client = TestBed.inject(RealtimeClient);

    client.connect();

    expect(client.connectionState()).toBe('disabled');
    expect(factory).not.toHaveBeenCalled();
  });

  it('envía el JWT en CONNECT, enruta eventos y re-suscribe tras reconectar', async () => {
    vi.useFakeTimers();
    const client = TestBed.inject(RealtimeClient);
    const received = new Subject<RealtimeEventEnvelope>();
    const subscription = client.subscribeSector('est-1', 'sector-1').subscribe(received);

    client.connect();
    expect(client.connectionState()).toBe('connected');
    expect(clients[0]?.connectHeaders).toEqual({ Authorization: 'Bearer jwt-1' });
    expect(clients[0]?.subscriptions.has('/topic/establishments/est-1/sectors/sector-1')).toBe(
      true,
    );

    const result = firstValueFrom(received);
    clients[0]?.emit('/topic/establishments/est-1/sectors/sector-1', JSON.stringify(event));
    await expect(result).resolves.toEqual(event);

    clients[0]?.close();
    vi.advanceTimersByTime(10);
    expect(clients).toHaveLength(2);
    expect(clients[1]?.subscriptions.has('/topic/establishments/est-1/sectors/sector-1')).toBe(
      true,
    );

    subscription.unsubscribe();
    vi.useRealTimers();
  });

  it('rechaza envelopes no versionados sin romper la conexión', () => {
    const errors: unknown[] = [];
    const client = TestBed.inject(RealtimeClient);
    client.errors.subscribe((error) => errors.push(error));
    client.subscribeEstablishment('est-1').subscribe();
    client.connect();

    clients[0]?.emit('/topic/establishments/est-1', JSON.stringify({ eventId: 'bad' }));

    expect(errors).toHaveLength(1);
    expect(client.connectionState()).toBe('connected');
  });

  it('separa pagos de eventos espaciales y comparte la sala sin errores de protocolo', () => {
    const client = TestBed.inject(RealtimeClient);
    const errors = vi.fn();
    const payments = vi.fn();
    const spaces = vi.fn();
    client.errors.subscribe(errors);
    const operational = client.subscribeEstablishment('est-1').subscribe(spaces);
    const payment = client.subscribeEstablishmentPayments('est-1').subscribe(payments);
    client.connect();
    const update = {
      eventId: 'event-1',
      eventType: 'payment.status.changed',
      schemaVersion: 1,
      occurredAt: '2026-10-25T12:00:00Z',
      establishmentId: 'est-1',
      reservationId: 'reservation-1',
      paymentId: 'payment-1',
      status: 'CONFIRMED',
    };
    clients[0]?.emit('/topic/establishments/est-1', JSON.stringify(update));
    expect(payments).toHaveBeenCalledWith(update);
    const cancelled = { ...update, eventId: 'event-cancelled', status: 'CANCELLED' };
    clients[0]?.emit('/topic/establishments/est-1', JSON.stringify(cancelled));
    expect(payments).toHaveBeenCalledWith(cancelled);
    expect(spaces).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    payment.unsubscribe();
    expect(clients[0]?.subscriptions.has('/topic/establishments/est-1')).toBe(true);
    operational.unsubscribe();
    expect(clients[0]?.subscriptions.has('/topic/establishments/est-1')).toBe(false);
  });
});
