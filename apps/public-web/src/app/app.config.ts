import { provideLogging, loggingInterceptor, LOGGING_API_URL } from '@mapit/logging';
import { PublicRuntimeConfig, providePublicRuntimeConfig } from './core/runtime-config';
import { type ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';

import { provideFeatureFlags } from '@mapit/feature-flags';
import { BASE_PATH } from '@mapit/api-client';

import { routes } from './app.routes';

/**
 * Configuración de la vista pública.
 *
 * A diferencia de la consola, aquí NO hay JWT de staff: el cliente final es
 * anónimo hasta que confirma una reserva. El tenant se resuelve por el slug
 * del establecimiento en la URL, no por un token.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideLogging({ service: 'mapit-public-web' }),
    providePublicRuntimeConfig(),
    {
      provide: LOGGING_API_URL,
      useFactory: () => {
        const runtime = inject(PublicRuntimeConfig);
        return () => runtime.config().apiBaseUrl;
      },
    },
    // Transición suave al cambiar de página (landing ↔ reservas): fade nativo
    // de la View Transitions API, ~180ms. Sin JS extra. Ver styles.scss.
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withFetch(), withInterceptors([loggingInterceptor])),
    provideFeatureFlags(),
    { provide: BASE_PATH, useFactory: () => inject(PublicRuntimeConfig).config().apiBaseUrl },
  ],
};
