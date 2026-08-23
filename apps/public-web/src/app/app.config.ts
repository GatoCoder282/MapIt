import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { provideFeatureFlags } from '@mapit/feature-flags';
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
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
    provideFeatureFlags(),
  ],
};
