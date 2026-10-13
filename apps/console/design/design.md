# MapIt Console — Editor de mapas (HU-4.01) · Token Reference

> Referencia extraída de la imagen objetivo del rediseño del editor de sector (v2).
> Leer primero este archivo. Especs de componente: [design-components.md](design-components.md).
> Accesibilidad y do's/don'ts: [design-guidelines.md](design-guidelines.md).
>
> **Relación con el sistema global:** los tokens de MapIt viven en
> `libs/ui-kit/styles/_tokens.scss` y `libs/ui-kit/DESIGN.md` (fuente única). Este documento
> solo AÑADE los tokens del editor de mapas; todo lo que ya exista (índigo de marca, Inter/
> Manrope, rejilla 4px, radios 4/8/12px) se reutiliza, no se redefine.

Diseño del editor: "plano técnico claro" — lienzo blanco con grilla sutil, mobiliario en
outlines neutros (en reposo), y un único acento azul (`primary` del wizard/setup) para
**selección, manejadores, etiqueta y panel**. El color de ESTADO del elemento
(disponible/ocupado/…) es independiente del azul de selección: el relleno del marcador
sigue siendo el color semántico de estado; el azul marca solo la interacción.

## Colors

### Accent — Selección y panel del editor

| Role                    | Hex       | Usage                                                                                  |
| ----------------------- | --------- | -------------------------------------------------------------------------------------- |
| editor-selection        | `#2563EB` | Marco de selección, pill de nombre sobre el elemento, icono del panel, botón "aplicar" |
| editor-selection-fill   | `#93C5FD` | Relleno del elemento SELECCIONADO en el canvas (solo mientras esté seleccionado)       |
| editor-selection-soft   | `#DBEAFE` | Fondo de avatar/chip en el panel, halo de foco suave (inferred: ≈ 20% del accent)      |
| editor-selection-on     | `#FFFFFF` | Texto/iconos sobre accent (pill, manejadores)                                          |
| editor-selection-text   | `#1D4ED8` | Valor/etiqueta "X" sobre chip azul claro                                               |
| editor-selection-y-bg   | `#DCFCE7` | Chip del eje Y (inferred de la referencia; verde muy claro)                            |
| editor-selection-y-text | `#166534` | Texto del chip Y                                                                       |

### Surface & Neutral (canvas y panel)

| Role                    | Hex       | Usage                                                                       |
| ----------------------- | --------- | --------------------------------------------------------------------------- |
| editor-canvas           | `#F8FAFC` | Fondo del lienzo (igual que el lienzo del wizard de CU-05)                  |
| editor-grid-line        | `#E5E7EB` | Líneas de la grilla del plano (trazo 1px)                                   |
| editor-furniture        | `#FFFFFF` | Relleno de elementos en reposo en el plano                                  |
| editor-furniture-stroke | `#94A3B8` | Contorno de elementos en reposo (gris pizarra), trazo 1.5px                 |
| editor-panel            | `#FFFFFF` | Tarjeta del panel de propiedades                                            |
| editor-panel-border     | `#E5E7EB` | Borde de tarjeta/inputs (1px)                                               |
| editor-panel-text       | `#0F172A` | Valores y nombre del elemento                                               |
| editor-panel-muted      | `#64748B` | Etiquetas de sección y sufijos de unidad                                    |
| editor-shadow           | —         | Sombra ambiental suave del panel y del pill: `0 4px 12px rgb(0 0 0 / 0.08)` |

> **Compatibilidad de estados (RF06):** `editor-furniture*` sustituye el relleno verde
> plano anterior como FONDO del plano. El estado operativo se muestra como trazo +
> mini-punto/badge, nunca como relleno a sangre (ver design-components.md → Marcador del
> plano). Los tokens `--mapit-state-*` existentes NO cambian.

## Typography

Reutiliza la escala de MapIt (Inter/Manrope). Nada nuevo:

| Style                  | Uso en el editor                                                      |
| ---------------------- | --------------------------------------------------------------------- |
| section-title (18/600) | Nombre del elemento en el panel ("Mesa 06")                           |
| body-md-bold (14/600)  | Valores de los chips X/Y/W/H/rotación                                 |
| metadata (12/400)      | Etiquetas "Posición", "Tamaño", "Rotación", unidades                  |
| label-caps (11/700)    | Pill de nombre sobre el elemento seleccionado (mayúsculas opcionales) |

## Shape

| Token | Radius                                                              | Componentes      |
| ----- | ------------------------------------------------------------------- | ---------------- |
| 4px   | inputs chips (X/Y/W/H), manejadores... no: manejadores son círculos | inputs del panel |
| 8px   | chips del panel, etiqueta pill del elemento                         | —                |
| 12px  | tarjeta del panel de propiedades                                    | —                |
| full  | manejadores de selección (círculos), avatar del panel               | —                |

## Elevation

| Level | Shadow                         | Uso                                  |
| ----- | ------------------------------ | ------------------------------------ |
| 0     | none                           | Lienzo, grilla                       |
| 1     | `0 4px 12px rgb(0 0 0 / 0.08)` | Panel de propiedades, pill de nombre |

## Interaction states

| State    | Regla en el editor                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Hover    | Elemento del plano: stroke del furniture pasa a `#64748B` (más fuerte); cursor grab                                           |
| Selected | Marco azul 2px + 8 manejadores (4 esquinas + 4 centros) círculos blancos borde azul; pill de nombre encima; relleno `#93C5FD` |
| Dragging | Opacidad 0.9 (existente); marco oculto durante el arrastre                                                                    |
| Disabled | No aplica en canvas (los deshabilitados no existen; fuera de servicio = estado, no disabled)                                  |

## Layout

- Panel de propiedades: tarjeta fija a la derecha del canvas dentro del workspace, ancho
  ≈ 260px (entre sidebar_width 280 y gutter 24), con `stack_md` (12px) entre secciones.
- La grilla del canvas se mantiene cada 50 unidades del modelo (línea 1px `#E5E7EB`).

## Motion

Sin animaciones nuevas. Las transiciones existentes de hover/estado se mantienen en
`--mapit-duration-fast` (150ms). El marco de selección aparece de inmediato (herramienta
técnica: latencia cero es prioritaria sobre suavidad).

## Icons

`@lucide/angular` (stroke 1.5-2px sobre grid 24px) — armchair/chair para "mesa" en el
pill y el avatar del panel, `refresh-cw` para el botón de rotación. Nada de familias
nuevas.
