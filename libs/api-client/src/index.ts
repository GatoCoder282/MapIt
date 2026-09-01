/**
 * Cliente de la API de MapIt.
 *
 * El contenido de `src/lib/generated/` se GENERA desde
 * `packages/api-contract/openapi.yaml` con `pnpm api:gen`, y NO se commitea.
 * Nunca edites esos archivos a mano: edita el contrato y regenera.
 *
 * Lo escrito a mano (interceptores de auth, tenant y errores) vive en `src/lib/`.
 */
export const API_CLIENT_VERSION = '0.1.0';

// La aplicación consume únicamente la API pública de la librería, nunca imports profundos.
export * from './lib/generated';
