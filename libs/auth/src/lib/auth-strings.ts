/**
 * Textos visibles de la librería de autenticación de la consola.
 * Se mantienen junto a la librería (no en apps/console/core) porque el mensaje
 * le pertenece a este dominio y la lib no debe importar de apps.
 */

/** Aviso cuando el navegador no permite persistir la sesión. */
export const AUTH_STORAGE_WARNING =
  'La sesión se mantendrá solo en esta página porque el navegador no permite guardarla.';

/** Error de sesión malformada o incompatible con el contrato. */
export const AUTH_SESSION_INVALID = 'Respuesta de autenticación inválida.';
