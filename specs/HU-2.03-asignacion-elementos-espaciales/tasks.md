# HU-2.03 — Tareas

> Generadas desde `plan.md`. Cada tarea es ejecutable y verificable.
> Solo backend (alcance Foggi). HU relacionada en Jira: MAP-109.

## Orden de ejecución

- [ ] **T1 — Contrato.** Añadir a `openapi.yaml` las 3 rutas (`POST/GET/PUT/DELETE menos el
    DELETE`), los schemas `SpaceElement`, `SpaceElementCreateRequest`,
      `SpaceElementUpdateRequest` y las respuestas compartidas (400/401/404/500).
      _Verificación:_ `pnpm api:lint` verde y `pnpm api:gen` regenera sin drift.

- [ ] **T2 — Migración.** `pnpm db:new "crear tabla space_element"` → `V12_…sql`
      (V11 quedó tomada por el outbox realtime después del pull de main)
      con `tenant_id`, FK a `sector ON DELETE RESTRICT`, checks de no-negatividad,
      índice `(tenant_id, id)`, índice parcial de vivos, trigger `touch_updated_at`,
      `enable_tenant_isolation('space_element')`. Actualizar `docs/db/mapit.dbml`
      en el mismo commit.
      _Verificación:_ `pnpm be:build` arranca con `ddl-auto: validate` y Flyway en verde.

- [ ] **T3 — Dominio.** `SpaceElement` (record), `SpaceElementId`, `SpaceElementType`,
      `SpaceElementTypePolicy` y puerto `SpaceElementRepository`. El estado es el
      `SpaceElementState` de shared-kernel; no se reiventan `ElementState`.
      Sin Spring ni JPA (ArchUnit lo vigila).
      _Verificación:_ tests unitarios `SpaceElementTest` y `SpaceElementTypePolicyTest`
      en verde dentro de `spaces-domain`.

- [ ] **T4 — Casos de uso.** `CreateSpaceElementUseCase`, `UpdateSpaceElementUseCase`,
      `SpaceElementQueryService`, con validación de jerarquía
      tenant→establishment→floor→sector antes de persistir. `SpaceElementNotFoundException`.
      _Verificación:_ tests con repositorios en memoria (patrón CU-05) pasando.

- [ ] **T5 — Adaptadores.** Entidad JPA, Spring Data repo (queries con `tenantId`),
      adaptador con `setDatabaseTenant`, y `SpaceElementController` con Problem Details.
      _Verificación:_ integración con Testcontainers cubriendo CA-1…CA-8 y test de
      aislamiento CA-9. `pnpm be:test` y `pnpm be:it` en verde.

- [ ] **T6 — Cierre.** `pnpm check` en verde, criterios de `spec.md` marcados,
      `docs/db/mapit.dbml` actualizado, notas de ejecución escritas.

## Trazabilidad con Jira

| Subtarea    | Enunciado en Jira                      | Artefacto real                                                                                 | Tarea  |
| ----------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- | ------ |
| **MAP-110** | Crear entidad SpaceElement             | Dominio + JPA                                                                                  | T3, T5 |
| **MAP-111** | Crear migración Flyway                 | `V11_…sql`                                                                                     | T2     |
| **MAP-112** | Implementar entidad SpaceElement       | **Duplicada de MAP-110** — es el mismo artefacto (la entidad). Se cierra con la misma entrega. | —      |
| **MAP-113** | Crear migración Flyway de SpaceElement | **Duplicada de MAP-111** — mismo artefacto (la migración `V11`).                               | —      |
| **MAP-114** | Implementar SpaceElementService        | `SpaceElementQueryService` + use cases                                                         | T4     |
| **MAP-115** | Implementar endpoint de SpaceElement   | `SpaceElementController`                                                                       | T1, T5 |

**Duplicados detectados:** MAP-110 ≡ MAP-112 (ambos piden la entidad con los mismos
campos) y MAP-111 ≡ MAP-113 (ambos piden la misma migración Flyway con los mismos
criterios: FK a sector, tenant_id, índices, integridad). No se implementa dos veces;
con la entrega de T2/T3/T5 quedan cubiertos los 4 tickets. No se cierra ni se
modifica Jira desde esta sesión; es tarea del equipo al revisar.

## Notas de ejecución

> Se rellenan **durante** la ejecución, no al final.

- (por llenar)
