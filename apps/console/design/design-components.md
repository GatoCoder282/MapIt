# MapIt Console — Editor de mapas · Component Specs

> Tokens: [design.md](design.md). Reglas y accesibilidad: [design-guidelines.md](design-guidelines.md).
> Componentes detectados en la referencia visual (v2) y su mapeo a la implementación Angular
>
> - Konva (`libs/map-engine` adaptador detrás de `MapEnginePort`; en UI, strings vía
>   `STRINGS.spaces.editor`).

## Containment

### Lienzo del plano (canvas)

- Fondo `#F8FAFC`, grilla de 1px `#E5E7EB` cada 50 unidades del modelo.
- Sin borde propio: el límite del sector se dibuja como rect de 2px `#94A3B8`.
- Esquinas rectas (el plano no es una tarjeta).

---

### Marcador del plano (elemento del sector)

- **Reposo:** relleno `#FFFFFF`, trazo `1.5px #94A3B8`, `cornerRadius` 8px para mesas/asientos
  y 4px para el resto (casamiento con el lenguaje del sistema).
- **Estado operativo** (RF06): trazo + mini-badge con los tokens `--mapit-state-*`
  **sin** retintar el relleno (el color fuerte vive en el borde: 3px con el color de estado).
- **Seleccionado:** relleno pasa a `editor-selection-fill #93C5FD`, trazo a `#2563EB`,
  más marco de selección (ver abajo) y pill de nombre.
- Sombras: solo `elevation 0` en reposo; el arrastre reduce opacidad a 0.9 (existente).

**Do:** los estados operativos se distinguen además por trazo/leyenda, nunca por color solo.
**Don't:** mezclar en el mismo marcador el azul de selección con el color de estado en relleno.

---

### Marco de selección (Konva Transformer)

- Borde: `2px solid #2563EB`, `dash` ninguno (sólido), padding 5px.
- Manejadores: círculos de 10px, relleno blanco, borde 2px `#2563EB`, sombra nivel 1.
  Anchors: 4 esquinas + 4 centros de arista. Mango de rotación separado (existente, offset 20px).
- Mientras hay arrastre activo oculto (`visible(false)` durante `dragstart`).

---

### Pill de nombre sobre el elemento seleccionado

- Fondo `#2563EB`, texto blanco 12px/700, icono Lucide (chair/armchair) 14px a la izquierda,
  padding 6px 10px, radio 9999px, sombra nivel 1, offset: encima del elemento (10px sobre el
  borde superior, centrado horizontal).
- `aria-hidden="true"` en el canvas; su texto es el mismo de la lista y del panel.
- Implementación: `Konva.Group` (Rect + Text + icono de trazo dibujado como `Konva.Path`
  de Lucide) **dentro del adaptador**; los componentes Angular nunca importan Konva.

---

### Panel de propiedades del elemento

- Tarjeta blanca `#FFFFFF`, radio 12px, sombra `0 4px 12px rgb(0 0 0 / 0.08)`,
  ancho ~260px dentro de la sidebar derecha (o flotante a la derecha del canvas según el
  estado actual del layout de `map-editor-page`).
- Cabecera: avatar circular `editor-selection-soft` con icono Lucide (chair) 24px azul,
  nombre bold 14px y chevron de colapso a la derecha.
- Secciones: "Posición" (chips X/Y), "Tamaño" (chips W/H), "Rotación" (chip ancho completo
  - botón refresh redondeado). Etiquetas 12/400 `#64748B`, valores 14/600 `#0F172A`.

## Input

### Chip de campo (X/Y/W/H)

- Input de tipo number embebido en chip: contenedor `#F1F5F9`, radio 8px, alto 40px,
  padding 8px 12px; prefijo de campo (`X:`, `Y:`, `W:`, `H:`) 14/600 en color semántico:
  X→`#1D4ED8` sobre `#DBEAFE`; Y→`#166534` sobre `#DCFCE7`; W/H→`#334155` sobre `#F1F5F9`.
- Borde 1px `#E5E7EB`. Foco: halo exterior 2px `rgb(37 99 235 / 0.2)` y borde `#2563EB`.
- Actualiza al editar + `Enter`/blur: el caso de uso es el guardado normal del editor
  (debounce → PUT; conflictos se muestran como hoy).

### Botón de rotación

- Icono `refresh-cw` (Lucide), botón circular 36px a la derecha del campo de rotación,
  borde `#E5E7EB`, color `#2563EB`, hover fondo `#DBEAFE`.

## Actions

### Botón primario del editor (Aplicar plantilla / Guardar / Aplicar tamaño)

- Relleno `#3D4EF2` (accent de la marca — el índigo de `libs/ui-kit`), texto blanco, radio 8px.
- **Atención:** el acento del EDITOR es `#2563EB` (selección/interacción del plano) y el
  accent de la MARCA es `#3D4EF2` (CTAs). No mezclarlos: los CTAs de cabecera llevan el
  índigo de marca; la interacción del lienzo lleva el azul de editor.

### Botón secundario del editor (Guardar como plantilla)

- Fondo blanco, borde `#D1D5DB`, radio 8px, icono Lucide `bookmark`, texto 12px Inter 500.

## Navigation

### Lista de elementos (sidebar izquierda)

- Filas con icono de tipo a la izquierda (chip con color de sector actual) y
  `[attr.aria-selected]` en la seleccionada; seleccionada: borde azul + fondo #EEF0FF
  (consistencia con el nav del sistema, ya existe).
- El nombre en la lista coincide byte a byte con la pill del canvas y el título del panel.

## Data Display

### Etiquetas del plano en reposo

- Texto bajo el elemento: tipo + id corto (`TABLE d79b15`) en metadata `#64748B`. Sin pill
  en reposo; la pill es solo del seleccionado.

### Handle de rotación

- Círculo 10px blanco con borde `#2563EB`, conectado por línea de 20px desde la arista
  superior (default del transformer, se mantiene).

## Feedback

### Error de guardado del canvas

- Barra existente (roja suave del sistema) arriba a la derecha; NO sustituye por toasts
  nuevos (pick-ui-library no se invoca: el patrón de feedback ya está aprobado).

### Estado de guardado

- Indicador "Guardando posición." existente (punto+latido de la sección). Se mantiene.

## Recepción y métodos de cobro

Especificación de las pantallas operativas QR: [check-in.md](check-in.md).
