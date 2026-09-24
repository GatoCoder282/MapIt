# Auditoría estructural de `spaces/application` — HU-2.03

> Realizada antes de la implementación de SpaceElement (regla: **no copiar la deuda
> existente**). Solo lectura; los cambios aplicados a SpaceElement van descritos al final.

## Estructura actual (previa)

```
spaces/
├── domain/          (records inmutables: Establishment, Floor, Sector, Slug, AuditTrail,
│                     puertos *Repository)  — sin Spring/JPA (ArchUnit)
├── application/     (30 archivos planos) ← el foco
└── infrastructure/  (JPA + controllers REST con ProblemDetail)
```

## Los 30 archivos, clasificados

| Estilo                                                   | Archivos                                                                                                                                        | Patrón                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Sector (CU-05) — **use-case-per-operation**              | CreateSectorUseCase, GetSectorByIdUseCase, GetSectorsByFloorUseCase, UpdateSectorUseCase, DeleteSectorUseCase + commands/response + excepciones | patrón moderno: un `@Service` por operación, Response desde application |
| Floor/Establishment (CU-04/05) — **servicio monolítico** | FloorService (232 líneas), EstablishmentService                                                                                                 | patrón legacy: devuelve dominio, el controller mapea                    |
| DemoItem                                                 | DemoItemService                                                                                                                                 | scaffolding de prueba del stack                                         |
| Identity (referencia externa, 7 archivos)                | —                                                                                                                                               | use-case-per-operation — el estilo más limpio del repo                  |
| Platform (referencia externa, 8)                         | —                                                                                                                                               | servicio monolítico                                                     |

El patrón real no está escrito: **emerge por madurez del contexto** — los recientes
(identity, Sector, SpaceElement) usan use-case-per-operation; los legados (Floor,
Establishment, Tenant) usan servicios monolíticos.

## Problemas detectados

| Hallazgo                                                                                      | Severidad                  | Decisión                                                                               |
| --------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| `SectorResponse` mappeado 4 veces en use-cases (copia 1:1)                                    | high                       | lugar correcto pero no persistir el patrón; SpaceElement usa `fromDomain` centralizado |
| 5 use-cases con `Instant.now()` hardcodeado (era: `Clock` inyectable en EstablishmentService) | high (regresión en Sector) | corregido solo en SpaceElement (HU-2.03); Sector queda como deuda                      |
| `FloorService.generateSlugFromName` reimplementa `Slug.fromName`                              | medium                     | deuda documentada — Sector usa el VO canónico, Floor quedó atrás                       |
| `FloorService`/`EstablishmentService` devuelven dominio (layer-leak a infrastructure)         | medium                     | deuda de CU-04/05 — SpaceElement NO lo replica                                         |
| `FloorHasActiveSectorsException`: handler activo, throw comentado                             | medium                     | deuda — código muerto que promete un 409 inexistente                                   |
| Cabltura a mano de `SpaceElementSupport` de los 3 use-cases                                   | bajo                       | corregido elevándolo a `@Service`                                                      |

## Duplicaciones semánticas en `application`

No hay. El único duplicate real es interno al módulo (sector response × 4) y no aplica a
SpaceElement.

## Alternativas consideradas

### Alternativa 1 — Subcarpetas por aggregate (`application/sector/…`, `application/space-element/…`)

Pro: cohesión alta por entidad. Contra: rompe los imports en infrastructure + tests +
ArchUnit; ninguna otra parte del repo lo hace; movimiento cosmético sin ganancia real.

### Alternativa 2 — Subcarpetas por operación (`space-element/create/`, `space-element/update/…`)

Pro: navegación por acción. Contra: fragmentation extrema (los use-cases de SpaceElement
son 3; separarlos añade 3 directorios sin contenido distinto). Síntoma de "carpetas por
carpetas".

### Alternativa 3 — Dividir `SpaceElementQueryService` en 2 use-cases (tipo Sector)

Pro: consistencia textual con Sector. Contra: el servicio es una facade de solo lectura
del mismo aggregate; dividirlo añade classes sin contenido real.

**Ninguna de las tres** gana a la estructura plana actual — el contenido sí.

## Opción elegida

**Estructura plana, contenido consolidado** (sin reorganización de carpetas).

- La fragmentación no era de carpetas, era de contenido.
- Para SpaceElement (HU-2.03) se corrige lo mínimo:
  - `Clock` inyectable en los use-cases (patrón de `EstablishmentService`, no el anti-del Sector).
  - `SpaceElementResponse.fromDomain` centralizado (antes `CreateSpaceElementUseCase.toResponse`,
    reusado por Update + Query — mejor que las 4 copias de Sector).
  - `SpaceElementSupport` como `@Service` en vez de 3 constructores a mano.
- Para la deuda preexistente (Sector ×4 mappings, FloorService etc.): documentada, **no
  tocada** — regla §14/§15 del brief: no ampliar el refactor fuera de HU-2.03.

## Impacto de la reorganización

- `spaces/application` queda en 30 archivos (no se añaden ni quitan).
- SpaceElement adopta el estilo limpio moderno (use-case-per-operation + Clock + Response
  desde application) sin replicar la deuda legacy de Floor/Establishment.
- Cadenas de dependencia inalteradas: controllers → use-cases/query-service → puertos del
  dominio. Ningún rompimiento en infrastructure, tests ni ArchUnit.

## Deuda técnica a registrar (sin tocar)

- Sector: inyectar `Clock` en Create/Update/DeleteSectorUseCase (evitar `Instant.now()`).
- Sector: mover el mapper `SectorResponse` a `static fromDomain` en el DTO y borrar 4 copias.
- Floor: delegar `generateSlugFromName` a `Slug.fromName` (cuidado: `ñ`, revisión necesaria).
- Floor: elevar `FloorResponse`/`EstablishmentResponse` a application (y devolverlo desde el service).
- Floor: introducir `FloorRepository.existsAliveByLevel(…, exceptId)` y recuperar 25 líneas.
- Floor: eliminar `FloorHasActiveSectorsException` hasta CU-05 parte 2 (hoy es un 409 mentiroso).

## Commits relacionados

| Commit    | Qué                                                                     |
| --------- | ----------------------------------------------------------------------- |
| `8ee8f0f` | fix: coordenadas nulas → 400 (NPE→IAE); javadoc BAR alineado con policy |
| `35f81fe` | refactor: `SpaceElementSupport` como bean; `parseType` centralizado     |
| `013a2b7` | refactor: `Clock` inyectable + `fromDomain` en Response                 |
