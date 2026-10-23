# HU-4.01 — Plan técnico

> Se escribe **después** de que `spec.md` esté aprobada, y **antes** de tocar código.
> Las referencias §RN/CA/D remiten a `spec.md` de esta carpeta.

## 1. Enfoque

Una sola decisión ordena todo el plan: **no duplicar datos, sino lentes**. La vista de
planta y la vista de sector son dos contextos de edición sobre las mismas filas
(`floor`, `sector`, `space_element`); la "sincronización" del enunciado se resuelve por
diseño (RN-3), no con un motor de propagación. Eso exige: (1) dar al `floor` y al `sector`
columnas de geometría (hoy inexistentes), (2) un endpoint agregado de lectura y guardados
por lotes transaccionales con control optimista, (3) extender `MapLayout` con un modo
planta para reutilizar el único motor Konva, y (4) modelar la reutilización de sectores
como **duplicado explícito** (Prototype) en lugar de definiciones compartidas. Se descartó
la alternativa "SectorTemplate + instancias + overrides" por C-2/D-1: multiplica entidades
y reglas de merge sin necesidad de negocio comprobada, y choca con la identidad de mesa
que reservas y bitácora exigen.

## 2. Patrones de diseño aplicados

> **Sección obligatoria.** Catálogo: `docs/architecture/design-patterns.md`.

| Patrón            | Dónde                                          | Por qué aquí                                                                                                                                                                 | Alternativa descartada                                                                                                              |
| ----------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Ports & Adapters  | Ya existente: `MapEnginePort`, repositorios    | La arquitectura ya lo impone: el nuevo modo planta vive detrás del mismo puerto (ADR-0006) y los repos usan puertos existentes                                               | Inyectar Konva/HTTP directo en componentes: rompe regla dura y ADR-0006                                                             |
| Prototype         | Duplicado de sector (`DuplicateSector`)        | Clona la composición (sector + elementos) con identidad nueva; es la materialización exacta de RN-5                                                                          | Copia de JSON compartida (enlazada): rompe identidad de mesas (C-2) y exige motor de sincronización                                 |
| Composite         | Render del sector en la vista de planta        | El sector-colocado es un grupo (traslación+rotación) que contiene elementos en solo-lectura: tratar el conjunto igual que un nodo permite reusar selección y transformer     | Aplanar todos los elementos con offset calculado en cada frame: frágil y recalcula en cada render                                   |
| Repository (ext.) | Puertos de `Floor`/`Sector` + lectura agregada | El caso de uso expresa _qué_ necesita (layout completo de una planta) sin saber cómo se une en SQL                                                                           | Fan-out N+1 desde el frontend: ya identificado como hueco (spec §1.2-4)                                                             |
| Value Object      | `Geometry`/`Placement` en `spaces-domain`      | Encapsula `x,y,width,height,rotation` con sus invariantes (`≥0`, `≥20`, rotación normalizada) una sola vez, evitando los checks sueltos duplicados que hoy tiene el frontend | Cinco `double` sueltos con validaciones repetidas por endpoint: es exactamente el smell actual (`clampPosition`, CHECKs V12, store) |

**No se aplican deliberadamente:** Command/undo (fuera de alcance), Memento (no hay
versionado de layout en esta HU), Abstract Factory (las plantillas siguen siendo
`{name, type}` — no hay configuración rica que fabricar).

## 3. Cambios en el contrato API

- [ ] Editar `packages/api-contract/openapi.yaml` **primero**; `pnpm api:gen` después.
- [ ] Todas las rutas bajo `/api/v1/`; errores RFC 9457 con `operationId`, `summary` y
      respuestas de error declaradas (reglas de `packages/api-contract/AGENTS.md`).

| Método  | Ruta                                              | Descripción                                                                                                                                                                                 |
| ------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/floors/{floorId}/layout`                        | **Nuevo.** Lectura agregada: geometría de planta + sectores colocados (colocación + dimensiones) + elementos de cada sector (solo lectura).                                                 |
| PUT     | `/floors/{floorId}/layout`                        | **Nuevo.** Guardado por lotes transaccional de la planta: dimensiones del lienzo + colocaciones de sectores. Payload con `updatedAt` base por recurso → 409 con lista de conflictos (RN-7). |
| PUT     | `/sectors/{sectorId}/layout`                      | **Nuevo.** Guardado por lotes de la distribución interna: geometría del sector + elementos. Mismo control optimista.                                                                        |
| POST    | `/floors/{floorId}/sectors:duplicate`             | **Nuevo.** Duplica un sector del mismo tenant hacia esta planta: crea sector + clones de elementos con UUIDs nuevos (Prototype, RN-5).                                                      |
| DELETE  | `/sectors/{sectorId}/elements/{elementId}`        | **Nuevo.** Baja lógica del elemento (el dominio ya tiene `softDelete()`; solo faltaba exponerlo). 409 si tiene reservas activas.                                                            |
| GET/PUT | `/sectors/…` (existentes)                         | **Extendidos en respuesta**: `SectorResponse` incorpora `x, y, width, height, rotation` (lectura). Los CRUD existentes no cambian su body.                                                  |
| —       | `SpaceElementResponse`, schemas `Sector`, `Floor` | **Extendidos**: `floor` gana `canvasWidth/canvasHeight`; `sector` gana geometría; `SpaceElement` sin cambios (compatibilidad con reservas).                                                 |

Compatibilidad hacia atrás: columnas nuevas con defaults → clientes viejos del contrato
(public-web, operations) siguen funcionando; `api:check` vigila el drift.

## 4. Backend

**Módulo(s):** `spaces` (reservations/operations **no se tocan**; solo se garantiza por
test que sus tablas y flujos quedan intactos — CA-9/CA-10).

| Capa               | Qué se añade                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*-domain`         | VO `Geometry` (dimensiones intrínsecas) y `Placement` (colocación); `Floor` gana lienzo; `Sector` gana geometría+colocación con invariantes (RN-2/RN-10); puertos: `findFloorLayout(tenant, floorId)` (proyección agregada), `SectorRepository.saveAll`, `SpaceElementRepository.saveAll`, `softDelete` ya presente                                                  |
| `*-application`    | `GetFloorLayout`, `SaveFloorLayout` (transaccional + validación espacial contra el lienzo, RN-10, + conflicto optimista RN-7), `SaveSectorLayout` (ídem a nivel sector), `DuplicateSector` (transaccional: sector + clones con `SpaceElementId.generate()`, reutiliza la validación de vertical por tipo; 404 indistinguible si el fuente es ajeno)                  |
| `*-infrastructure` | Adaptador JDBC/JPA de la lectura agregada (join `floor → sector → space_element` filtrando `tenant_id` + `deleted_at IS NULL`); controllers: `FloorLayoutController`, extensión de `SectorController`, `DuplicateSector` bajo `/floors`; Problem types nuevos en `SpacesProblemTypes` (`layout-conflict`, `element-out-of-bounds`, `sector-has-active-reservations`) |

Reglas duras respetadas: dominio sin Spring/JPA/Jackson; application no ve
infrastructure; versiones en el catalog (`gradle/libs.versions.toml`).

## 5. Base de datos

- [ ] `pnpm db:new "geometria de planta y sector"` — **una sola migración**:

| Tabla    | Columnas nuevas (todas `DOUBLE PRECISION NOT NULL` con default)                               | Notas                                                                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `floor`  | `canvas_width DEFAULT 1200`, `canvas_height DEFAULT 800`                                      | Lienzo rectangular (D-2). CHECK `> 0`.                                                                                                                                                  |
| `sector` | `x DEFAULT 0`, `y DEFAULT 0`, `rotation DEFAULT 0`, `width DEFAULT 800`, `height DEFAULT 600` | CHECK `x,y ≥ 0`, `w,h ≥ 20` (simetría con `space_element`). La migración reparte en grilla los sectores vivos existentes (col*20 + 40) para que ninguna planta quede visualmente vacía. |

- Sin tablas nuevas → sin `enable_tenant_isolation()` adicional: RLS ya cubre `floor` y
  `sector`. Índices existentes `(tenant_id, id)` intactos.
- **Migración de datos existentes (item 17 del enunciado):** solo defaults + grilla
  determinista; las coordenadas internas de elementos no se tocan (siguen siendo válidas
  porque `width/height` de sector por defecto (800×600) cubren el clamping previo de
  1200×800 en la mayoría de casos; los sectores con elementos más allá quedan
  marcados por la validación al primer guardado — CA-7).
- [ ] `docs/db/mapit.dbml` actualizado en el **mismo** commit (regla de `docs/AGENTS.md`).
- [ ] Corrección documental C-1: nota en `spec.md` de CU-06 (RN-3 desactualizada).

## 6. Frontend

**App:** `console` · **Feature:** `map-editor` (se extiende; no se crea otra feature —
regla "una feature no importa de otra").

| Parte                | Qué se añade                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model/` (ViewModel) | `floor-editor-store.ts` (nuevo): layout agregado, colocaciones, biblioteca, guardado por lotes con estados `saving/conflict/rollback`; `map-editor-store.ts` (existente): dimensiones reales del sector (adiós `DEFAULT_SECTOR_SIZE`), drag&drop de plantillas con coordenadas de drop, delete de elemento          |
| `ui/`                | `floor-editor-page.ts` (nuevo, ruta `/spaces/floors/:floorId/editor`), biblioteca (`sector-library.ts`, panel HTML accesible con origen de drag), integración de drop en `map-editor-page.ts`; navegación cruzada planta↔sector con query param de retorno                                                          |
| `data/`              | `map-editor-api.ts` extendido: `getFloorLayout`, `saveFloorLayout`, `saveSectorLayout`, `duplicateSector`, `deleteSpaceElement`                                                                                                                                                                                     |
| `libs/map-engine`    | `MapLayout` extiende: `kind: 'floor'\|'sector'`, `sectors: readonly SectorPlacement[]` (solo en modo floor); `MapEnginePort` añade: `onSectorDragEnd`, `onSectorClick`, `onExternalDrop` (paleta→canvas con coordenadas) — el adaptador Konva materializa el sector como `Konva.Group` compuesto (patrón Composite) |

- Konva sigue confinado al adaptador (regla ESLint); zoneless intacto; strings al
  catálogo `STRINGS.spaces.*` (nada hardcodeado); `@if/@for`, `inject()`, `protected` para
  miembros de plantilla — reglas de `apps/console/AGENTS.md`.
- Estados de carga/error/guardado/recuperación (item 12): `loading` (esqueleto del
  lienzo), `error` con toast + acción reintentar, `saving` (indicador existente),
  `conflict` (409 → diálogo "recargar / conservar borrador en memoria y reaplicar").
- Accesibilidad de la biblioteca: lista navegable por teclado con "colocar" como acción
  alternativa al drag (el drop es una aceleración, no el único camino).

## 7. Feature toggle

- ~~Clave nueva `map-editor.floor`~~ **Decidido en ejecución (2026-10-12): sin flag.** La
  vista de planta es una ruta nueva sin degradación para el usuario actual: una flag era
  indirección innecesaria y añadía un punto de fallo de runtime al E2E (ver nota en
  `tasks.md`). El enum del backend (`FeatureFlag.MAP_EDITOR_FLOOR`) queda sin referencia y
  se limpia en un commit aparte del equipo de backend (no se toca `apps/backend` aquí).

## 8. Testing

| Nivel              | Qué se prueba                                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (dominio)     | Invariantes de `Geometry/Placement` (negativos, `< 20`, rotación); reglas de `DuplicateSector` (UUIDs nuevos, misma geometría interna, capacidad copiada)                                            |
| Unit (application) | `SaveFloorLayout`/`SaveSectorLayout`: validación espacial (RN-10), conflicto optimista (RN-7), transaccionalidad simulada con puertos fake                                                           |
| Integración        | Testcontainers: lectura agregada CA-1; inmutabilidad de elementos al mover sector CA-2; duplicado CA-5; reserva intacta tras mover mesa CA-9; `state` intacto CA-10; DELETE con reserva activa → 409 |
| Aislamiento tenant | **Obligatorio** (CA-6/CA-13): duplicar/listar layout de otro tenant → 0 filas/404 bidireccional; sin tenant → 0 filas (falla cerrado)                                                                |
| Contrato           | `pnpm api:check` sin drift; Prism sirve los endpoints nuevos                                                                                                                                         |
| Frontend (Vitest)  | Stores sin renderizar: `floor-editor-store` (guardado por lotes, conflicto 409, rollback), `map-editor-store` (drop→create en coordenadas, delete, dimensiones reales)                               |
| E2E (Playwright)   | Un solo flujo completo por regla de `apps/e2e/AGENTS.md`: abrir planta → colocar sector → editar sector → drop de plantilla → guardar → recargar → todo persiste (CA-12); selectores por rol/testid  |

## 9. Riesgos

| Riesgo                                                                  | Mitigación                                                                                                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R-1: ADR-0006 sigue _Propuesto_ y esta HU profundiza la inversión Konva | Explicitar en el ADR (nota de progreso) que el modo planta se construye igualmente detrás del puerto; si llega un SDK, el mapper cubre `SectorPlacement` que es modelo nuestro |
| R-2: Lectura agregada pesada en plantas grandes (cientos de elementos)  | Una query con 2 joins filtrada por tenant; sin paginación por diseño (el lienzo es finito). Medir; si duele, `sectorId → elementos` como segunda llamada paralela              |
| R-3: Conflictos de escritura entre editors y operaciones (state)        | Escritores disjuntos por columna (RN-9) + control optimista solo sobre geometría; `operations` nunca toca las columnas nuevas                                                  |
| R-4: Migración de sectores existentes "colocados" en grilla             | Grilla determinista en la migración + validación al primer guardado (CA-7); no bloquea: cualquier valor default es renderizable                                                |
| R-5: `permitAll` transitorio en spaces (seguridad)                      | Inventario de endpoints nuevos entregado a CU-24; el aislamiento real ya lo garantiza RLS + demo-tenant fallback mientras tanto                                                |
| R-6: Scope creep (polígonos, undo, labels)                              | Fuera de alcance explícito (spec §8) y decisiones D-2/D-3/D-4 registradas con recomendación                                                                                    |

## 10. Plan de implementación por fases (entregas pequeñas y verificables)

> Orden por dependencia real, no por lista de archivos. Cada fase cierra con sus tests
> verdes y es desplegable detrás de la flag.

| Fase | Entrega                                                                       | Valor observable al cerrar                                                              | Depende de |
| ---- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------- |
| E1   | Contrato + migración + lectura agregada (`GET layout`)                        | `api:check` verde; migración aplica; endpoint devuelve planta completa (CA-1 en API)    | —          |
| E2   | Vista de planta read-only + navegación a sector                               | El usuario ve la planta con sectores colocados y entra al editor de sector (CA-1, CA-3) | E1         |
| E3   | Guardados por lotes + colocación/transformación de sectores                   | Mover/rotar sectores y editar lienzo persisten (CA-2, CA-8, RN-2)                       | E2         |
| E4   | Drag & drop de plantillas + DELETE de elemento + dimensiones reales de sector | El flujo F2/F4 completo dentro del sector (CA-7, CA-11)                                 | E1         |
| E5   | Duplicado de sector + biblioteca                                              | Reutilización sin reconstruir (F3, CA-5, CA-6)                                          | E3         |
| E6   | Cierre: aislamiento completo, E2E, dbml, corrección C-1, flag                 | `pnpm check` verde; CA-1…CA-14 verificados; spec CU-06 corregida                        | E1–E5      |

Archivos previsiblemente afectados: `packages/api-contract/openapi.yaml` + generados;
`apps/backend/modules/spaces/**` (+ `bootstrap` wiring); una migración en
`apps/backend/bootstrap/src/main/resources/db/migration`; `docs/db/mapit.dbml`;
`libs/map-engine/src/lib/**` (modelo + puerto + adaptador Konva);
`apps/console/src/app/features/map-editor/**`; `apps/console/src/app/app.routes.ts`;
catálogo `STRINGS`.
