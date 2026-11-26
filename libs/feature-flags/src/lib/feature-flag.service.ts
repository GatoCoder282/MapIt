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

import {
  FEATURE_FLAG_CONFIG,
  type FeatureFlagContext as FeatureFlagEvaluationContext,
} from './feature-flag.config';
import { FLAGS_POR_DEFECTO, type FeatureFlagKey } from './feature-flag.catalog';
import { VERTICAL_FLAGS } from './vertical-flags';
import { validFeatureFlagContext, type FeatureFlagContext } from './feature-flag.context';

const NOTIFICATION_CENTER: FeatureFlagKey = 'mapit.s6.notification-center';

interface RespuestaProxy {
  readonly toggles: readonly { readonly name: string; readonly enabled: boolean }[];
}

function esRespuestaProxy(value: unknown): value is RespuestaProxy {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toggles' in value &&
    Array.isArray(value.toggles) &&
    value.toggles.every(
      (toggle: unknown) =>
        typeof toggle === 'object' &&
        toggle !== null &&
        'name' in toggle &&
        typeof toggle.name === 'string' &&
        'enabled' in toggle &&
        typeof toggle.enabled === 'boolean',
    )
  );
}

/**
 * Feature toggles en el frontend.
 *
 * En local habla con el **unleash-proxy**; desplegado, con la **Frontend API** de
 * Unleash (`/api/frontend`, ADR-0013). Ambos tienen el mismo contrato: devuelven solo
 * las flags ya evaluadas para este usuario y se autentican con una clave pública, sin
 * exponer el catálogo completo ni el token de administración al navegador.
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
  private readonly destroyRef = inject(DestroyRef);
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
    // Sondeo periódico: es así como una flag apagada en la UI de Unleash llega
    // al navegador sin que el usuario recargue. El intervalo es un compromiso
    // entre latencia de propagación y tráfico.
    effect((onCleanup) => {
      const context = this.config.context?.();
      const scope = new AbortController();
      let pending = false;
      this.estado.set({ ...FLAGS_POR_DEFECTO });
      this.sincronizado.set(false);
      const refresh = async () => {
        if (pending) return;
        pending = true;
        await this.refrescar(context, scope.signal);
        pending = false;
      };
      void refresh();
      const id = setInterval(() => {
        void refresh();
        void this.refreshContext();
      }, this.config.intervaloRefrescoMs);
      onCleanup(() => {
        clearInterval(id);
        scope.abort();
      });
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

  /** Lectura ligada a identidad: nunca muestra un ON de la sesión anterior mientras llega el efecto. */
  isEnabledForContext(flag: FeatureFlagKey, context: FeatureFlagContext | null): boolean {
    const enabled = this.notificationCenter();
    return (
      flag === NOTIFICATION_CENTER &&
      enabled &&
      context !== null &&
      context.tenantId === this.context?.tenantId &&
      context.userId === this.context?.userId &&
      context.sessionId === this.context?.sessionId
    );
  }

  /** La consola llama al iniciar/cambiar sesión y con null al salir; no persiste datos. */
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

  /** Evaluación aislada por contexto. No hereda caché ni fallback de otras identidades. */
  watchInContext(flag: FeatureFlagKey, properties: Readonly<Record<string, string>>) {
    const enabled = signal(false);
    const ready = signal(!this.config.proxyUrl);
    let disposed = false;
    let sequence = 0;
    let controller: AbortController | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    const settle = (request: number, value: boolean) => {
      if (disposed || request !== sequence) return;
      clearTimeout(timeout);
      enabled.set(value);
      ready.set(true);
    };
    const refresh = async () => {
      controller?.abort();
      clearTimeout(timeout);
      const request = ++sequence;
      controller = new AbortController();
      timeout = setTimeout(
        () => {
          settle(request, false);
          sequence++;
          controller?.abort();
        },
        Math.min(5000, this.config.intervaloRefrescoMs),
      );
      try {
        const url = new URL(this.config.proxyUrl, globalThis.location.origin);
        for (const [key, value] of Object.entries(properties)) {
          url.searchParams.set(`properties[${key}]`, value);
        }
        const response = await fetch(url.toString(), {
          headers: { Authorization: this.config.clientKey },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('flags.context.unavailable');
        const body: unknown = await response.json();
        const toggles = (body as Partial<RespuestaProxy> | null)?.toggles;
        const toggle = Array.isArray(toggles)
          ? (toggles as readonly { name?: unknown; enabled?: unknown }[]).find(
              (item) => item?.name === flag,
            )
          : null;
        settle(request, toggle?.enabled === true);
      } catch {
        settle(request, false);
      }
    };
    const unregister = this.destroyRef.onDestroy(() => destroy());
    const destroy = () => {
      if (disposed) return;
      disposed = true;
      sequence++;
      controller?.abort();
      clearTimeout(timeout);
      clearInterval(interval);
      enabled.set(false);
      ready.set(true);
      unregister();
    };
    if (this.config.proxyUrl) {
      void refresh();
      interval = setInterval(() => void refresh(), this.config.intervaloRefrescoMs);
    }
    return { enabled: enabled.asReadonly(), ready: ready.asReadonly(), destroy };
  }

  private async refrescar(
    context: FeatureFlagEvaluationContext | undefined,
    scope: AbortSignal,
  ): Promise<void> {
    const request = new AbortController();
    const abort = () => request.abort();
    scope.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 10_000);
    try {
      const url = new URL(this.config.proxyUrl, globalThis.location.origin);
      if (context?.userId) url.searchParams.set('userId', context.userId);
      for (const [key, value] of Object.entries(context?.properties ?? {})) {
        url.searchParams.set(`properties[${key}]`, value);
      }
      const respuesta = await fetch(url.toString(), {
        headers: { Authorization: this.config.clientKey },
        signal: request.signal,
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!respuesta.ok) throw new Error(`El proxy respondió ${respuesta.status}`);

      const cuerpo: unknown = await respuesta.json();
      if (scope.aborted || request.signal.aborted) return;
      if (!esRespuestaProxy(cuerpo)) throw new Error('Respuesta de flags inválida');
      // GET /proxy devuelve solo flags ON: una ausencia en una respuesta válida significa OFF.
      const mapa: Record<string, boolean> = Object.fromEntries(
        Object.keys(FLAGS_POR_DEFECTO).map((key) => [key, false]),
      );
      const seen = new Set<string>();
      for (const toggle of cuerpo.toggles) {
        if (seen.has(toggle.name)) throw new Error('Flag duplicada');
        seen.add(toggle.name);
        if (Object.hasOwn(FLAGS_POR_DEFECTO, toggle.name)) mapa[toggle.name] = toggle.enabled;
      }
      mapa[NOTIFICATION_CENTER] = false;

      this.estado.set(mapa);
      this.sincronizado.set(true);
      if (this.degraded) this.logger.log('INFO', 'flags.recovered');
      this.degraded = false;
    } catch {
      if (scope.aborted) return;
      // Conserva la última evaluación válida; antes de sincronizar, los defaults del catálogo.
      // Las demás flags conservan su último valor para mantener la aplicación
      // operativa durante una caída temporal del proxy. Ver plan §9.
      // La incorporación de negocios exige falla cerrada incluso si el último
      // valor recibido fue ON: una solicitud nueva no debe quedar habilitada
      // por una respuesta antigua del proxy.
      this.estado.update((current) => ({ ...current, 'mapit.s6.business-applications': false }));
      if (!this.degraded) this.logger.log('WARN', 'flags.degraded');
      this.degraded = true;
    } finally {
      clearTimeout(timeout);
      scope.removeEventListener('abort', abort);
    }
  }
}
