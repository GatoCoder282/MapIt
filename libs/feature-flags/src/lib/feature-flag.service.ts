import { Logger } from '@mapit/logging';
import { computed, effect, inject, Injectable, signal, type Signal } from '@angular/core';

import { FEATURE_FLAG_CONFIG } from './feature-flag.config';
import { FLAGS_POR_DEFECTO, type FeatureFlagKey } from './feature-flag.catalog';

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

  /** Estado actual. Arranca con los valores por defecto del catálogo. */
  private readonly estado = signal<Readonly<Record<string, boolean>>>({ ...FLAGS_POR_DEFECTO });

  /** True cuando ya se recibió al menos una respuesta del proxy. */
  private readonly sincronizado = signal(false);
  readonly listo = this.sincronizado.asReadonly();

  constructor() {
    void this.refrescar();

    // Sondeo periódico: es así como una flag apagada en la UI de Unleash llega
    // al navegador sin que el usuario recargue. El intervalo es un compromiso
    // entre latencia de propagación y tráfico.
    effect((onCleanup) => {
      if (!this.config.proxyUrl || !this.config.clientKey) return;

      const id = setInterval(() => void this.refrescar(), this.config.intervaloRefrescoMs);
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
      sig = computed(() => this.estado()[flag] ?? FLAGS_POR_DEFECTO[flag] ?? false);
      this.cache.set(flag, sig);
    }
    return sig;
  }

  /** Lectura puntual, para lógica imperativa (guards, interceptores). */
  isEnabledNow(flag: FeatureFlagKey): boolean {
    return this.estado()[flag] ?? FLAGS_POR_DEFECTO[flag] ?? false;
  }

  private async refrescar(): Promise<void> {
    if (!this.config.proxyUrl || !this.config.clientKey) {
      this.sincronizado.set(true);
      return;
    }

    try {
      const respuesta = await fetch(this.config.proxyUrl, {
        headers: { Authorization: this.config.clientKey },
      });
      if (!respuesta.ok) throw new Error(`El proxy respondió ${respuesta.status}`);

      const cuerpo = (await respuesta.json()) as RespuestaProxy;
      const mapa: Record<string, boolean> = { ...FLAGS_POR_DEFECTO };
      for (const toggle of cuerpo.toggles) mapa[toggle.name] = toggle.enabled;

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
