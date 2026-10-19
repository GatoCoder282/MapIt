# Plan — HU-6.01 Buscador de Disponibilidad

## Enfoque

El contexto `reservations` publicará una consulta de solo lectura por `tenantSlug`, `establishmentSlug` y `date`. La infraestructura resolverá el tenant global activo por slug, fijará RLS en la transacción y devolverá una proyección mínima de elementos que están activos, son reservables, tienen estado `AVAILABLE` y no se solapan con reservas `CREATED`, `CONFIRMED` o `ACTIVE` en el día local del establecimiento.

El cliente web incorporará una pantalla pública de búsqueda y una ruta enlazada desde las tarjetas de establecimientos. La fecha será seleccionable; los slugs provendrán de la ruta. Se mantendrá el lenguaje visual, tokens y comportamiento responsive de Reservas.

## Patrones de diseño aplicados

| Patrón              | Dónde                                                                         | Por qué aquí                                                                                               | Alternativa descartada                                                    |
| ------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Ports and Adapters  | Puerto de búsqueda en `reservations-domain`; consulta JDBC en infraestructura | Permite que reservas consulte su proyección sin importar el módulo `spaces` y mantiene RLS en el adaptador | Importar el repositorio de `spaces` rompería los límites entre módulos    |
| Application Service | `FindPublicAvailability` en `reservations-application`                        | Coordina la consulta transaccional sin poner reglas de negocio en el controlador                           | Consultar directamente desde el controlador acoplaría HTTP y persistencia |
| Projection / DTO    | Resultado público `{ id, type }`                                              | Limita los datos expuestos en un endpoint anónimo                                                          | Serializar entidades internas expondría campos de operación y auditoría   |

## Contrato API

- Editar primero `packages/api-contract/openapi.yaml`, validar y generar clientes.

| Método | Ruta                                                                           | Parámetro                                  | Respuesta                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/public/tenants/{tenantSlug}/establishments/{establishmentSlug}/availability` | Query requerido `date` en ISO `YYYY-MM-DD` | `200` con `{ establishmentId, date, elements: [{ id, type }] }`; `400` por fecha inválida; `404` para tenant/establecimiento público no disponible |

La operación declara `security: []`. La consulta usa el día calendario en la zona horaria configurada para el establecimiento y el intervalo `[startOfDay, nextStartOfDay)`.

## Backend

- Añadir un puerto de disponibilidad pública, un caso de uso y un adaptador JDBC en `reservations`.
- Resolver slug y estado del tenant contra la tabla global `tenant`; fijar `app.tenant_id` y consultar establecimiento, elementos y reservas en la misma transacción.
- Filtrar explícitamente por tenant, establecimiento, bajas lógicas, tipo reservable y estado `AVAILABLE`; excluir solapes con reservas vigentes.
- Añadir el controlador en el namespace `/api/v1/public/**`; la ruta ya está permitida para clientes anónimos. Mantener el `404` indistinguible para tenant/establecimiento no visible.
- No crear migraciones. El controlador solo serializa la proyección pública y el caso de uso conserva la lógica de consulta.

## Frontend

- Crear feature `availability` con `data/`, `model/` y `ui/`, usando el cliente generado y Signals.
- Añadir `/disponibilidad/:tenantSlug/:establishmentSlug`, un formulario de fecha y enlaces desde las tarjetas actuales; iniciar la fecha en hoy según el navegador.
- Mostrar carga, resultados, vacío y error recuperable. Renderizar tipo e identificador del elemento, sin metadatos internos.
- Añadir todas las cadenas visibles al catálogo `STRINGS`; usar controles etiquetados, foco visible, estados accesibles y layout de una columna en móvil.

## Verificación

- Unit tests de consulta, errores y estados del store.
- Test de integración con PostgreSQL para autenticación anónima, zona horaria, tenant/establecimiento no visible, estado `AVAILABLE`, tipo `DECOR`, bajas lógicas y solapes en los límites del día.
- Test E2E del flujo público en viewport desktop/móvil, mockeando el endpoint.
- Ejecutar `pnpm api:lint`, `pnpm api:gen`, `pnpm api:check`, pruebas específicas, `pnpm check` y `pnpm e2e`.
- Cuando exista el PR y CI termine, adjuntar una captura de la página de checks que muestre todos los workflows requeridos en verde.
