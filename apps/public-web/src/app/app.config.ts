import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';

import { provideFeatureFlags } from '@mapit/feature-flags';
import { BASE_PATH } from '@mapit/api-client';

import { API_BASE_URL } from './core/config';
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
    // Transición suave al cambiar de página (landing ↔ reservas): fade nativo
    // de la View Transitions API, ~180ms. Sin JS extra. Ver styles.scss.
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withFetch()),
    provideFeatureFlags(),
    // Sin runtime-config propio todavía: la activación es la única llamada API
    // pública y usa la constante de core/config.
    { provide: BASE_PATH, useValue: API_BASE_URL },
  ],
};
