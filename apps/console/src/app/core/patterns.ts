/**
 * Patrones de validación compartidos por los formularios de la consola.
 * Espejo del contrato OpenAPI (`pwsh pattern`): cambiar aquí implica cambiar el
 * contrato, no al revés.
 */

/** Slug de tenant/establecimiento: minúsculas, dígitos y guiones, 2-63 caracteres. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;
