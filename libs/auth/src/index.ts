/**
 * Autenticación de staff (CU-23, CU-24).
 *
 * El JWT incluye el claim `tenant`, del que el backend resuelve el tenant.
 * Deliberadamente NO se usa un header `X-Tenant-Id` para las rutas de staff:
 * un cliente podría falsificarlo y saltarse el aislamiento entre empresas.
 *
 * Se implementa en su caso de uso; aquí solo queda reservado el espacio.
 */
export const AUTH_VERSION = '0.1.0';
