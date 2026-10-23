# Tareas — HU-3.01 Actualización de Estado

## MAP-124 — PATCH de estado

- [x] Editar primero el contrato OpenAPI y regenerar clientes.
- [x] Crear modelo y puerto en `operations-domain`.
- [x] Implementar el caso de uso transaccional en `operations-application`.
- [x] Implementar adaptadores JDBC y REST en `operations-infrastructure`.
- [x] Restringir el endpoint a ADMIN y STAFF.
- [x] Cubrir el comportamiento de MAP-124 con pruebas unitarias.

## MAP-125 — Auditoría

- [x] Crear migración y modelo de auditoría.
- [x] Persistir actor, instante, estado anterior y nuevo de forma atómica.
- [x] Actualizar `docs/db/mapit.dbml` y activar RLS forzada.
- [x] Exponer una consulta autenticada del historial del elemento.

## MAP-126 — Transiciones

- [x] Definir la matriz de transiciones en dominio.
- [x] Responder `409 ProblemDetail` sin persistir ante una transición inválida.

## MAP-127 — Acción frontend

- [x] Presentar estados disponibles y acción accesible en la vista Staff.

## MAP-128 — Integración API

- [x] Conectar el store al cliente generado y mostrar éxito/error.

## MAP-144 — Pruebas de integración

- [x] Probar transición válida e inválida, auditoría, roles y aislamiento por tenant.

## Notas de ejecución

### MAP-124

- Rama `chris799-hub/map-124-patch-estado-space-element`, basada temporalmente en
  `HU-2.03-—-Asignación-de-Elementos-Espaciales` porque MAP-109 todavía no está en `main`.
- Contrato `PATCH /api/v1/sectors/{sectorId}/elements/{elementId}/state`, autenticado y
  sin aceptar el tenant desde el cliente.
- `operations` accede a `space_element` mediante su propio puerto y adaptador JDBC; no
  importa el módulo `spaces`.
- La consulta fija `SET LOCAL app.tenant_id` y además filtra tenant, sector, id y baja lógica.
- Repetir el estado actual es idempotente y no ejecuta un `UPDATE`.
- `pnpm api:check` y `pnpm be:test` finalizaron correctamente.
- Auditoría persistente y matriz de transiciones quedan deliberadamente para MAP-125 y
  MAP-126, respectivamente.

### MAP-125

- Rama `chris799-hub/map-125-auditoria-cambios-estado`, basada en MAP-124 para conservar
  la secuencia de la historia.
- La migración `V14__crear_auditoria_de_cambios_de_estado.sql` crea una bitácora inmutable
  con índices por tenant/elemento y RLS forzada.
- El actor sale de `ActorContext`, implementado desde el principal reconstruido por el JWT;
  el cliente no puede indicar `changed_by`.
- El cambio del elemento y la entrada de auditoría comparten la transacción del caso de uso.
- Repetir el mismo estado sigue siendo idempotente y no crea auditoría falsa.
- `GET /api/v1/sectors/{sectorId}/elements/{elementId}/state-history` permite consultar la
  trazabilidad sin exponer datos de otro tenant.
- Flyway aplicó correctamente V12, V13 y V14; la tabla quedó con RLS y `FORCE ROW LEVEL
SECURITY`, además de sus tres índices.

### MAP-126

- Rama `chris799-hub/map-126-validar-transiciones-estado`, basada en MAP-125.
- `SpaceElementStateMachine` concentra la matriz y mantiene la confirmación del mismo
  estado como operación idempotente.
- `OUT_OF_SERVICE` solo puede volver a `AVAILABLE`; así se rechaza expresamente el salto
  directo a `RESERVED` indicado por Jira.
- La excepción de dominio se traduce a `409 Problem Details` con los estados actual y
  solicitado.
- Una transición inválida se rechaza antes de guardar el elemento o crear auditoría.

### MAP-127

- Rama `chris799-hub/map-127-accion-frontend-cambio-estado`, basada en MAP-126.
- La lista de elementos incorpora una acción accesible para seleccionar el nuevo estado.
- Las opciones replican la matriz de MAP-126 y nunca ofrecen el estado actual ni una
  transición inválida.
- La acción solo se presenta a sesiones con rol `ADMIN` o `STAFF`.
- El componente emite una solicitud tipada con sector, elemento y estado; MAP-128 conectará
  ese evento al cliente generado y resolverá los estados de carga, éxito y error.

### MAP-128

- Rama `chris799-hub/map-128-integrar-cambio-estado-api`, basada en MAP-127.
- `SpacesApiService` usa `OperationsService` generado desde OpenAPI para ejecutar el PATCH;
  el frontend no construye el tenant ni el actor.
- El store conserva el estado anterior mientras la petición está pendiente y solo aplica la
  respuesta confirmada por el backend.
- Cada elemento expone su propio estado de carga y un mensaje accesible de éxito o error.
- Los errores `403`, `404` y `409` tienen mensajes específicos; ningún error modifica la
  copia local del elemento.

### MAP-144

- Rama `chris799-hub/map-144-pruebas-integracion-hu-3-01`, basada en MAP-128.
- La prueba levanta el servidor Spring y PostgreSQL 16 mediante Testcontainers; recorre
  seguridad, controller, aplicación, JDBC, Flyway y RLS en un flujo HTTP real.
- ADMIN y STAFF ejecutan transiciones válidas y el historial conserva secuencia, actor,
  estados anterior/nuevo e instante.
- Una transición inválida responde `409 Problem Details` sin modificar el elemento ni
  insertar auditoría.
- Sin JWT se obtiene `401`; MANAGER y SUPER_ADMIN reciben `403`.
- Recursos de otro tenant, otro sector, inexistentes o dados de baja responden `404` y no
  revelan ni modifican datos.
