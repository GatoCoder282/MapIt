# MapIt Reservas (public-web) — Accessibility & Do's/Don'ts

> Tokens en [design.md](design.md); specs de componente en [design-components.md](design-components.md).

## Accessibility

### Contrast Requirements

| Requirement                  | Ratio |
| ---------------------------- | ----- |
| Texto normal sobre fondo     | 4.5:1 |
| Texto grande (≥24px)         | 3:1   |
| Iconos y bordes informativos | 3:1   |

| Componente               | 3:1 contra     |
| ------------------------ | -------------- |
| Borde de chips           | Fondo blanco   |
| Punto verde "Disponible" | Fondo del pill |
| Separador de pasos       | Fondo de banda |

Aclaraciones críticas:

- El texto `#64748B` (secondary) solo se usa sobre blanco/claro — nunca sobre la banda azul del CTA (ahí va `#FFFFFF` puro).
- El blanco sobre el accent `#3D4EF2` cumple 4.5:1 (botones); el accent NO se usa como texto pequeño sobre blanco; para texto acento se usa `#1C2EDB`.
- El pill oscuro "N espacios disponibles" usa texto blanco ≥12px.

### Touch Targets

- Chips y botones: mínimo 40×40px reales (los chips de la referencia miden ~36px de alto — se sube a 40px por accesibilidad, desviación documentada).
- Fila completa de amenidades NO es interactiva; el CTA por tarjeta es el botón "Ver establecimiento" (ancho completo).
- La lupa dentro de la barra de búsqueda es un `<button>` de 44px.

### Keyboard Navigation

| Tecla      | Acción                                                             |
| ---------- | ------------------------------------------------------------------ |
| Tab        | Nav → hero (búsqueda, chips) → categorías → tarjetas → pasos → CTA |
| Enter      | Activa chip/botón/enlace                                           |
| / o Ctrl+K | (no implementado — fuera de la referencia)                         |

### Assistive Technology

- Página con un único `<h1>` (el del hero); secciones con `<h2>` y `aria-labelledby`.
- Chips son `role="group"` con `button[aria-pressed]` y etiqueta visible.
- La imagen del hero es decorativa: `alt=""` y `aria-hidden`.
- Estrellas de valoración: icono `aria-hidden` + texto visible "4.8 (124 reseñas)".
- La tarjeta de confirmación de la sección de pasos es decorativa (`aria-hidden`).
- `prefers-reduced-motion`: se desactivan todas las transiciones.

## Gestures

| Gestos    | Uso                                      |
| --------- | ---------------------------------------- |
| Tap/click | Navegar a establecimiento, filtrar chips |
| Scroll    | Recorrido vertical de la página          |
| Swipe     | No implementado (fuera de referencia)    |

## Content Design

- Español, frases cortas; títulos en sentence case ("Explora nuestros establecimientos").
- Verbos de acción en botones: "Ver establecimiento", "Explorar establecimientos" (máx. 3 palabras).
- Numericación de rating: `N.N (NNN reseñas)`.
- Valores de ejemplo (ciudades, amenidades) son mock: La Bahía, Club Eclipse, etc.

## Do's and Don'ts

### Color

- **Do** usar `#3D4EF2` como relleno de CTA y `#1C2EDB` para texto de acento.
- **Don't** aplicar el azul crudo de la imagen (`#2563EB`) directo — los hex aprobados son los de marca.
- **Don't** introducir neones; la foto del "Club Eclipse" ya aporta color suficiente dentro de la imagen.

### Shape

- **Do** reservar radios 999px a pills (chips, botones, búsqueda) y 16px a tarjetas.
- **Don't** mezclar tarjeta con radio pill ni botón con radio recto.

### Elevation

- **Do** elevar con sombra suave en hover de tarjetas (no con borde grueso).
- **Don't** usar sombras duras tipo `0 2px 4px black`.

### Layout

- **Do** mantener contenedor máximo de 1120px; no estirar tarjetas al viewport completo.
- **Don't** romper el grid de 3 columnas en desktop intercalando contenido entre filas.

### Typography

- **Do** usar Manrope solo en titulares y precios/nombres destacados.
- **Don't** poner descripciones en Manrope ni titulares en Inter.

### Motion

- **Do** limitar motion a hover/focus ≤250ms con `ease-out`.
- **Don't** añadir parallax o animación on-scroll (la referencia no la muestra).
