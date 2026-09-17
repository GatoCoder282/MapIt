# MapIt Reservas (public-web) — Token Reference

> Leer primero. Spec extraída de la imagen de referencia de la página Reservas.
> Para specs de componentes ver [design-components.md](design-components.md); para accesibilidad
> ver [design-guidelines.md](design-guidelines.md).

Diseño tipo "marketplace de reservas" orientado al cliente final: fondo casi blanco con
degradados azul claro, acento índigo de marca, tarjetas blancas con sombra suave, chips
píldora. Titulares en Manrope, UI en Inter (misma doble fuente del sistema). Base de
espaciado 4px. Plataforma: web responsive (referencia a ~1040px de ancho).

**Nota de mapeo de color:** la imagen usa un azul tipo `#2563EB`. El sistema de marca
aprobado (`libs/ui-kit/DESIGN.md`) fija el índigo `#3D4EF2` como relleno y `#1C2EDB` como
texto/acento. **Se usan los tokens de marca, no el azul crudo de la imagen.** Es la única
desviación deliberada de color respecto a la referencia.

## Colores

### Accent — Primary

| Role          | Hex       | Token                             | Uso                                                                            |
| ------------- | --------- | --------------------------------- | ------------------------------------------------------------------------------ |
| primary       | `#1C2EDB` | `--mapit-color-primary`           | Palabra destacada en H1, enlaces activos, textos de acento                     |
| accent-fill   | `#3D4EF2` | `--mapit-color-accent`            | Chips activos, botones "Ver establecimiento", botón buscar, círculos numerados |
| on-primary    | `#FFFFFF` | `--mapit-color-on-primary`        | Texto sobre accent                                                             |
| primary-tint  | `#DFE0FF` | `--mapit-color-primary-container` | Iconos en símbolos circulares (categorías), resaltes suaves                    |
| nav-active-bg | `#EEF0FF` | `--mapit-color-nav-active-bg`     | Fondo de estados activos tipo píldora                                          |

### Surface & Neutral

| Role           | Hex       | Token                         | Uso                                             |
| -------------- | --------- | ----------------------------- | ----------------------------------------------- |
| page           | `#F9FAFF` | — (gradiente, ver abajo)      | Fondo de página (degradado hacia azul)          |
| card           | `#FFFFFF` | `--mapit-color-surface`       | Tarjetas de establecimiento y categoría         |
| section-alt    | `#EEF4FF` | —                             | Banda "Reservar es muy fácil" (degradado suave) |
| border         | `#E5E7EB` | `--mapit-color-border`        | Bordes de chips y tarjetas                      |
| text           | `#0F172A` | ~`--mapit-color-text`         | Titulares y texto principal                     |
| text-secondary | `#64748B` | ~`--mapit-color-text-variant` | Párrafos, metadatos, descripciones              |

### Semantic / Status

| Role       | Hex       | Token                                | Uso                                     |
| ---------- | --------- | ------------------------------------ | --------------------------------------- |
| available  | `#22C55E` | `--mapit-state-available`            | Punto verde de pills "Disponible…"      |
| rating     | `#F59E0B` | `--mapit-state-reserved` (mismo hex) | Estrella de valoración                  |
| badge-dark | `#0F172A` | —                                    | Pill "12 espacios disponibles" (oscuro) |

### CTA final (banda oscura)

| Role       | Hex                       | Uso                               |
| ---------- | ------------------------- | --------------------------------- |
| cta-bg     | `#1D4ED8` → `#1E3A8A`     | Degradado del banner final        |
| cta-text   | `#FFFFFF`                 | Titular y texto del banner        |
| cta-button | `#FFFFFF` (txt `#1D4ED8`) | Botón "Explorar establecimientos" |

Fondo de página: `radial-gradient` de `#EAF2FF` (arriba-derecha) a `#F9FAFF`.

## Typography

```css
--font-display: 'Manrope Variable'; /* titulares */
--font-body: 'Inter Variable'; /* UI */
```

| Style          | Familia | Size | Weight | Line height | Uso                                                                                    |
| -------------- | ------- | ---- | ------ | ----------- | -------------------------------------------------------------------------------------- |
| Hero H1        | Manrope | 40px | 700    | 1.15        | "Encuentra el lugar perfecto…"                                                         |
| Section H2     | Manrope | 26px | 700    | 1.25        | "Explora nuestros establecimientos"                                                    |
| Card title     | Manrope | 17px | 700    | 1.3         | Nombre de establecimiento                                                              |
| Eyebrow (hero) | Inter   | 12px | 700    | 1           | Solo hero landing, uppercase + tracking 0.14em. Las pills de sección fueron eliminadas |
| Body           | Inter   | 14px | 400    | 1.5         | Párrafos y descripciones                                                               |
| Meta           | Inter   | 12px | 400    | 1.4         | Ciudad, amenidades, "4.8 (124)"                                                        |
| Button         | Inter   | 13px | 600    | 1           | "Ver establecimiento"                                                                  |

## Shape

| Token   | Radius | Componentes                                        |
| ------- | ------ | -------------------------------------------------- |
| pill    | 999px  | Chips, botones accent, barra de búsqueda, eyebrows |
| md      | 12px   | Elementos pequeños internos                        |
| card    | 16px   | Tarjetas de establecimiento y de categoría         |
| card-lg | 20px   | Banner CTA final, banda de pasos                   |
| media   | 12px   | Imágenes dentro de tarjetas                        |

## Elevation

| Nivel     | CSS Shadow                     | Uso                         |
| --------- | ------------------------------ | --------------------------- |
| 0         | none + borde 1px `#E5E7EB`     | Categorías, hero            |
| 1 (cards) | `0 4px 12px rgb(0 0 0 / 0.05)` | Tarjetas de establecimiento |
| 2 (media) | `0 8px 24px rgb(0 0 0 / 0.10)` | Imagen del hero, mockups    |

## Interaction States

| Estado | Regla                                                                     |
| ------ | ------------------------------------------------------------------------- |
| Hover  | chips: borde accent; tarjetas: sombra nivel 2; links: color accent        |
| Focus  | `outline: 2px solid #3D4EF2; outline-offset: 2px` (visible)               |
| Active | chip activo: relleno accent + texto blanco                                |
| Motion | `150–250ms`, easing `cubic-bezier(0.22, 1, 0.36, 1)` (`--mapit-ease-out`) |

## Layout

- Contenedor: `max-width: 1120px`, centrado, padding lateral 24px.
- Hero: 2 columnas (texto ~55% / visual ~45%), colapsa a 1 columna bajo 900px.
- Categorías: heading a la izquierda + 4 tarjetas en fila (colapsan a 2×2, luego columna).
- Establecimientos: grid de 3 columnas (gap 24px), 2 columnas bajo 960px, 1 bajo 640px.
- Pasos: 5 columnas conector con línea; bajo 720px pasan a 2 filas/columna con scroll apilado.

## Icons

SVG inline, trazo 1.5px, esquinas redondeadas, 16–18px. Iconos del conjunto: lupa,
pin de mapa, estrella (rellena, rating), cubiertos (restaurante), copa/coctel (discoteca),
calendario (eventos), cama (hotel), ojo (eyebrow "Establecimientos"), wifi, parquing, etc.
No se instala librería de iconos (no aprobada); se reutilizan SVG inline como en el footer.

## Motion

Capa interactiva aplicada sobre la referencia estática (decisiones registradas en la
evaluación de valor UX de esta tarea):

| Motion                   | Implementación                                                                                                          | Justificación                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Route transition         | `withViewTransitions()` + fade 180ms ease-out (CSS `::view-transition`)                                                 | Panda pública tipo marketplace: transición suave entre landing y reservas. No escala ni se desliza. |
| Reveal on scroll         | directiva `mapitReveal` (IntersectionObserver nativo, fade + translateY 14px, 420ms ease-out, stagger 60–70ms en grids) | Orienta la aparición del contenido; alternativa literal a GSAP/ScrollTrigger para un caso simple.   |
| Hover tarjetas           | `translateY(-2/3px)` + sombra, gated con `@media (hover:hover)`                                                         | Solo en punteros finos (no en táctil).                                                              |
| Feedback de botón        | `scale(0.97)` en `:active`, 150ms ease-out                                                                              | Confirma la pulsación; estándar de la skill de motion.                                              |
| `prefers-reduced-motion` | Desactiva reveals y la transición de ruta completa                                                                      | El contenido aparece directamente, sin movimiento.                                                  |

**No se usa Lenis ni GSAP/ScrollTrigger en estas páginas**: no hay scroll
cinematográfico en la referencia; IntersectionObserver cubre el reveal sin peso extra.
