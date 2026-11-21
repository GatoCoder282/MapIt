import { Logger } from '@mapit/logging';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
  type Signal,
} from '@angular/core';

import { FEATURE_FLAG_CONFIG } from './feature-flag.config';
import { FLAGS_POR_DEFECTO, type FeatureFlagKey } from './feature-flag.catalog';
import { VERTICAL_FLAGS } from './vertical-flags';
import { validFeatureFlagContext, type FeatureFlagContext } from './feature-flag.context';

const NOTIFICATION_CENTER: FeatureFlagKey = 'mapit.s6.notification-center';

interface RespuestaProxy {
  readonly toggles: readonly { readonly name: string; readonly enabled: boolean }[];
}

/**
 * Feature toggles en el frontend.
 *
 * Habla con el **unleash-proxy**, nunca con el servidor de Unleash directamente:
 * el proxy solo devuelve las flags ya evaluadas para este usuario, sin exponer
 * el catálogo completo ni el token de administración al navegador.
 *
 * Expone Signals, así que la vista reacciona sola cuando una flag cambia
 * —sin recargar la página, que es justo el punto de un feature toggle.
 */
@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  // Se usa `fetch` en vez de HttpClient a propósito: este servicio corre en el
  // arranque, antes de que los interceptores de auth estén configurados, y no
  // debe arrastrar el token de sesión hacia el proxy de flags.
  private readonly config = inject(FEATURE_FLAG_CONFIG);
  private readonly logger = inject(Logger);
  private degraded = false;
  private context: FeatureFlagContext | null = null;
  private contextRevision = 0;
  private requestRevision = 0;
  private contextRequest: AbortController | null = null;
  private readonly notificationCenter = signal(false);

  /** Estado actual. Arranca con los valores por defecto del catálogo. */
  private readonly estado = signal<Readonly<Record<string, boolean>>>({ ...FLAGS_POR_DEFECTO });

  /** True cuando ya se recibió al menos una respuesta del proxy. */
  private readonly sincronizado = signal(false);
  readonly listo = this.sincronizado.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.setContext(null));
    // Sin proxy configurado se conservan los valores del catálogo, sin sondeo.
    if (!this.config.proxyUrl) return;
    void this.refrescar();

    // Sondeo periódico: es así como una flag apagada en la UI de Unleash llega
    // al navegador sin que el usuario recargue. El intervalo es un compromiso
    // entre latencia de propagación y tráfico.
    effect((onCleanup) => {
      const id = setInterval(() => {
        void this.refrescar();
        void this.refreshContext();
      }, this.config.intervaloRefrescoMs);
      onCleanup(() => clearInterval(id));
    });
  }

  /**
   * Estado de una flag como Signal.
   *
   * Uso en plantilla:  `@if (flags.isEnabled('payments.qr')()) { … }`
   *
   * HU-4.01: el computed se CACHEA por clave. Devolver uno nuevo por llamada
   * funciona en la primera evaluación, pero rompe la reactividad zoneless del
   * template cuando el valor llega después del primer render (el enlace
   * vista → computed → estado se pierde entre instancias y la rama del @if
   * no vuelve a evaluarse: la vista de planta quedaba vacía pese a la flag ON).
   */
  private readonly cache = new Map<FeatureFlagKey, Signal<boolean>>();

  isEnabled(flag: FeatureFlagKey): Signal<boolean> {
    let sig = this.cache.get(flag);
    if (!sig) {
      sig = computed(() =>
        flag === NOTIFICATION_CENTER
          ? this.notificationCenter()
          : (this.estado()[flag] ?? FLAGS_POR_DEFECTO[flag] ?? false),
      );
      this.cache.set(flag, sig);
    }
    return sig;
  }

  /**
   * HU-7.01/7.02: si una vertical está habilitada. Lee el Signal de su flag, así que es
   * reactiva dentro de plantillas y `computed`. Las verticales base no llevan flag.
   */
  isVerticalEnabled(type: string): boolean {
    const flag = VERTICAL_FLAGS[type];
    return flag ? this.isEnabled(flag)() : true;
  }

  /** Lectura puntual, para lógica imperativa (guards, interceptores). */
  isEnabledNow(flag: FeatureFlagKey): boolean {
    if (flag === NOTIFICATION_CENTER) return this.notificationCenter();
    return this.estado()[flag] ?? FLAGS_POR_DEFECTO[flag] ?? false;
  }

  /** El shell futuro debe llamar al iniciar/cambiar sesión y con null al salir; no persiste datos. */
  setContext(candidate: FeatureFlagContext | null): void {
    const context = candidate && validFeatureFlagContext(candidate) ? { ...candidate } : null;
    if (
      context?.tenantId === this.context?.tenantId &&
      context?.userId === this.context?.userId &&
      context?.sessionId === this.context?.sessionId
    )
      return;
    this.context = context;
    this.contextRevision++;
    this.contextRequest?.abort();
    this.contextRequest = null;
    this.notificationCenter.set(false);
    if (context) void this.refreshContext();
  }

  private async refreshContext(): Promise<void> {
    const context = this.context;
    if (!context || !this.config.proxyUrl) return;
    const revision = this.contextRevision;
    const request = ++this.requestRevision;
    this.contextRequest?.abort();
    const controller = new AbortController();
    this.contextRequest = controller;
    const current = () =>
      revision === this.contextRevision &&
      request === this.requestRevision &&
      !controller.signal.aborted;
    const timeout = setTimeout(() => {
      if (current()) this.notificationCenter.set(false);
      controller.abort();
    }, 10_000);
    try {
      const url = new URL(this.config.proxyUrl, globalThis.location?.origin ?? 'http://localhost');
      url.searchParams.set('userId', context.userId);
      url.searchParams.set('sessionId', context.sessionId);
      url.searchParams.set('properties[tenantId]', context.tenantId);
      const response = await fetch(url.toString(), {
        headers: { Authorization: this.config.clientKey },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Contextual flag unavailable');
      const body: unknown = await response.json();
      if (
        !body ||
        typeof body !== 'object' ||
        !('toggles' in body) ||
        !Array.isArray(body.toggles)
      ) {
        throw new Error('Invalid flag response');
      }
      const toggles: readonly unknown[] = body.toggles;
      const matches = toggles.filter(
        (toggle): toggle is { name: unknown; enabled?: unknown } =>
          !!toggle &&
          typeof toggle === 'object' &&
          'name' in toggle &&
          toggle.name === NOTIFICATION_CENTER,
      );
      const enabled = matches.length === 1 && matches[0]?.enabled === true;
      if (current()) this.notificationCenter.set(enabled);
    } catch {
      if (current()) this.notificationCenter.set(false);
    } finally {
      clearTimeout(timeout);
      if (this.contextRequest === controller) this.contextRequest = null;
    }
  }

  private async refrescar(): Promise<void> {
    try {
      const respuesta = await fetch(this.config.proxyUrl, {
        headers: { Authorization: this.config.clientKey },
      });
      if (!respuesta.ok) throw new Error(`El proxy respondió ${respuesta.status}`);

      const cuerpo = (await respuesta.json()) as RespuestaProxy;
      const mapa: Record<string, boolean> = { ...FLAGS_POR_DEFECTO };
      for (const toggle of cuerpo.toggles) mapa[toggle.name] = toggle.enabled;
      mapa[NOTIFICATION_CENTER] = false;

      this.estado.set(mapa);
      this.sincronizado.set(true);
      if (this.degraded) this.logger.log('INFO', 'flags.recovered');
      this.degraded = false;
    } catch {
      // FALLA ABIERTO hacia los valores por defecto, deliberadamente.
      // Que el servidor de flags esté caído no puede tumbar la aplicación:
      // sería convertir una herramienta de mitigación de incidentes en la
      // causa de uno. Ver plan §9.
      if (!this.degraded) this.logger.log('WARN', 'flags.degraded');
      this.degraded = true;
    }
  }
}
