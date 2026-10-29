# Spec — administración de pagos y contexto de establecimiento

Origen: ampliación del usuario a MAP-229/HU-6.03 y HU-6.02. Jira consultado: MAP-229 y MAP-228 En curso; MAP-227 Listo. Sin mutaciones remotas. Conservar todos los cambios locales y migraciones V1–V22 aplicadas.

## Problemas

La administración de pagos existe, pero está escondida en Configuración de ADMIN; SUPER_ADMIN usa otro shell de plataforma. Faltan titular y listado de pagos. El catálogo público ya devuelve Establishment, pero no distingue empresa/local ni filtra empresa; availability/booking no presentan su identidad completa. No hay contexto activo persistente de local en Console ni asignaciones STAFF por establecimiento.

## Resultado

ADMIN de empresa elige un establecimiento físico al entrar. La preferencia se recuerda mediante cookie no secreta por usuario/tenant; nunca autoriza una operación. Configuración permite cambiar o salir del establecimiento, y cerrar sesión conserva la preferencia para el próximo acceso del mismo usuario. Ningún establecimiento se selecciona por defecto en el primer acceso. Una preferencia inválida se descarta tras consultar el backend.

Administración → Configuración → Métodos de pago debe ser visible y accesible por teclado, con ruta canónica y alias compatible. CRUD y QR existentes se amplían con titular real, desactivación directa, lista filtrada/paginada de pagos y verificación manual contextual. No inventar titular para registros anteriores; permitir desactivar el legado. Métodos utilizados conservan datos receptores y QR: su reemplazo crea otro método y desactiva el anterior.

ADMIN mantiene la autorización empresarial explícita existente para todos sus locales. No se inventa un rol ADMIN local. STAFF requiere concesión persistida por local para check-in y salas operativas/pagos; ADMIN puede conceder/revocar dicha operación de forma explícita desde Configuración. SUPER_ADMIN de plataforma no obtiene acceso a cobros de empresas.

Public Web permite catálogo global o acotado por empresa, muestra empresa, nombre local, dirección disponible, código slug y timezone. Una consulta por ambos slugs carga enlaces directos. El contexto físico se mantiene en disponibilidad, reserva, checkout y comprobante. El backend conserva filtros y validaciones reales contra recursos del local elegido. No crear Branch ni inventar coordenadas/horarios.

## Límites

Proveedor integrado sigue indisponible hasta contar con adaptador/credenciales/sandbox autorizados; no recopilar secretos en Angular. No cambiar paleta/tipografías ni instalar librerías nuevas. Reutilizar QR, lector, Signals, STRINGS, API generada, STOMP/outbox y reglas de estado. Mantener historial y RLS; cambios de esquema solo en V23 o posterior.

## Aceptación

Selección recordada/aislada por usuario y empresa, cambio/salida, estados cero/uno/varios locales, nav ADMIN visible y SUPER_ADMIN separado; QR/titular guardados en PostgreSQL, lista de pagos real, permisos de STAFF revocables y aislamiento tenant/local en HTTP y STOMP. Catálogo de dos sucursales conserva la segunda durante reserva/pago/comprobante/check-in. Pruebas de contratos, backend/RLS, frontend y recorrido E2E conectado con proveedor mock explícito.
