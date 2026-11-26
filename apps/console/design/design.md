# MapIt Console — Editor y monitor operativo · Token Reference

> Referencia extraída de las imágenes objetivo del rediseño del editor de sector (v2) y de la
> reserva rápida del monitor operativo.
> Leer primero este archivo. Especs de componente: [design-components.md](design-components.md).
> Accesibilidad y do's/don'ts: [design-guidelines.md](design-guidelines.md).
>
> **Relación con el sistema global:** los tokens de MapIt viven en
> `libs/ui-kit/styles/_tokens.scss` y `libs/ui-kit/DESIGN.md` (fuente única). Este documento
> solo AÑADE las decisiones del editor de mapas y del monitor operativo; todo lo que ya exista
> (índigo de marca, Inter/Manrope, rejilla 4px, radios 4/8/12px) se reutiliza, no se redefine.

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

## Reserva rápida — Monitor operativo

> Refinamiento de [HU-5.01](../../specs/HU-5.01-creacion-reserva-interna/refinamiento-reserva-rapida/spec.md).
> Esta sección define únicamente el panel de reserva rápida; no cambia los tokens globales.

### Colors — Superficie y estado

| Role                      | Token / valor                                       | Uso                                                      |
| ------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| monitor-panel             | `--mapit-color-surface` / `#FFFFFF`                 | Panel visible, ficha de cliente y banner de error        |
| monitor-rim               | `--mapit-color-primary-container` / `#DBEAFE`       | Borde del panel, pista de pestañas y ficha del elemento  |
| monitor-field             | `color-mix(primary 7%, surface)`                    | Fondo exterior azul muy claro del encuadre del monitor   |
| monitor-selected          | `--mapit-color-primary` / `#2563EB`                 | Pestaña activa, acción principal y foco                  |
| monitor-selected-hover    | `--mapit-color-primary-hover` / `#1D4ED8`           | Hover de la acción principal                             |
| monitor-text              | `--mapit-color-text` / `#0F172A`                    | Títulos y datos                                          |
| monitor-text-secondary    | `--mapit-color-text-variant` / `#334155`            | Etiquetas secundarias                                    |
| monitor-text-muted        | `--mapit-color-text-muted` / `#64748B`              | Ubicación y metadatos                                    |
| monitor-input-border      | `--mapit-color-border-input` / `#CBD5E1`            | Controles nativos                                        |
| monitor-available         | `--mapit-state-available` / `#22C55E`               | Estado favorable real; nunca se usa como estado simulado |
| monitor-available-surface | `color-mix(available 12%, surface)`                 | Banner de disponibilidad favorable                       |
| monitor-focus             | `--mapit-color-focus-ring` / `rgb(37 99 235 / 0.2)` | Halo de foco de los controles                            |

El verde solo aparece cuando el snapshot operativo confirma disponibilidad. El estado del
elemento visible conserva su token semántico y siempre incluye texto.

### Typography

| Style                 | Uso en Reserva rápida             |
| --------------------- | --------------------------------- |
| Manrope 20/28 · 600   | Título "Crear reserva rápida"     |
| Manrope 16/24 · 700   | Nombre del elemento seleccionado  |
| Inter 14/20 · 600     | Etiquetas de campo y pestañas     |
| Inter 14/20 · 400/500 | Valores de entrada y botones      |
| Inter 12/16 · 400/700 | Ubicación, estado y copy opcional |

### Shape

| Token                  | Radius | Componentes                                     |
| ---------------------- | ------ | ----------------------------------------------- |
| `--mapit-radius-input` | 4px    | Inputs, selects y textarea                      |
| `--mapit-radius`       | 8px    | Pestañas, botón de cierre y tarjeta de contexto |
| `--mapit-radius-lg`    | 12px   | Ficha del elemento, banner y botones            |
| `--mapit-radius-xl`    | 24px   | Panel contextual                                |
| `9999px` (literal)     | 9999px | Pill de estado del elemento                     |

### Elevation

- Panel contextual: `--mapit-shadow`; no se suma una segunda sombra pesada.
- Ficha del elemento y banner: sin sombra propia; se separan por fondo y borde.
- Botones y pestañas: sin sombra en reposo; el hover conserva jerarquía por color y borde.

### Layout

- En escritorio, el monitor conserva la división 60/40: mapa a la izquierda y panel a la
  derecha. El panel usa el ancho disponible, con máximo de 577px y mínimo de 336px.
- La altura sigue al mapa, con máximo de 731px; el cuerpo del panel desplaza verticalmente.
- Bajo 49rem, mapa y panel se apilan sin superposición y el panel ocupa el ancho completo.
- El formulario usa: nombre a ancho completo; prefijo, teléfono y email en una fila; fecha,
  hora y personas en otra. Por debajo de 34rem cada grupo se reorganiza sin controles
  menores de 44px.

### Motion

No hay animaciones nuevas. Se reutilizan `--mapit-duration-fast` y `--mapit-ease-out` para
hover/focus. La ficha del elemento usa una onda CSS estática, sin animación, y respeta el
override global de movimiento reducido.

### Icons

`@lucide/angular` sobre grid de 24px: `armchair` para el elemento, `zap` y
`calendar-check` para las pestañas, `x` para cerrar y `check` para disponibilidad. Todos los
iconos decorativos llevan `aria-hidden="true"`.
