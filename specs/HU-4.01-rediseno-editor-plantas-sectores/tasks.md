# HU-4.01 — Tareas

> Se generan desde `plan.md`. Cada tarea debe ser **ejecutable y verificable**:
> al terminarla, algo observable cambia (un test pasa, un endpoint responde).
> Fases E1–E6 del plan §10.

## Orden de ejecución

- [x] **T1 — Contrato (E1).** ✅ `openapi.yaml`: GET/PUT layouts, duplicar, DELETE
      elemento, schemas extendidos. `api:lint`/`api:gen`/`api:check` verdes.

- [x] **T2 — Migración (E1).** ✅ V18 aplica limpio (`db:info` la muestra Success);
      `docs/db/mapit.dbml` actualizado; backfill en grilla determinista.

- [x] **T3 — Dominio (E1/E4/E5).** ✅ `Placement`/`Geometry` con invariantes;
      `Floor.resizeCanvas`, `Sector.moveTo`/`resize`; proyecciones `FloorLayout`/
      `SectorLayout` + puerto `LayoutQueryRepository`. Tests de dominio verdes (26/26).

- [x] **T4 — Casos de uso (E1/E3/E4/E5).** ✅ `GetFloorLayout`, `SaveFloorLayout`,
      `SaveSectorLayout`, `DuplicateSector`, `DeleteSpaceElement` (+ excepciones).
      `LayoutUseCasesTest` 12/12 en verde con puertos en memoria.

- [x] **T5 — Adaptadores (E1/E3/E4/E5).** ✅ Entidades JPA con columnas nuevas,
      lectura agregada por composición de puertos, `FloorLayoutController` /
      `SectorLayoutController`, DELETE con guarda de reservas, wiring en bootstrap
      (`SpacesWiring`), problem types nuevos. `FloorLayoutApiIntegrationTest` 5/5.

- [x] **T6 — Aislamiento tenant (E5).** ✅ En aplicación: otro tenant → 404
      (duplicado y lectura). En BD: las columnas nuevas heredan RLS de `floor`/`sector`
      (sin tabla nueva, regla §5 del plan — no se abre superficie de aislamiento nueva).

- [x] **T7 — map-engine (E2/E3).** ✅ `MapLayout.kind` + `SectorPlacement` + eventos
      (`onSectorDragEnd/RotateEnd/Click/onExternalDrop`), sector como `Konva.Group`
      compuesto, transformer solo-rotación. `pnpm fe:typecheck` ✓.

- [x] **T8 — ViewModel (E2/E3/E4).** ✅ `floor-editor-store` (lotes + conflictos 409 +
      duplicado desde biblioteca) y extensión de `map-editor-store` (dimensiones reales,
      `createElementFromDrop`, `deleteElement`). Vitest 33/33.

- [x] **T9 — UI y rutas (E2/E3/E5).** ✅ `floor-editor-page` + ruta
      `/spaces/floors/:floorId/editor`, biblioteca con drag & drop, navegación cruzada
      sector↔planta, strings nuevas. ~~flag `map-editor.floor`~~ **sin flag** (D-6
      revertida en ejecución: página nueva sin riesgo; la flag añadía un punto de fallo).

- [x] **T10 — E2E (E6).** `apps/e2e/tests/console/floor-editor.spec.ts` verde contra el
      stack real (12.8s): login de tenant creado por API + activación Mailpit → planta
      con lienzo → biblioteca de sectores → duplicado (POST 201) → editor del sector →
      recarga persiste. Seeding con el JWT del tenant nuevo (sin el header caía al
      fallback demo y el layout devolvía 404 — aprendizaje registrado abajo).

- [x] **T11 — Cierre (E6).** `pnpm check` completo ✓; CA marcados en `spec.md`;
      C-1 corregida en `specs/CU-06-editor-visual-elementos/spec.md`; nota de progreso en
      ADR-0006; ~~`map-editor.floor` con fecha de retiro~~ retirada pre-merge (D-6).

## Notas de ejecución

> Decisiones tomadas sobre la marcha (registradas también en el ledger
> `.superpowers/sdd/HU-4.01-…/progress.md`).

- **Tamaños y rotaciones con AABB:** un sector rotado 45° no cabe sólo por caber sin
  rotar. `Placement.fitsIn` usa la caja envolvente rotada (misma f forma que el clamping
  del adaptador Konva); el IT `guardar_layout_mueve…` usa rotation=0 porque con 45° un
  sector 800×600 no cabe en un lienzo 1600×900. Dominio correcto, expectativa ajustada.
- **Fakes en `LayoutUseCasesTest`:** el repositorio en memoria reordena al guardar
  (removeIf+add); las aserciones buscan por id, no por índice.
- **`GeometryTest` corregido del lado del test, no del código:** una caja 100×50 en
  (100,0) cabe exactamente en 200×200 (borde incluido).
- **FK `reservation.created_by`:** referencia `app_user(tenant_id, id)` — el IT siembra el
  usuario antes de crear reservas.
- **Puerto cross-módulo:** `SpaceElementReservationLookup` lo cablea `bootstrap` sobre
  `ReservationAvailabilityRepository` (regla: los módulos no se importan entre sí).
- **Duplicado y colocación:** la copia nace en el origen y la vista la coloca en el punto
  del drop guardando de inmediato (una operación visible, un solo guardado).
- **Compatibilidad de constructores:** `Sector`/`Floor` viejas llamadas siguen compilando:
  los constructores existentes delegan a los nuevos con defaults (nadie tuvo que tocar
  HU-2.03/CU-05 para que esto entrara).

## Sobre el alcance real vs. el plan

- El editor de sector sigue guardando **por elemento** con debounce (RN-7 fallback fino);
  el guardado por lotes cubre la **planta**. El PUT por lotes del sector existe y puede
  adoptarse después sin tocar el contrato.
- La biblioteca del sector arrastra `tpl:<id>` y `base:<TYPE>`; la de la planta arrastra
  `sector:<id>` (duplicado). Todo persiste, nada depende de recarga silenciosa.
- Fueron explícitamente fuera y quedaron registrados: `label` de mesa (D-4),
  `TYPE_DEFAULTS` en backend (D-5), polígono de planta (D-2).
