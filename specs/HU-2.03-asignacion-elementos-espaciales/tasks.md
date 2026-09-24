# HU-2.03 — Tareas

> Generadas desde `plan.md`. Cada tarea es ejecutable y verificable.
> Solo backend (alcance Foggi). HU relacionada en Jira: MAP-109.

## Orden de ejecución

- [x] **T1 — Contrato.** Añadir a `openapi.yaml` las 4 operaciones (POST crear, GET lista,
      GET detalle, PUT actualizar), los schemas `SpaceElement`,
      `SpaceElementCreateRequest`, `SpaceElementUpdateRequest` y las respuestas
      compartidas (400/401/404/500).
      _Verificación:_ `pnpm api:lint` verde y `pnpm api:gen` regenera sin drift. ✅ (commit 5c15b1a)

- [x] **T2 — Migración.** `pnpm db:new "crear tabla space_element"` → `V12_…sql`
      (V11 quedó tomada por el outbox realtime después del pull de main)
      con `tenant_id`, FK a `sector ON DELETE RESTRICT`, checks de no-negatividad,
      índice `(tenant_id, id)`, índice parcial de vivos, trigger `touch_updated_at`,
      `enable_tenant_isolation('space_element')`. Actualizado `docs/db/mapit.dbml`
      en el mismo commit.
      _Verificación:_ `pnpm be:build` arranca con `ddl-auto: validate` y Flyway en verde.

- [x] **T3 — Dominio.** `SpaceElement` (record), `SpaceElementId`, `SpaceElementType`,
      `SpaceElementTypePolicy` y puerto `SpaceElementRepository`. El estado es el
      `SpaceElementState` de shared-kernel; no se reiventan `ElementState`.
      Sin Spring ni JPA (ArchUnit lo vigila).
      _Verificación:_ `SpaceElementTest` y `SpaceElementTypePolicyTest` en verde.

- [x] **T4 — Casos de uso.** `CreateSpaceElementUseCase`, `UpdateSpaceElementUseCase`,
      `SpaceElementQueryService`, con validación de jerarquía
      tenant→establishment→floor→sector antes de persistir. `SpaceElementNotFoundException`.
      _Verificación:_ tests con repositorios en memoria pasando (12 pruebas).

- [x] **T5 — Adaptadores.** Entidad JPA, Spring Data repo, adaptador con `setDatabaseTenant`,
      y `SpaceElementController` con Problem Details.
      _Verificación:_ integración con Testcontainers cubriendo CA-1…CA-8 y test de
      aislamiento CA-9 (`SpaceElementTenantIsolationIntegrationTest`). `pnpm be:test` y
      `pnpm be:it` en verde.

- [x] **T6 — Cierre.** `pnpm check` pendiente de la fase de verificación global (regla
      27 del prompt: el cierre real lo da la verificación final, no un check parcial).

## Trazabilidad con Jira

| Subtarea    | Enunciado en Jira                      | Artefacto real                                                                                 | Tarea  |
| ----------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- | ------ |
| **MAP-110** | Crear entidad SpaceElement             | Dominio + JPA                                                                                  | T3, T5 |
| **MAP-111** | Crear migración Flyway                 | `V12__crear_tabla_space_element.sql`                                                           | T2     |
| **MAP-112** | Implementar entidad SpaceElement       | **Duplicada de MAP-110** — es el mismo artefacto (la entidad). Se cierra con la misma entrega. | —      |
| **MAP-113** | Crear migración Flyway de SpaceElement | **Duplicada de MAP-111** — mismo artefacto (la migración `V12`).                               | —      |
| **MAP-114** | Implementar SpaceElementService        | `SpaceElementQueryService` + use cases                                                         | T4     |
| **MAP-115** | Implementar endpoint de SpaceElement   | `SpaceElementController`                                                                       | T1, T5 |

**Duplicados detectados:** MAP-110 ≡ MAP-112 (ambos piden la entidad con los mismos
campos) y MAP-111 ≡ MAP-113 (ambos piden la misma migración Flyway con los mismos
criterios: FK a sector, tenant_id, índices, integridad). No se implementa dos veces;
con la entrega de T2/T3/T5 quedan cubiertos los 4 tickets. No se cierra ni se
modifica Jira desde esta sesión; es tarea del equipo al revisar.

## Asignación Jira — Matias Moron

> Tareas de la HU-2.03 (MAP-109) asignadas al integrante Matias Moron. Son de verificación
> de la migración, validación por vertical, frontend (formulario + integración) y tests de
> integración de la API. Esta sección no cambia el código de producción ya entregado;
> solo resume la asignación y su trazabilidad al trabajo existente.

| Subtarea    | Enunciado en Jira                               | Estado / artefacto                                                                                                                                                                                                                                                 |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MAP-111** | Crear migración Flyway de SpaceElement          | ✅ Entregada como `V12__crear_tabla_space_element.sql` (commit 6882239): FK a `sector` con `ON DELETE RESTRICT`, `tenant_id`, checks de integridad, índice `(tenant_id, id)` + índice parcial de vivos; ejecutable en CI (regla `pnpm check`).                     |
| **MAP-116** | Validar tipo de elemento según vertical         | ✅ Centralizada en backend: `SpaceElementTypePolicy` (dominio) + `SpaceElementSupport.validarTipoPermitido` (application). No hay catálogo paralelo: reutiliza `EstablishmentType` y el enum TS de `libs/map-engine`.                                              |
| **MAP-117** | Crear formulario simple de alta de SpaceElement | ⬚ Pendiente (frontend). Alcance: sector, tipo, x/y, estado inicial. Sin drag&drop/editor visual (eso es HU-4.01). Respetar la arquitectura de `libs` (feature → model/data/ui).                                                                                    |
| **MAP-118** | Integrar formulario de SpaceElement con API     | ⬚ Pendiente (frontend). Sustituir mocks por el `api-client` generado del contrato, gestionando loading/éxito/error, sin HTTP directo en los componentes.                                                                                                           |
| **MAP-119** | Test de integración de API de SpaceElement      | ✅ Existentes en backend: `SpaceElementApiIntegrationTest` (8 tests: alta, consulta, persistencia, validación, 4xx) + `SpaceElementTenantIsolationIntegrationTest` (4: aislamiento Tenant→Sector, FK huérfana). Viven en `bootstrap` y corren con `pnpm be:it`/CI. |

**Límites explícitos de esta asignación** (según las notas de Jira):

- **MAP-113** existe en Jira pero **no está asignada a Matias**; además solapa a MAP-111
  (mismo artefacto real). No se lista aquí como tarea de Matias ni se implementa dos veces.
- Las validaciones críticas (tenant, sector, tipo, coordenadas) y la RLS multi-tenant
  viven **siempre en backend**; el frontend solo ilustra los mismos errores del contrato.
- La dependencia con HU-3.01/HU-3.02 ya está registrada en `spec.md` §6 RN-5; no se
  implementa nada de esas historias aquí.
- Esta actualización de la especificación **no incluye cambios de código de producción**:
  solo añade esta sección de trazabilidad.

---

## Notas de ejecución

> Se rellenan **durante** la ejecución, no al final.

### Qué se construyó (2026-09-23)

- Dominio `SpaceElement` réplica del patrón `Sector`: record inmutable, `SpaceElementId`,
  `SpaceElementType`, `SpaceElementTypePolicy` (RN-4: ROOM solo hotel, SEAT solo event_hall,
  resto comunes) y puerto `SpaceElementRepository`.
- Estado reutiliza `com.mapit.shared.realtime.SpaceElementState` del shared-kernel (el pull
  a main del merge de "realtime outbox" trajo el enum; V11 quedó ocupada por ese outbox, así
  que la migración quedó como V12).
- Migración `V12__crear_tabla_space_element.sql` + DBML en el mismo commit (regla dura).
- Adaptador con RLS por transacción (`set_config('app.tenant_id', ?, true)`), igual que
  `SectorPersistenceAdapter`.
- Casos de uso `Create`, `Update`, `SpaceElementQueryService` (lista y detalle) + soporte
  compartido `SpaceElementSupport` (resuelve sector→floor→establishment y la policy).
- Controller `SpaceElementController` bajo `/api/v1`, Problem Details RFC 9457.

### Hallazgos de la revisión independiente (y cómo se corrigieron)

- Seguridad MEDIUM: payload con `type` válido pero sin `x`/`y` provocaba NPE → 500 en vez
  de 400. Corregido: el dominio ya lanza `IllegalArgumentException` con prueba de regresión.
- Seguridad HIGH documentada (no corregida en esta HU): rutas `/sectors/**` siguen públicas
  con fallback `demo` hasta CU-23/CU-24 — igual que el resto de CU-04/05. Queda DCHO en el
  informe final y referencia en la spec.
- Backend MEDIUM: GET por id filtraba la lista en el controller → extraído a
  `SpaceElementQueryService.byId(sectorId, elementId)` con el puerto del repositorio.
- Backend MEDIUM: `parseType` duplicado en create/update → centralizado en `SpaceElementSupport`
  (que ahora es un bean `@Service`, inyectado).
- Backend INFO: Javadoc de `SpaceElementType.BAR` decía "restaurante/discoteca" pero la
  policy lo admite en cualquier vertical → Javadoc alineado a la policy real.
- Backend INFO sin acción: doble escritura de `updated_at` (dominio + trigger) — la fuente
  final es el trigger, igual que en `sector`/`floor`; no se cambia para no romper el patrón.
- Seguridad LOW: CHECK de BD no cubre `NaN`/`Infinity`; la capa Java sí (`Double.isFinite`).
  Documentado como deuda conocida en `V12` (un CHECK extra requeriría otra migración).

### Divergencia Jira vs. implementación (registrada)

- Jira pedía `PUT /api/v1/sectors/{id}/elements`. El patrón del proyecto pone el id del
  recurso en el path, así que el endpoint real es `PUT /api/v1/sectors/{sectorId}/elements/{elementId}`
  (reemplazo completo, como Establishment/Sector). La misma decisión en `GET` y lista.
