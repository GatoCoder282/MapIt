# MapIt Console — Editor de mapas · Guidelines (accesibilidad y do's/don'ts)

> Tokens: [design.md](design.md). Specs de componente: [design-components.md](design-components.md).

## Accessibility

### Contrast

| Requirement           | Ratio | Medido sobre                                                       |
| --------------------- | ----- | ------------------------------------------------------------------ |
| Texto normal          | 4.5:1 | Valores del panel `#0F172A` sobre `#FFFFFF` ≈ 15:1 ✓               |
| Texto muted/etiquetas | 4.5:1 | `#64748B` sobre `#FFFFFF` ≈ 4.8:1 ✓ (límite OK para 12px positivo) |
| Iconos/manejadores    | 3:1   | Marco `#2563EB` sobre `#F8FAFC` ≈ 5.9:1 ✓                          |
| Pill del elemento     | 4.5:1 | Blanco sobre `#2563EB` ≈ 5.4:1 ✓                                   |

> El estado semántico del marcador se comunica con trazo + etiqueta en el panel, no solo
> con color (regla vigente del sistema: el mapa debe leerse en grises).

### Touch targets

- Manejadores de selección: objetivo táctil ≥ 24px (el círculo visual es 10px, el área de
  arrastre del transformer se amplía; RNF07: el modo operación corre en tablet).
- Botón de rotación y botones del panel: ≥ 40px de alto.

### Keyboard navigation

| Tecla         | Acción en el editor                                         |
| ------------- | ----------------------------------------------------------- |
| Tab           | Ciclo: lista de elementos → panel → canvas                  |
| Enter/Espacio | Seleccionar elemento desde la lista lateral                 |
| Eliminar/⌫    | Borrar el elemento seleccionado (con la guarda de reservas) |

### Assistive technology

- El canvas (`Konva.Stage`) es una imagen interactiva: la lista lateral "Elementos" es la
  alternativa accesible y debe reflejar siempre lo visible en el plano.
- La pill de nombre tiene `aria-hidden`: el nombre vive en el panel y en la lista.

## Gestures

| Gesture | Uso                                                       |
| ------- | --------------------------------------------------------- |
| Tap     | Seleccionar elemento                                      |
| Drag    | Mover elemento; arrastrar manejador (redimensionar/rotar) |
| Drop    | Crear desde la biblioteca (drop sobre el lienzo)          |

## Content design

- Nombre del elemento: visible en pill, panel y lista — el mismo string en los tres.
- Unidades sin decoración (`X`, `Y`, `W`, `H`, `°`), valores numéricos en negrita.
- Errores de guardado del canvas: lenguaje de herramienta técnica, sin exclamaciones.

## Do's and Don'ts

### Color

- **Do** reservar el azul `#2563EB` para selección y acciones de edición.
- **Don't** usar el azul para estados operativos (disponible/ocupado/…): el estado es
  color semántico del sistema y vive en trazo/badge, no en relleno a sangre.

### Shape

- **Do** dibujar los manejadores como círculos blancos con borde azul.
- **Don't** usar manejadores cuadrados llenos de azul (ahogan el plano técnico).

### Elevation

- **Do** elevar solo el panel y la pill (sombras suaves nivel 1).
- **Don't** poner sombra a elementos del plano en reposo (lee como "flota").

### Interaction

- **Do** ocultar el marco de selección mientras un elemento se arrastra.
- **Don't** mantener dos selecciones visibles (canvas y lista deben mostrar la misma).

### Layout

- **Do** mantener la grilla visible aunque el plano esté vacío (orientación espacial).
- **Don't** oscurecer el lienzo por debajo de `#F8FAFC`: el "modo oscuro" del canvas no
  existe todavía (ver DESIGN.md global).

### Typography

- **Do** usar Inter para TODOS los datos del panel (densidad B2B).
- **Don't** meter Manrope en las etiquetas de campo (es para titulares/secciones).

### Motion

- **Don't** animar la aparición del marco ni la pill (latencia mínima en herramienta técnica).
- **Don't** animar la "entrada" del panel (ya está en su sitio desde el primer render).

## Reserva rápida — Monitor operativo

> Tokens: [design.md](design.md). Specs de componente: [design-components.md](design-components.md).

### Accessibility

#### Contrast

| Requirement             | Ratio | Medido sobre                                  |
| ----------------------- | ----- | --------------------------------------------- |
| Texto normal            | 4.5:1 | `#0F172A` sobre `#FFFFFF` ≈ 15:1 ✓            |
| Texto secundario        | 4.5:1 | `#334155` sobre `#FFFFFF` ≈ 10.3:1 ✓          |
| Texto muted y ubicación | 4.5:1 | `#64748B` sobre `#FFFFFF` ≈ 4.8:1 ✓           |
| Iconos, bordes y foco   | 3:1   | `#2563EB` sobre `#FFFFFF` / `#DBEAFE` ≥ 3:1 ✓ |
| Pill de estado          | 4.5:1 | Texto blanco sobre `#2563EB` ≈ 5.4:1 ✓        |

El azul y el verde nunca son el único indicador: la pestaña activa conserva `aria-selected`,
el estado incluye texto y el banner de disponibilidad se anuncia.

#### Touch targets

- Inputs, selects, textarea y botones: mínimo 44px de alto.
- Botón de cierre: área de 44 × 44px; el icono visible puede ser de 18px.
- Separación mínima entre controles interactivos: 8px.

#### Keyboard navigation

| Tecla           | Acción en Reserva rápida                                      |
| --------------- | ------------------------------------------------------------- |
| Tab / Shift+Tab | Recorre controles en el orden visual                          |
| Enter           | Envía el formulario o activa el control enfocado              |
| Flechas         | Mueven el foco dentro de las pestañas                         |
| Home / End      | Seleccionan la primera o última pestaña                       |
| Escape          | No interrumpe la escritura ni crea datos fuera del formulario |

#### Assistive technology

- Cada control tiene una etiqueta visible y programática; los opcionales se identifican también
  con texto.
- Los errores de campo usan `aria-invalid="true"` y `aria-describedby`; el mensaje general usa
  `role="alert"`.
- El banner de disponibilidad usa `role="status"` y `aria-live="polite"`.
- La lista de pestañas conserva `tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-controls`,
  `aria-labelledby` y un único elemento con `tabindex="0"`.
- Iconos decorativos: `aria-hidden="true"`. Botones solo-icono: nombre accesible conservado.
- Tras crear o cancelar, el foco permanece en un contexto legible y nunca se pierde en el
  cuerpo del panel.

### Content design

- "Crear reserva rápida" describe la acción; no usar "Reserva" como encabezado ambiguo.
- Las etiquetas son nominales: "Nombre completo", "Celular", "Correo electrónico (opcional)",
  "Fecha", "Hora de inicio" y "Personas".
- Los mensajes de error explican qué ocurrió y conservan el borrador; no empiezan por
  exclamaciones ni usan jerga técnica.
- No mostrar "Duración" ni "Preparación": son reglas internas de 90 minutos y preparación.

### Do's and Don'ts

#### Color

- **Do** usar `#DBEAFE` para la ficha del elemento y la pista de pestañas.
- **Do** mostrar verde únicamente después de una comprobación operativa favorable.
- **Don't** pintar la mesa de ocupada al crear una reserva futura.

#### Shape

- **Do** usar radio de 4px en inputs y 12px en tarjetas/botones.
- **Don't** usar sombras pesadas para separar campos o feedback.

#### Interaction

- **Do** deshabilitar "Crear reserva" mientras hay una escritura en curso.
- **Do** tratar el `409` del backend como conflicto autoritativo y refrescar el snapshot.
- **Don't** simular disponibilidad positiva ni permitir un doble envío.

#### Layout

- **Do** conservar la división 60/40 en escritorio y el apilado sin overlay en compacto.
- **Do** reorganizar el formulario por ancho de panel, no por ancho de ventana.
- **Don't** crear un overlay, modal o ruta nueva para la reserva rápida.

#### Motion

- **Do** limitar el movimiento a hover/focus con las duraciones globales.
- **Don't** animar la onda decorativa de la ficha ni añadir waves al formulario.
