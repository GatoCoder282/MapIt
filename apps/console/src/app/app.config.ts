import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideCheckNoChangesConfig,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { provideFeatureFlags } from '@mapit/feature-flags';
import { provideRuntimeConfig } from './core/runtime-config';
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
    provideHttpClient(withFetch(), withInterceptors([])),

    // Config leída en RUNTIME desde /assets/config.json, no incrustada en el
    // bundle. Así la MISMA imagen Docker sirve para dev y para despliegue:
    // solo cambia el archivo montado. Ver plan §10.
    provideRuntimeConfig(),

    provideFeatureFlags(),
  ],
};
