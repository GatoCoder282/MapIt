/**
 * Configuración de la vista pública.
 *
 * Diferencia deliberada con la consola: aquí no hay shell autenticado ni
 * runtime config propio todavía; cuando public-web reciba llamadas API más
 * allá del onboarding, esta constante se sustituirá por el mismo mecanismo de
 * `/assets/config.json` que usa la consola.
 */

/** Base de la API de backend usada por las llamadas públicas (activación). */
export const API_BASE_URL = 'http://localhost:8080/api/v1';

/** Base de la consola de staff, para redirigir tras la activación. */
export const CONSOLE_BASE_URL = 'http://localhost:4200';
