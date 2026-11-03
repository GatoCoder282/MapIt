import { provideLogging, loggingInterceptor, LOGGING_API_URL } from '@mapit/logging';
import {
  type ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideCheckNoChangesConfig,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';

import { AuthSession, authInterceptor, AUTH_API_URL } from '@mapit/auth';
import { provideI18n } from '@mapit/i18n';
import { BASE_PATH } from '@mapit/api-client';
import { FeatureFlagService, provideFeatureFlags } from '@mapit/feature-flags';
import { provideRealtime } from '@mapit/realtime';
import { provideRuntimeConfig, RuntimeConfigStore } from './core/runtime-config';
import { MAPIT_ECHARTS_THEME } from './core/theme/echarts-theme';
import { provideEchartsCore } from 'ngx-echarts';
// eslint-disable-next-line no-restricted-imports
import { provideKonvaMapEngine } from '@mapit/map-engine/adapters/konva/konva-map-engine';
import { routes } from './app.routes';

/**
 * Configuración de arranque de la consola.
 *
 * No se declara `provideZonelessChangeDetection()`: zoneless es el DEFAULT
 * desde Angular v21. Tampoco debe aparecer `provideZoneChangeDetection()`
 * — hay una regla de lint que lo impide (ver packages/config-eslint/angular.js).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideI18n(),
    provideBrowserGlobalErrorListeners(),
    provideLogging({ service: 'mapit-console' }),
    {
      provide: LOGGING_API_URL,
      useFactory: () => {
        const runtime = inject(RuntimeConfigStore);
        return () => runtime.config().apiBaseUrl;
      },
    },
    provideCheckNoChangesConfig({ exhaustive: true, interval: 1000 }),

    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withFetch(), withInterceptors([loggingInterceptor, authInterceptor])),

    {
      provide: BASE_PATH,
      useFactory: () => inject(RuntimeConfigStore).config().apiBaseUrl,
    },

    {
      provide: AUTH_API_URL,
      useFactory: () => {
        const config = inject(RuntimeConfigStore);
        return () => config.config().apiBaseUrl;
      },
    },

    // Config leída en RUNTIME desde /assets/config.json, no incrustada en el
    // bundle. Así la MISMA imagen Docker sirve para dev y para despliegue:
    // solo cambia el archivo montado. Ver plan §10.
    provideRuntimeConfig(),

    provideFeatureFlags(() => {
      const config = inject(RuntimeConfigStore).config();
      return { proxyUrl: config.unleashProxyUrl, clientKey: config.unleashClientKey };
    }),

    // La librerÃ­a realtime no conoce AuthSession ni Unleash. La consola conecta esos puertos
    // concretos con el runtime config y el kill switch de punta a punta.
    provideRealtime(() => {
      const runtime = inject(RuntimeConfigStore);
      const flags = inject(FeatureFlagService);
      const session = inject(AuthSession);
      return {
        brokerUrl: () => runtime.config().wsUrl,
        accessToken: () => session.token(),
        enabled: () => flags.isEnabledNow('realtime.websocket'),
      };
    }),

    provideKonvaMapEngine(),

    // ngx-echarts carga el motor de forma diferida: `echarts/core` entra en un
    // chunk aparte la primera vez que se crea un gráfico, no en el bundle
    // inicial. El tema se registra en `core/theme/echarts-setup.ts`, que llama
    // la pantalla que dibuje gráficos (Regla 5: solo por módulos).
    provideEchartsCore({ echarts: () => import('echarts/core'), theme: MAPIT_ECHARTS_THEME }),
  ],
};
