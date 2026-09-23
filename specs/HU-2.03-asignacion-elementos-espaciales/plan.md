# HU-2.03 — Plan técnico

> Escrito después de `spec.md`, antes de tocar código. Respeta `apps/backend/AGENTS.md`:
> dominio sin Spring/JPA, puertos en `*-domain`, rutas `/api/v1`, Problem Details (RFC 9457),
> contrato primero, migración Flyway con RLS.

## 1. Enfoque

Réplica del patrón que ya funciona en `Sector`/`Floor` (CU-05): record de dominio
inmutable + puerto en `spaces-domain`, casos de uso `@Service`/`@Transactional` en
`spaces-application`, y adaptadores JPA + REST en `spaces-infrastructure`. El tenant
sale de `TenantContext.require()`; la validación de jerarquía se resuelve cargando el
sector **scoped al tenant** (`SectorRepository.findAliveById`). Alternativa descartada:
guardar listas de elementos dentro del sector cuadruplica el acoplamiento y rompe la
granularidad que necesitará el editor (HU-4.01).

## 2. Patrones de diseño aplicados

| Patrón                                   | Dónde                                                                                | Por qué aquí                                                                               | Alternativa descartada                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Value Object**                         | `SpaceElementId`, reutilizados `TenantId`, `AuditTrail`                              | Encapsula formato e invariantes junto a la identidad                                       | `String/UUID` sueltos por firmas: perder validación e id tipado         |
| **Entity de dominio (record inmutable)** | `SpaceElement`                                                                       | Constructor compacto como única vía de validez; mutaciones devuelven copia                 | Mutable JPA desde el principio: invita a estados parcialmente inválidos |
| **Repository (puerto/adaptador)**        | `SpaceElementRepository`                                                             | El dominio declara qué necesita; JPA en infraestructura                                    | Spring Data inyectada en application: fuga de capas                     |
| **Use Case per operation**               | `CreateSpaceElementUseCase`, `UpdateSpaceElementUseCase`, `SpaceElementQueryService` | Un `@Transactional` por caso, igual que CU-05                                              | Un mega-service con todo (`SpaceElementService` gigante)                |
| **Policy** (regla de vertical)           | `SpaceElementTypePolicy` en dominio                                                  | Criterio “qué tipos de elemento admite un vertical” es negocio puro y testeable sin Spring | Validarlo en el controller o con `@Lazy` en infraestructura             |

Catálogo: `docs/architecture/design-patterns.md`.

## 3. Cambios en el contrato API

- [x] Editar `packages/api-contract/openapi.yaml` **primero** → `pnpm api:lint` → `pnpm api:gen`.
- Todas las rutas bajo `/api/v1`; errores con el esquema `Problem` compartido.

| Método | Ruta                                       | Descripción                                                                   |
| ------ | ------------------------------------------ | ----------------------------------------------------------------------------- |
| POST   | `/sectors/{sectorId}/elements`             | Crear elemento; 201 + resumen. `initialState` opcional (default `AVAILABLE`). |
| GET    | `/sectors/{sectorId}/elements`             | Lista de elementos vivos del sector (consulta de MAP-114).                    |
| GET    | `/sectors/{sectorId}/elements/{elementId}` | Detalle (404 si ajeno/inexistente).                                           |
| PUT    | `/sectors/{sectorId}/elements/{elementId}` | Reemplazo de campos editables (`type`, `x`, `y`). 200.                        |

Schemas nuevos: `SpaceElement`, `SpaceElementCreateRequest`, `SpaceElementUpdateRequest`.

> **Suerte de PUT:** el proyecto usa reemplazo completo (Establishment/Sector tienen
> `Update*Request` con todos los editables). El estado **no** viaja en el body del PUT
> porque su transición auditada pertenece a HU-3.01; se conserva.

## 4. Backend

**Módulo:** `spaces`.

| Capa                    | Qué se añade                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spaces-domain`         | `SpaceElement` (record), `SpaceElementId`, `SpaceElementType` (enum catálogo), `SpaceElementTypePolicy` (tipos permitidos por vertical), `SpaceElementRepository` (puerto). El catálogo de estados NO se reimplementa: se reutiliza `com.mapit.shared.realtime.SpaceElementState` del shared-kernel (ya mergeado en `main`) para no inventar un segundo catálogo. |
| `spaces-application`    | `CreateSpaceElementCommand`, `UpdateSpaceElementCommand`, `SpaceElementResponse`, `CreateSpaceElementUseCase`, `UpdateSpaceElementUseCase`, `SpaceElementQueryService`; excepciones `SpaceElementNotFoundException` y reutiliza `SectorNotFoundException`.                                                                                                        |
| `spaces-infrastructure` | `SpaceElementJpaEntity`, `SpaceElementSpringDataRepository` (queries con `tenantId`), `SpaceElementPersistenceAdapter` (con `setDatabaseTenant`), `SpaceElementController` (`@RequestMapping("/api/v1")`, records de request/response y `@ExceptionHandler` → ProblemDetail).                                                                                     |

**Validación de jerarquía (RN-1/RN-2):** el caso de uso carga el sector con
`findAliveById(tenantId, sectorId)`; si está vacío → `SectorNotFoundException` (404).
El vertical del establecimiento se obtiene desde el sector → `floorId` →
`FloorRepository.findAliveById` → `establishmentId` → `EstablishmentRepository.findAliveById`.
Tipos válidos = `SpaceElementTypePolicy.typesElegibles(establishment.type())`.

## 5. Base de datos

- [x] Migración `V12__crear_tabla_space_element.sql` con `pnpm db:new "crear tabla space_element"`.
      Nota: `V11` ya fue tomada tras el merge de la rama de realtime
      (`V11__crear_realtime_event_outbox.sql` en main, MAP-103/HUT-01).

```sql
CREATE TABLE space_element (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenant(id),
  sector_id UUID NOT NULL REFERENCES sector(id) ON DELETE RESTRICT,
  type TEXT NOT NULL,
  state TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  -- auditoría y baja lógica igual que sector/floor (patrones V6/V7)
  ...
);
CREATE INDEX space_element_tenant_id_id_idx ON space_element (tenant_id, id);
CREATE INDEX space_element_tenant_sector_vivos_idx ON space_element
  (tenant_id, sector_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE TRIGGER space_element_touch_updated_at ...;
SELECT enable_tenant_isolation('space_element');
```

- Checks: `space_element_coords_non_negative` (`x >= 0 AND y >= 0`), tipos/estados
  validados por enum en Java (columnas como `TEXT`, igual que `sector.slug`: el check
  estricto vive en dominio para no acoplar la tabla a cambios de catálogo).
- [x] `docs/db/mapit.dbml` actualizado en el mismo commit (alinear el borrador actual de
      `space_element` con la forma real).

## 6. Frontend

**App:** ninguna — fuera de alcance (lo hace otro integrante dentro de HU-2.03; el
editor visual es HU-4.01). Se documenta que `libs/map-engine` ya define el modelo TS
(`SpaceElement`, `SpaceElementType`, `ElementState`) al que debe ajustarse el futuro
consumo, sin código nuevo aquí.

## 7. Feature toggle

- [x] No va detrás de una flag: es carga de catálogo base que presupone autenticación del
      staff; cuando CU-24 complete autorización, el endpoint se rige por la política de
      denegar por defecto ya vigente.

## 8. Testing

| Nivel                        | Qué se prueba                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit (dominio)               | `SpaceElementTest`: invariantes del constructor, register/update/softDelete; `SpaceElementTypePolicyTest`: vertical↔tipos.                                                                                   |
| Integración (Testcontainers) | `SpaceElementIsolationIntegrationTest` (CA-9, patrón de pisos/sectores). API REST del controller con `RestTestClient` montado sobre el contexto completo, cubriendo CA-1…CA-8 contra Postgres de contenedor. |
| Aislamiento tenant           | Obligatorio: rol `mapit_rls_test` sin bypass RLS.                                                                                                                                                            |
| Migraciones                  | `pnpm be:it` debe arrancar con V10, V11 y V12 aplicadas limpio.                                                                                                                                              |

## 9. Riesgos

| Riesgo                                                                          | Mitigación                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Sector sin dimensiones → imposible validar límites superiores de x/y            | Documentado en `spec.md` §6 RN-6 y nota en `SpaceElement`; se añade cuando el sector tenga tamaño |
| Catálogo de tipos y mapping de vertical son criterio inicial y CU-07 los refina | `SpaceElementTypePolicy` como un único punto de cambio documentado                                |
| Cliente envía `tenantId`/`sectorId` distintos del contexto                      | Contrato no admite `tenantId`; service re-verifica sector scoped al tenant actual                 |
| `PUT` pisotea el estado                                                         | `state` no es editable por el PUT de esta entrega (lo detallará HU-3.01)                          |
