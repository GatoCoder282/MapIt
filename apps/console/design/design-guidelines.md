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
