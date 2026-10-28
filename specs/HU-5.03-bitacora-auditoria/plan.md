# Plan — HU-5.03 Bitácora de Auditoría

> Este plan se ejecuta después de aprobar `spec.md`. Cada MAP se implementa en una rama apilada
> sobre la anterior.

## 1. Base y límites de arquitectura

- La historia parte de `origin/main`, que ya contiene HU-5.01 y la auditoría específica de
  HU-3.01.
- `operations` será dueño del modelo consultable `AuditLog`, porque el roadmap asigna la
  bitácora operativa a ese módulo.
- `reservations` no importará `operations`. Publicará auditoría mediante un puerto puro y
  transversal ubicado en `shared-kernel`; el adaptador JDBC vivirá en infraestructura y Spring
  lo conectará desde `bootstrap`.
- El dominio no importará Spring, JDBC, JPA ni Jackson.
- La API se definirá primero en `packages/api-contract/openapi.yaml` y luego se regenerarán los
  clientes con `pnpm api:gen`.

## 2. Modelo propuesto

`AuditLog` será un record inmutable con:

- `id`
- `tenantId`
- `actorId`
- `occurredAt`
- `resourceType`: `RESERVATION` o `SPACE_ELEMENT`
- `resourceId`
- `eventType`
- detalles mínimos controlados por el backend

Los detalles se almacenarán como `JSONB`, pero no se aceptarán mapas provenientes del cliente.
El dominio y los casos de uso construirán únicamente claves permitidas para cada tipo de evento.

## 3. Persistencia y migración

La migración Flyway V19, posterior a la geometría V18:

1. crea `audit_log` con índices por tenant, recurso, evento e instante;
2. activa y fuerza RLS;
3. copia el histórico de `space_element_state_change` al modelo general;
4. actualiza la infraestructura para usar la nueva tabla;
5. retira la tabla específica solo después de preservar sus filas;
6. impide `UPDATE` y `DELETE` al rol runtime mediante privilegios y protección de BD;
7. actualiza `docs/db/mapit.dbml` en el mismo commit.

## 4. Escritura atómica

- `CreateReservation` registra `RESERVATION_CREATED` después de persistir el agregado y antes de
  confirmar su transacción.
- `UpdateSpaceElementState` registra `SPACE_ELEMENT_STATE_CHANGED` en la transacción existente.
- Si HU-5.02 está integrada al comenzar MAP-223, su caso de uso registrará
  `RESERVATION_STATUS_CHANGED`; si aún no existe, se conservará el puerto preparado y la
  integración se hará al incorporar esa historia, sin inventar un segundo flujo de estados.
- Un fallo al insertar auditoría provoca rollback de la acción de negocio.

## 5. Consulta

Se añadirá un endpoint de solo lectura:

```http
GET /api/v1/audit-logs
```

Filtros opcionales:

- `resourceType`
- `resourceId`
- `eventType`
- `from`
- `to`
- `page`
- `size`

La consulta aplica tenant explícito, orden descendente estable y autorización `ADMIN`.
Responderá un modelo paginado generado desde OpenAPI. No se crearán endpoints `POST`, `PUT`,
`PATCH` ni `DELETE` para auditoría.

## 6. Frontend

Se creará `apps/console/src/app/features/audit/` con capas `data`, `model` y `ui`:

- cliente alrededor del servicio OpenAPI generado;
- store con filtros, paginación, loading, vacío y error;
- tabla/lista responsive con actor, evento, recurso, cambio e instante;
- ruta `/administration/audit` protegida para `ADMIN`;
- entrada de navegación visible solo para el rol autorizado;
- textos en `apps/console/src/app/core/strings.ts`.

## 7. Patrones de diseño aplicados

| Patrón                            | Aplicación                                                                               | Por qué aquí                                                                             | Alternativa descartada                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Ports & Adapters                  | Puerto transversal de escritura y repositorio de consulta; JDBC y REST como adaptadores. | Permite que `reservations` emita auditoría sin importar `operations` ni infraestructura. | Importar el repositorio JDBC de otro módulo, lo que rompe los límites del monorepo. |
| Repository                        | Consulta y persistencia de `AuditLog` detrás de interfaces puras.                        | El dominio expresa append y búsqueda sin conocer SQL, RLS o JSONB.                       | Consultas SQL directamente desde controladores y casos de uso.                      |
| Value Object                      | Tipos cerrados para recurso y evento, más identidad tipada del tenant.                   | Evita eventos o recursos escritos con cadenas inconsistentes.                            | `String` libre en toda la aplicación.                                               |
| Observer / publicación por puerto | Los casos de uso notifican el evento al puerto dentro de su transacción.                 | Desacopla el origen del almacenamiento conservando atomicidad síncrona.                  | Evento asíncrono sin outbox, que podría perder auditoría tras confirmar el negocio. |

No se incorpora Event Sourcing: la bitácora explica acciones, pero el estado actual continúa en
los agregados y tablas de negocio.

## 8. Estrategia de pruebas

- Dominio: invariantes, tipos permitidos, copia defensiva y rechazo de detalles sensibles.
- Aplicación: evento correcto y ausencia de evento ante fallo o acción idempotente.
- Controlador: filtros, paginación, mapeo y errores.
- Integración con PostgreSQL/Testcontainers:
  - creación de reserva + auditoría atómica;
  - cambio de estado + auditoría atómica;
  - rollback sin eventos huérfanos;
  - migración del histórico HU-3.01;
  - RLS y aislamiento entre dos tenants;
  - permisos `401`/`403`/`200`;
  - rechazo de `UPDATE` y `DELETE` con el rol runtime;
  - ausencia de secretos.
- Frontend/Vitest: carga, filtros, paginación, estados vacío/error y formato comprensible.

## 9. Ramas apiladas

```text
feat/christian799-hub/MAP-222-crear-entidad-auditlog-inmutable
  -> feat/christian799-hub/MAP-223-registrar-eventos-de-reservation-y-spaceelement
  -> feat/christian799-hub/MAP-224-implementar-endpoint-de-historico
  -> feat/christian799-hub/MAP-225-implementar-vista-de-auditoria-para-administrador
  -> feat/christian799-hub/MAP-226-tests-de-integracion-de-auditoria
```

Cada rama se revisará y subirá antes de crear la siguiente. La última contendrá la historia
completa y será la candidata al PR final hacia `main`.
