import {
  type ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideCheckNoChangesConfig,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { AuthSession, authInterceptor, AUTH_API_URL } from '@mapit/auth';
import { BASE_PATH } from '@mapit/api-client';
import { FeatureFlagService, provideFeatureFlags } from '@mapit/feature-flags';
import { provideRealtime } from '@mapit/realtime';
import { provideRuntimeConfig, RuntimeConfigStore } from './core/runtime-config';
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
    provideBrowserGlobalErrorListeners(),
    provideCheckNoChangesConfig({ exhaustive: true, interval: 1000 }),

    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),

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
  ],
};
