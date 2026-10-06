# CU-06 — Plan técnico

> Se escribe **después** de que `spec.md` esté aprobada, y **antes** de tocar código.

## 1. Enfoque

Se crea una nueva feature Angular `map-editor` dentro de `apps/console/src/app/features/` (Integrante C). El editor se monta como ruta lazy bajo `/spaces/editor/:sectorId` (o `:establishmentId` con selector de sector). Usa el puerto `MapEnginePort` de `@mapit/map-engine` con su adaptador Konva.js. El ViewModel (`map-editor-store`) orquesta la carga del layout, las interacciones del usuario (drag/rotate/resize) y la persistencia vía `SpacesApiService.updateSpaceElement()`. **No se toca el backend**: los endpoints PUT y GET ya existen desde HU-2.03. El contrato OpenAPI no cambia en esta entrega (rotación y size no se persisten aún).

La navegación desde el resumen (`wizard-summary`) se hace pasando el `sectorId` del primer sector que tenga elementos (o el primero de la lista) como query param o path param. El `establishmentId` ya está en la URL del resumen.

---

## 2. Patrones de diseño aplicados

| Patrón                                   | Dónde                                                                                      | Por qué aquí                                                                                                                                | Alternativa descartada                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **MVVM (Model-View-ViewModel)**          | `features/map-editor/model/map-editor-store.ts`                                            | Separación estricta: el store (ViewModel) expone `signal`/`computed` y comandos; la UI solo bindea. Testeable sin render.                   | MVC clásico con servicios inyectados en componentes: acopla lógica a ciclo de vida y dificulta tests unitarios.   |
| **Adapter (Port/Adapter)**               | `@mapit/map-engine` → `MapEnginePort` + `KonvaMapEngine`                                   | El motor de renderizado (Konva) está detrás de un puerto. Cambiar a Seats.io u otro SDK solo requiere nuevo adaptador; features no cambian. | Importar `konva` directo en componentes: rompe ADR-0006, hace imposible cambiar de motor sin reescribir features. |
| **Command Pattern (implícito en store)** | Métodos `dragElement`, `rotateElement`, `resizeElement`, `saveElementPosition` en el store | Encapsula cada acción de edición como comando atómico con validación, clamping, optimismo y rollback.                                       | Lógica dispersa en event handlers del componente: inmanejable, no testeable, propenso a bugs de estado.           |
| **Optimistic UI con Rollback**           | `saveElementPosition` en store: actualiza local → API → si falla, revierte                 | Feedback instantáneo (<100ms) al usuario; consistencia eventual con backend. Si falla, UX no se rompe.                                      | Esperar respuesta del servidor antes de mover visualmente: latencia percibida alta, mala UX en editor gráfico.    |
| **Feature-first + Lazy Loading**         | `features/map-editor/` cargada perezosamente en ruta `/spaces/editor/...`                  | El bundle del editor (Konva) es pesado; no debe penalizar al resto de la consola (home, dashboard, etc.).                                   | Eager loading en `app.routes.ts`: bundle inicial > 500KB, TTI inaceptable en móviles.                             |

---

## 3. Cambios en el contrato API

- [x] **No hay endpoints nuevos ni modificados.** El editor usa `GET /sectors/{sectorId}/elements` (listar) y `PUT /sectors/{sectorId}/elements/{elementId}` (actualizar x, y, type) que ya existen en `openapi.yaml` (HU-2.03).
- [ ] `pnpm api:gen` **no requerido** para esta entrega (salvo que se regenere por otros motivos).

| Método | Ruta                                              | Descripción                                   |
| ------ | ------------------------------------------------- | --------------------------------------------- |
| GET    | `/api/v1/sectors/{sectorId}/elements`             | Listar elementos vivos del sector (ya existe) |
| PUT    | `/api/v1/sectors/{sectorId}/elements/{elementId}` | Actualizar tipo y coordenadas (ya existe)     |

---

## 4. Backend

**Módulo:** `spaces` (ya implementado en HU-2.03). **No se toca código backend en esta entrega.**

| Capa               | Qué se añade |
| ------------------ | ------------ |
| `*-domain`         | —            |
| `*-application`    | —            |
| `*-infrastructure` | —            |

---

## 5. Base de datos

- [ ] **No se requiere migración.** La tabla `space_element` (V12) ya tiene `x`, `y`, `type`, `state`, `tenant_id`, `sector_id` + RLS.
- [ ] `docs/db/mapit.dbml` **no cambia** en esta entrega (rotación y size se añadirán en CU-07/CU-08).

---

## 6. Frontend

**App:** `console` · **Feature:** `map-editor` (nueva carpeta)

### 6.1 Nueva ruta

En `apps/console/src/app/app.routes.ts` (bajo `children` de `spaces`):

```ts
{
  path: 'editor/:sectorId',
  loadComponent: () =>
    import('./features/map-editor/ui/map-editor-page').then(m => m.MapEditorPageComponent),
},
```

El `sectorId` viene de la navegación desde el resumen. El resumen ya tiene `establishmentId` en la URL y los sectores cargados en el `SpacesStore`.

### 6.2 Estructura de la feature

```
features/map-editor/
├── data/
│   └── map-editor-api.ts          # wrapper tipado sobre SpacesApiService para el editor
├── model/
│   ├── map-editor-store.ts        # ViewModel: signals, comandos, persistencia
│   └── map-editor-store.spec.ts   # tests Vitest del store (sin render)
└── ui/
    ├── map-editor-page.ts         # Componente contenedor: monta canvas, wiring store→port
    ├── map-editor-canvas.ts       # Componente fino: recibe MapEnginePort, expone eventos
    └── map-editor-toolbar.ts      # (opcional) barra de herramientas: zoom, undo, selector de sector
```

### 6.3 Flujo de datos

```
MapEditorPage (ui)
  ├─ inyecta MapEditorStore (model)
  ├─ inyecta MAP_ENGINE (port @mapit/map-engine)
  └─ en ngOnInit:
       1. store.loadSector(sectorId) → llama SpacesApiService.listSpaceElementsBySector
       2. store convierte SpaceElement[] → MapLayout (mapeo: x,y,type,state → position,size,rotation,label)
       3. port.mount(canvasHost, layout)
       4. port.layout (Signal) ↔ store.layout (signal) sincronización bidireccional
  └─ eventos del port (dragEnd, rotateEnd, resizeEnd) → store.saveElementPosition(id, x, y, rotation?, size?)
```

### 6.4 Mapeo SpaceElement (API) ↔ SpaceElement (MapLayout)

| API (SpaceElement) | MapLayout (SpaceElement)   | Notas                                                                      |
| ------------------ | -------------------------- | -------------------------------------------------------------------------- |
| `id`               | `id`                       | UUID string                                                                |
| `type`             | `type`                     | Enum compartido                                                            |
| `x`, `y`           | `position: {x, y}`         | Relativas al sector                                                        |
| `state`            | `state`                    | Enum compartido                                                            |
| —                  | `size: {width, height}`    | **Default por tipo** (ej. TABLE: 80×80, SEAT: 40×40). No viene de API hoy. |
| —                  | `rotation: number`         | **Default 0**. No viene de API hoy.                                        |
| —                  | `label: string`            | Generado: `${type} ${shortId}`                                             |
| —                  | `capacity: number \| null` | Default por tipo (TABLE: 4, SEAT: 1, DECOR: null).                         |
| —                  | `reservable: boolean`      | `type !== 'DECOR' && type !== 'STAGE' && type !== 'SECTOR_ZONE'`           |
| —                  | `attributes: Record<...>`  | Vacío `{}` hasta CU-07.                                                    |

### 6.5 Dimensiones del sector (canvas size)

El sector **no tiene ancho/alto en BD hoy** (ver `SpaceElement.java:24`). Solución provisional:

- Leer `sector.size` del `SpacesStore` si existe (no existe aún).
- **Fallback:** canvas fijo `1200×800` (ver `LAYOUT_VACIO` en `map-layout.model.ts`).
- Clamping de drag usa este tamaño. Cuando CU-05 añada dimensiones al sector, se conecta automáticamente.

### 6.6 Integración con `wizard-summary` (punto de entrada)

En `wizard-summary.ts`:

- Añadir botón **"Finalizar y abrir editor de mapas"** junto al botón "Finalizar" existente.
- Click → determina `targetSectorId`:
  1. Primer sector que tenga `elements.length > 0` (desde `SpacesStore.sectorsByFloor` + `elementsBySector`).
  2. Si ninguno tiene elementos, primer sector de la lista.
  3. Si no hay sectores, muestra toast y no navega.
- Navega: `router.navigate(['/spaces/editor', targetSectorId])`.

---

## 7. Feature toggle

- [ ] **Sí, detrás de flag:** `editor.map.enabled` (tipo `release`).
- [ ] `pnpm new:flag editor.map.enabled` (ejecutar antes de merge).
- Fecha de retiro: `2027-01-01` · Issue de limpieza: `#TBD`.

```html
@if (flags.isEnabled('editor.map.enabled')()) {
<button (click)="openEditor()">Finalizar y abrir editor de mapas</button>
}
```

---

## 8. Testing

| Nivel                 | Qué se prueba                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (dominio)        | — (no hay lógica de dominio nueva en backend)                                                                                                            |
| Integración           | — (backend sin cambios)                                                                                                                                  |
| Aislamiento tenant    | — (heredado de HU-2.03)                                                                                                                                  |
| **Frontend (Vitest)** | `map-editor-store`: `loadSector` popula layout; `dragElement` actualiza signal y llama API; `saveElementPosition` rollback en error; clamping en bordes. |
| **E2E (Playwright)**  | Flujo completo: resumen → click botón → editor carga → drag elemento → PUT enviado → recarga → posición persistida.                                      |

---

## 9. Riesgos

| Riesgo                                                | Mitigación                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Konva.js bundle grande** (>200KB gz)                | Lazy loading de la feature; `MapEnginePort` permite tree-shaking si no se usa.                      |
| **Coordenadas desincronizadas** (frontend vs backend) | Store es fuente de verdad; API solo confirma. Rollback automático en error.                         |
| **Sector sin dimensiones** (clamping incorrecto)      | Fallback 1200×800 documentado; logging warning; CU-05 lo resolverá.                                 |
| **Rotación/size no persistidos** (pérdida tras F5)    | Documentado en spec §8; `MapLayout` lo mantiene en memoria; CU-08 lo persistirá.                    |
| **Memory leak del canvas**                            | `MapEnginePort.destroy()` en `ngOnDestroy` del page component (obligatorio).                        |
| **Zoneless + Konva events**                           | Konva usa sus propios listeners; no hay Zone.js. Probar `changeDetection: OnPush` en todo el árbol. |
