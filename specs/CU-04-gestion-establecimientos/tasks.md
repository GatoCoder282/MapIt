# CU-04 — Tareas

> Historia **HU-2.01** · Rama `feat/Trigramador69/MAP-54-gestion-establecimientos`

## Orden de ejecución

El orden **no** es el de los números de MAP: el proyecto exige contrato primero y
dominio antes que adaptadores. Cada tarea indica a qué subtarea de Jira pertenece.

- [x] **T1 — Contrato.** _(prerequisito de MAP-56 y MAP-57)_
      Añadir a `openapi.yaml` las 5 rutas y los 3 esquemas. `EstablishmentUpdateRequest`
      **sin** `type`. Validar con `pnpm api:lint` y regenerar con `pnpm api:gen`.
      _Verificable:_ `libs/api-client` expone `EstablishmentsService` con 5 operaciones.

- [x] **T2 — Migración.** _(MAP-55)_
      `pnpm db:new "crear tabla establishment"`. Tabla con las 12 columnas, índice
      `(tenant_id, id)`, índice único parcial `(tenant_id, slug) WHERE deleted_at IS NULL`,
      trigger `touch_updated_at` y `enable_tenant_isolation('establishment')`.
      Actualizar `docs/db/mapit.dbml` en el mismo commit.
      _Verificable:_ `pnpm db:migrate` aplica V3 y `pnpm db:info` la muestra como
      `Success`.

- [x] **T3 — Dominio.** _(MAP-54)_
      `Establishment` (record), `EstablishmentType` (enum de 4 valores), `Slug` (value
      object con formato), `EstablishmentRepository` (puerto). Sin Spring ni JPA.
      _Verificable:_ tests unitarios en verde y el módulo compila sin dependencias de
      framework.

- [x] **T4 — Persistencia.** _(MAP-54)_
      `EstablishmentJpaEntity`, `EstablishmentSpringDataRepository` y
      `EstablishmentPersistenceAdapter` con `set_config('app.tenant_id', …)` y el filtro
      `deleted_at IS NULL` centralizado.
      _Verificable:_ el contexto de Spring arranca con `ddl-auto: validate`, lo que
      prueba que la entidad y la tabla coinciden.

- [x] **T5 — Casos de uso.** _(MAP-56)_
      `EstablishmentService`: `create`, `findAll`, `findById`, `update`, `softDelete`.
      `Clock` inyectado. Excepciones de conflicto y de no encontrado.
      _Verificable:_ tests unitarios del servicio con repositorio en memoria.

- [x] **T6 — API REST.** _(MAP-56, MAP-57)_
      `EstablishmentController` con las 5 rutas, validaciones `@Valid`, `409` para slug
      duplicado, `404` para id ajeno o inexistente, `ProblemDetail` en los errores.
      _Verificable:_ tests de integración con Testcontainers cubriendo CA-1 a CA-8.

- [x] **T7 — Aislamiento.** _(MAP-55, obligatorio por `specs/AGENTS.md` §4)_
      `EstablishmentIsolationIntegrationTest` siguiendo `DemoItemIsolationIntegrationTest`.
      _Verificable:_ el test falla si se desactiva la RLS. Cubre CA-9.

- [x] **T8 — ViewModel y datos.** _(MAP-59)_
      `EstablishmentsApi` sobre el cliente generado y `EstablishmentsStore` con señales.
      _Verificable:_ `establishments-store.spec.ts` en verde con Vitest.

- [x] **T9 — Pantalla.** _(MAP-58)_
      Componente `Establishments` (lista + formulario), ruta perezosa en `app.routes.ts`,
      selector de tipo deshabilitado en edición.
      _Verificable:_ en `http://localhost:4200/establishments` se completa el ciclo alta →
      edición → baja y la lista refleja cada cambio.

- [x] **T10 — Cierre.**
      `pnpm check` en verde, criterios de `spec.md` §7 marcados, notas de ejecución
      escritas, PR contra `main`.

## Trazabilidad con Jira

| Subtarea   | Enunciado                          | Tareas     |
| ---------- | ---------------------------------- | ---------- |
| **MAP-54** | Crear entidad Establishment        | T3, T4     |
| **MAP-55** | Crear migración Flyway             | T2, T7     |
| **MAP-56** | Crear CRUD de establecimientos     | T1, T5, T6 |
| **MAP-57** | Crear endpoint de consulta         | T1, T6     |
| **MAP-58** | Crear pantalla de establecimientos | T9         |
| **MAP-59** | Integrar CRUD con frontend         | T8         |

## Notas de ejecución

> Se rellenan **durante** la ejecución, no al final. Es lo que se defiende ante la docente.

### Lo que se verificó, y cómo

Los 9 criterios de aceptación se comprobaron contra la API real levantada con
`pnpm dev`, no solo con tests:

| Criterio | Comprobación                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------- |
| CA-1     | `POST` devolvió `201` con id generado y `timezone` por defecto `America/La_Paz`.                  |
| CA-2     | Con una fila del tenant `other` en la tabla, la API del tenant `demo` devolvió solo la suya.      |
| CA-3     | `PUT` cambió nombre, slug y zona; `createdAt` se conservó y `updatedAt` avanzó.                   |
| CA-5     | Slug repetido → `409`.                                                                            |
| CA-6     | `DELETE` → `204`, desaparece del listado, pero `SELECT` directo muestra la fila con `deleted_at`. |
| CA-7     | Tras la baja, crear otro con el mismo slug → `201`.                                               |
| CA-8     | Id inexistente → `404`.                                                                           |
| CA-9     | `EstablishmentIsolationIntegrationTest`, 3 tests con Testcontainers.                              |

Cobertura automatizada: **24** tests de dominio, **3** de aislamiento y **8** del
ViewModel Angular.

### Hallazgo: la RLS no protege al usuario de la aplicación

Al verificar CA-2 con `psql` se vio que consultar como tenant `demo` devolvía también
las filas del tenant `other`. **No es un fallo de este CU.** El usuario `mapit` con el
que se conecta el backend es **superusuario y tiene `rolbypassrls = true`**, y los
superusuarios ignoran la RLS aunque la tabla tenga `FORCE ROW LEVEL SECURITY`.

Consecuencias:

- El aislamiento efectivo en ejecución lo da hoy el filtro explícito por `tenant_id` de
  las consultas, no la RLS. La «doble capa» que describen `apps/backend/AGENTS.md` y
  `ADR-0004` es hoy una sola.
- Por eso el test de aislamiento —igual que el de `demo_item`— crea el rol
  `mapit_rls_test` sin privilegios: probar con el usuario normal daría un **falso
  verde**, porque se verían todas las filas.
- Afecta por igual a `demo_item`; es una deuda de infraestructura previa a este CU.
  Corregirlo es cambiar el usuario de la aplicación por uno sin `BYPASSRLS`, lo que toca
  el compose y a todo el equipo: queda **fuera del alcance de CU-04** y debería abrirse
  como tarea aparte.

### Desvíos del plan

- **CA-4 se reescribió.** Ver la nota en `spec.md` §7: exigir `400` al enviar `type`
  habría roto el patrón _GET → modificar → PUT_. La invariante se garantiza igual desde
  el contrato.
- **Se añadió el value object `AuditTrail`**, que el plan no preveía. Agrupa los seis
  campos de auditoría en un concepto con métodos (`created`, `touched`, `deleted`) en vez
  de dejar `Establishment` con doce componentes sueltos. Evita el antipatrón _Anemic
  Domain Model_ del catálogo.
- **Hubo que abrir `/error` en `SecurityConfig`.** Sin esa ruta, un fallo de `@Valid`
  hace forward interno a `/error`, vuelve a pasar por el filtro de seguridad y sale como
  `403` con cuerpo vacío en lugar de `400`. Sin este arreglo, el criterio de datos
  inválidos era inalcanzable. Beneficia también a `demo-items`.
- **La feature Angular vive en `features/administration/establishments/`**, no en una
  feature suelta: `apps/console/AGENTS.md` asigna CU-01…CU-05 a `administration`.

### Otros apuntes

- Son los **primeros tests de módulo** del backend: hasta ahora solo había tests en
  `bootstrap`. `spaces-domain` estrena `src/test`.
- El `PUT` sin `timezone` restablece la zona por defecto en vez de conservar la anterior.
  Es semántica correcta de `PUT` (reemplazo completo), pero conviene saberlo: si se
  quisiera conservación, el verbo adecuado sería `PATCH`.
- `created_by`, `updated_by` y `deleted_by` se persisten **nulos** en todas las
  operaciones. `EstablishmentService.autorActual()` es el único punto a cambiar cuando
  llegue CU-23/CU-24.

## Decisiones tomadas antes de empezar

- **MAP-56 decía "CRUD" pero los criterios de aceptación de la HU solo cubrían crear,
  consultar y actualizar.** Se resolvió incluyendo el borrado, pero **lógico**: `floor` y
  `sector` (CU-05) apuntarán a `establishment`, y un borrado físico dejaría huérfanos o
  exigiría cascadas que nadie ha decidido todavía.
- **La tabla `establishment` ya estaba diseñada en `docs/db/mapit.dbml`** con `name`,
  `type`, `slug` y `timezone`. Se respeta ese diseño y se le añaden las columnas de
  auditoría; el DBML se actualiza en el mismo commit.
- **`created_by` / `updated_by` / `deleted_by` van sin clave foránea** porque `app_user`
  no existe hasta CU-23/CU-24. Se persisten nulas y la FK llegará con esa migración.
- **El tipo es inmutable tras la creación** (RN-3): lo hace cumplir el propio contrato,
  al no incluir `type` en `EstablishmentUpdateRequest`.
- **El código de CU-01 no está en `main`** cuando se empieza este CU: solo se fusionó su
  documentación (`16658dd`). Las ramas `MAP-34`…`MAP-42` siguen abiertas, así que este CU
  se construye sobre lo que `main` sí tiene: la tabla `tenant` de `V1__baseline.sql` y
  `TenantId` / `TenantContext` del shared-kernel.
