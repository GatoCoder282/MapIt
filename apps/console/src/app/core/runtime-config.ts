import {
  inject,
  Injectable,
  InjectionToken,
  provideAppInitializer,
  signal,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Configuración leída en tiempo de EJECUCIÓN, no de compilación.
 *
 * Angular ofrece `environment.ts`, que se incrusta en el bundle al compilar.
 * Eso obliga a un build distinto por entorno. En su lugar cargamos
 * `/assets/config.json` al arrancar: así la MISMA imagen Docker sirve en
 * desarrollo y en despliegue, cambiando solo el archivo montado.
 * Ver plan §10.
 */
export interface RuntimeConfig {
  readonly apiBaseUrl: string;
  readonly wsUrl: string;
  readonly unleashProxyUrl: string;
  readonly unleashClientKey: string;
  readonly environment: string;
}

const CONFIG_POR_DEFECTO: RuntimeConfig = {
  apiBaseUrl: 'http://localhost:8080/api/v1',
  wsUrl: 'ws://localhost:8080/ws',
  unleashProxyUrl: 'http://localhost:3063/proxy',
  unleashClientKey: 'dev-proxy-key-change-me',
  environment: 'development',
};

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('mapit.runtime-config');

@Injectable({ providedIn: 'root' })
export class RuntimeConfigStore {
  private readonly http = inject(HttpClient);
  private readonly estado = signal<RuntimeConfig>(CONFIG_POR_DEFECTO);

  readonly config = this.estado.asReadonly();

  async cargar(): Promise<void> {
    try {
      const cargada = await firstValueFrom(
        this.http.get<Partial<RuntimeConfig>>('/assets/config.json'),
      );
      this.estado.set({ ...CONFIG_POR_DEFECTO, ...cargada });
    } catch {
      // Sin config.json la app sigue arrancando con los valores por defecto.
      // Es lo correcto en desarrollo: un archivo ausente no debe romper el arranque.
      console.warn(
        '[MapIt] No se encontró /assets/config.json; usando la configuración por defecto.',
      );
    }
  }
}

export function provideRuntimeConfig(): EnvironmentProviders {
  return provideAppInitializer(() => inject(RuntimeConfigStore).cargar());
}

/** Provider para leer la config ya cargada desde cualquier servicio. */
export const runtimeConfigProvider: Provider = {
  provide: RUNTIME_CONFIG,
  useFactory: () => inject(RuntimeConfigStore).config(),
};
