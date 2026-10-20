# MapIt Console — Dashboard de administrador en home (CU-10) · Token Reference

> Referencia extraída de la imagen objetivo del dashboard de admin (home).
> Leer primero este archivo. Specs de componente: [design-components.md](design-components.md).
> Accesibilidad y do's/don'ts: [design-guidelines.md](design-guidelines.md).
>
> **Relación con el sistema global:** los tokens de MapIt viven en
> `libs/ui-kit/styles/_tokens.scss` y `libs/ui-kit/DESIGN.md` (fuente única). Este documento
> solo AÑADE el layout y las specs del dashboard; todo lo que ya existe (índigo de marca,
> Inter/Manrope, rejilla 4px, radios 4/8/12px) se reutiliza, no se redefine.

## Nota de paleta (importante)

La imagen de referencia usa un azul que coincide con `--mapit-editor-selection: #2563EB`
(el acento del editor de mapas, HU-4.01), **no** con el índigo de marca. Decisión: el
dashboard usa los tokens de marca existentes (`--mapit-color-primary: #1c2edb`,
`--mapit-color-accent: #3d4ef2`). No se importa `#2563EB` como color nuevo de la interfaz.

## Colors (reutilizados del sistema global)

| Role             | Token                                | Usage                                   |
| ---------------- | ------------------------------------ | --------------------------------------- |
| Canvas           | `--mapit-color-canvas` (#f7f8fa)     | Fondo de la página                      |
| Tarjeta          | `--mapit-color-surface` (#ffffff)    | Fondo de KPIs, listas, botones          |
| Marca (eyebrow)  | `--mapit-color-primary` (#1c2edb)    | Texto eyebrow, hover del botón primario |
| CTA              | `--mapit-color-accent` (#3d4ef2)     | Botón primario                          |
| Texto principal  | `--mapit-color-text` (#151c27)       | Valores KPI, títulos                    |
| Texto secundario | `--mapit-color-text-muted` (#6b7280) | Labels, intros, estados vacíos          |
| Borde            | `--mapit-color-border` (#e5e7eb)     | Bordes de tarjeta y botón secundario    |
| Error            | `--mapit-color-error` (#ba1a1a)      | Mensaje de error                        |

## Typography (escala existente)

| Style             | Uso en el dashboard                              |
| ----------------- | ------------------------------------------------ |
| label-caps (11)   | Eyebrow "Bienvenido de nuevo, {nombre}"          |
| display (20/600)  | Título de la página                              |
| body-md (14/400)  | Intro, mensajes de estado                        |
| section (18/600)  | Títulos de sección ("Establecimientos por tipo") |
| metadata (12/400) | Labels de tarjetas KPI (uppercase, tracking)     |

## Layout

- Contenido centrado, `max-width: 72rem`, con espaciado `--mapit-space-4` lateral.
- Fila de KPIs: grid auto-fit `minmax(14rem, 1fr)`, gap `--mapit-space-4`.
- Listas por tipo: filas flex space-between, gap `--mapit-space-2`.
- Accesos rápidos: botones en fila, gap `--mapit-space-2`.

## Shape

| Token                    | Uso                              |
| ------------------------ | -------------------------------- |
| `--mapit-radius-lg` 12px | Tarjetas KPI, botones            |
| `--mapit-radius` 8px     | Filas de lista, mensaje de error |

## Elevation

| Nivel | Sombra                               | Uso          |
| ----- | ------------------------------------ | ------------ |
| 1     | `--mapit-shadow` (0 4px 12px / 0.05) | Tarjetas KPI |

## Motion

Sin animaciones nuevas (veredicto `find-animation-opportunities`): hover del botón primario
cambia a `--mapit-color-primary` con las transiciones existentes; nada de GSAP, Lenis ni
entradas animadas — el contenido está en su posición final al primer render.
