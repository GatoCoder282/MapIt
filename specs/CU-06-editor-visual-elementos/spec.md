# CU-06 — Editor Visual de SpaceElements

> **Estado:** Borrador · **Creada:** 2026-10-04 · **Responsable:** Integrante C (Frontend Editor)

## Enunciado

Como administrador, quiero editar visualmente los SpaceElements sobre el plano del sector para posicionarlos y ajustar su geometría (arrastrar, rotar, redimensionar), accediendo directamente tras finalizar la creación del espacio en el asistente de configuración (resumen).

---

## 1. Por qué (contexto)

## 1. Por qué (contexto)

La arquitectura del proyecto separa intencionalmente la creación de los elementos (qué existe en el negocio) de su disposición espacial (dónde están ubicados). Hoy, el asistente de configuración (CU-05) cumple perfectamente su función de dar de alta pisos, sectores y elementos a nivel de datos. Sin embargo, el ingreso manual de coordenadas x/y numéricas mediante formularios es propenso a errores, lento y no refleja la realidad espacial del local.

Esta nueva funcionalidad no reemplaza nada del flujo anterior, sino que lo complementa. Al separar el posicionamiento en una herramienta dedicada, evitamos sobrecargar la creación de datos y le brindamos al administrador un editor visual (Konva.js) para interactuar directamente sobre un lienzo con los objetos ya creados. Esto otorga feedback inmediato y reduce drásticamente la fricción al configurar el mapa operativo. 

Para lograr una transición fluida desde la creación lógica hacia la distribución visual, el punto de conexión natural es el botón "Finalizar y abrir editor de mapas" en la vista de resumen (`/spaces/summary/:establishmentId`), el cual ya cuenta con todo el contexto necesario (tenant, establishment, sectores y elementos creados).

---

## 2. Actores

| Rol                     | Qué hace en este caso de uso                                                          |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Administrador / Manager | Abre el editor desde el resumen, arrastra/rota/redimensiona elementos, guarda cambios |

---

## 3. Precondiciones

- El administrador ha completado el asistente de configuración: existe un establecimiento con al menos un piso, un sector y uno o más SpaceElements creados (vía HU-2.03 / CU-05).
- El usuario está autenticado y el claim `tenant` del JWT resuelve el tenant activo.
- El contrato API expone `GET /sectors/{sectorId}/elements`, `PUT /sectors/{sectorId}/elements/{elementId}` (ya implementados en HU-2.03).
- El puerto `MapEnginePort` de `@mapit/map-engine` está disponible y tiene un adaptador Konva.js funcional.

---

## 4. Flujo principal

1. El administrador está en la vista de resumen (`/spaces/summary/:establishmentId`).
2. Hace clic en **"Finalizar y abrir editor de mapas"**.
3. La app navega a la nueva ruta del editor (p. ej. `/spaces/editor/:establishmentId` o `/spaces/editor/:sectorId` — ver plan §6).
4. El editor carga el layout del sector (o del primer sector con elementos) usando `MapEnginePort.mount()` y `load()`.
5. El canvas muestra el sector con sus SpaceElements en sus coordenadas actuales (x, y relativas al sector).
6. El administrador selecciona un elemento → aparecen handles de arrastre, rotación y redimensionamiento.
7. **Drag:** arrastra el elemento → posición (x, y) se actualiza en tiempo real en el canvas.
8. **Rotate:** usa el handle de rotación → `rotation` (grados) se actualiza.
9. **Resize:** usa handles de esquina/borde → `size` (width, height) se actualiza.
10. Al soltar / confirmar, el ViewModel envía `PUT /sectors/{sectorId}/elements/{elementId}` con `type`, `x`, `y` (el backend valida coordenadas ≥ 0 y tipo permitido por vertical).
11. El backend responde 200 con el elemento actualizado → el ViewModel actualiza su estado local y el `MapEnginePort` refleja el layout confirmado.
12. El usuario puede seguir editando o salir; los cambios ya están persistidos.

---

## 5. Flujos alternativos y errores

| Situación                                                       | Comportamiento esperado                                                                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El usuario arrastra un elemento fuera de los límites del sector | El frontend **previene** la salida (clamping a tamaño del sector) y muestra feedback visual; el backend también valida `x >= 0, y >= 0` y devolvería 400 si se intenta persistir inválido. |
| Error de red al persistir (PUT falla)                           | El ViewModel muestra toast de error, **revierte visualmente** a la última posición confirmada y permite reintentar.                                                                        |
| El elemento fue borrado por otro usuario (404)                  | Toast informativo, elemento desaparece del canvas, lista se refresca.                                                                                                                      |
| Tipo de elemento no permitido para la vertical (400)            | No debería ocurrir desde el editor (el tipo no se cambia aquí), pero si pasa: toast de error y revert.                                                                                     |
| Usuario recarga la página (F5)                                  | El editor vuelve a cargar el layout desde la API (estado persistido).                                                                                                                      |
| Navegación desde resumen sin sectores con elementos             | El editor muestra estado vacío con CTA para crear elementos primero.                                                                                                                       |

---

## 6. Reglas de negocio

- **RN-1 (Coordenadas relativas):** Las coordenadas `x`, `y` son **relativas al sector** (origen esquina superior izquierda), igual que en la BD y el contrato. El canvas del editor usa el mismo sistema de referencia.
- **RN-2 (No escapar del sector):** Un elemento no puede tener coordenadas negativas ni superar `sectorWidth - elementWidth` / `sectorHeight - elementHeight`. El frontend hace clamping; el backend valida `x >= 0, y >= 0` (la validación de límite superior se añadirá cuando el sector tenga dimensiones — ver incertidumbre en `SpaceElement.java:24`).
- **RN-3 (Rotación en grados):** La rotación se almacena en grados (0–360) en el modelo `MapLayout` del puerto. El backend **no persiste rotación ni size hoy** (solo `x`, `y`, `type`); estos campos viven solo en el `MapLayout` del frontend y se usarán en CU-07/CU-08. **El editor los maneja visualmente pero no los envía al backend en esta entrega.**
- **RN-4 (Tipo inmutable en editor):** El editor **no permite cambiar el `type`** (TABLE, BAR, etc.). Eso se hace en el formulario de creación (HU-2.03). El editor solo manipula geometría: posición, rotación, tamaño.
- **RN-5 (Estado operativo no editable):** El `state` (AVAILABLE, OCCUPIED, etc.) se gestiona en operación (CU-09/HU-3.01), no en el editor.
- **RN-6 (Multi-tenant):** Todo acceso a elementos pasa por `tenant_id` del JWT. El editor hereda el contexto del resumen; no hay selección de tenant.

---

## 7. Criterios de aceptación

- [ ] **CA-1:** Dado que el administrador está en `/spaces/summary/:establishmentId` con sectores y elementos creados, cuando hace clic en "Finalizar y abrir editor de mapas", entonces navega al editor y el canvas muestra los elementos del primer sector con elementos en sus coordenadas correctas.
- [ ] **CA-2:** Dado que el editor muestra un SpaceElement, cuando el usuario lo arrastra a una nueva posición y suelta, entonces se envía `PUT /sectors/{sectorId}/elements/{elementId}` con las nuevas `x`, `y` y el elemento queda en la nueva posición tras recargar.
- [ ] **CA-3:** Dado que el usuario arrastra un elemento hacia fuera del sector, entonces el elemento se detiene en el borde (clamping) y no se envía coordenada negativa al backend.
- [ ] **CA-4:** Dado que el usuario usa el handle de rotación de un elemento, cuando rota y suelta, entonces el elemento muestra la nueva rotación visualmente (el valor no se persiste en backend en esta entrega, pero queda en `MapLayout`).
- [ ] **CA-5:** Dado que el usuario usa los handles de redimensionamiento, cuando redimensiona y suelta, entonces el elemento muestra el nuevo tamaño visualmente (el valor no se persiste en backend en esta entrega, pero queda en `MapLayout`).
- [ ] **CA-6:** Dado un error de red al persistir (simulado), cuando el PUT falla, entonces el elemento vuelve visualmente a su posición anterior y se muestra un toast de error.
- [ ] **CA-7:** Dado que el usuario recarga la página del editor (F5), entonces el canvas vuelve a mostrar los elementos en sus posiciones persistidas (último PUT exitoso).
- [ ] **CA-8:** La navegación desde el resumen al editor transfiere correctamente el contexto (tenant, establishmentId, sectorId) sin pérdida de datos.

---

## 8. Fuera de alcance

- Cambio de `type` del elemento desde el editor (se hace en formulario HU-2.03).
- Persistencia de `rotation` y `size` en backend (cuando el sector tenga dimensiones, CU-07/CU-08).
- Edición de `state` operativo (CU-09).
- Selección múltiple / agrupamiento de elementos (CU-07).
- Plantillas de elementos por vertical (CU-07).
- Undo/Redo (nice to have, no bloqueante).
- Colaboración en tiempo real entre varios editores (CU-09 tiempo real es solo estados).

---

## 9. Impacto multi-tenant

- No hay tablas nuevas. Se usan las existentes (`space_element`) que ya tienen `tenant_id NOT NULL` + índice `(tenant_id, id)` + RLS habilitado (migración V12).
- El editor hereda el tenant del JWT vía el contexto de navegación; no expone selección de tenant.
- Test de aislamiento entre tenants ya existe en HU-2.03 (MAP-72, MAP-73). El editor reusa la misma API y store, por lo que la cobertura es heredada.

---

## 10. Requerimientos relacionados

- **CU-05** (Gestión de Pisos y Sectores): provee el flujo previo y el punto de entrada (resumen).
- **HU-2.03** (Asignación de Elementos Espaciales): API y modelo de `SpaceElement` ya implementados.
- **CU-06** (Editor visual): este caso de uso.
- **CU-07** (Plantillas): extenderá el modelo con `rotation`, `size`, `capacity`, `attributes`.
- **CU-08** (Persistir mapa como datos): añadirá campos al contrato y BD para rotación/tamaño.
- **ADR-0006** (Motor de mapa tras un puerto): el editor usa `MapEnginePort`, nunca importa `konva` directamente.
