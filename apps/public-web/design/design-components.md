# MapIt Reservas (public-web) — Component Specs

> Specs de los componentes detectados en la imagen de referencia, agrupados por flujo.
> Tokens en [design.md](design.md); reglas y accesibilidad en [design-guidelines.md](design-guidelines.md).

---

## Navigation

### Nav bar (compartida, vive en `libs/ui-kit`)

Barra blanca sticky, altura 64px, borde inferior 1px `#E5E7EB`, blur 12px si hay transparencia.

| Elemento    | Spec                                                                 |
| ----------- | -------------------------------------------------------------------- |
| Logo        | Imagen MapIt a la izquierda, enlaza a `/`                            |
| Links       | Producto, Cómo funciona, Negocios, **Reservas** (router `/reservas`) |
| Link activo | Texto `#1C2EDB` + subrayado de 2px en `#3D4EF2`                      |
| Link normal | `#64748B`, hover a `#0F172A`                                         |
| Derecha     | Link "Iniciar sesión" (texto) + botón pill "Solicitar acceso →"      |
| Mobile      | Hamburguesa con panel desplegable (mismo conjunto de enlaces)        |

### Footer (compartido, vive en `libs/ui-kit`)

Fondo blanco, borde superior 1px `#E5E7EB`; logo a la izquierda, links al centro,
sociales a la derecha; debajo, copyright pequeño en gris. **Cambia respecto al footer
oscuro previo del landing: la referencia lo muestra claro y se adopta para ambas páginas.**

| Elemento | Spec                                           |
| -------- | ---------------------------------------------- |
| Links    | Mismos 4 de nav, `#64748B`, hover `#0F172A`    |
| Social   | Iconos SVG 16px, `#64748B`, hover accent       |
| Copy     | `© 2026 MapIt. Todos los derechos reservados.` |

---

## Input

### Search bar (hero)

| Propiedad   | Valor                                                                        |
| ----------- | ---------------------------------------------------------------------------- |
| Altura      | 48px, radius 999px, fondo blanco, borde `#D1D5DB`                            |
| Placeholder | "Buscar establecimiento, ciudad o tipo de negocio…", `#94A3B8`               |
| Icono       | Lupa 16px a la izquierda del input                                           |
| Acción      | Botón circular accent 40px a la derecha (lupa blanca); `aria-label="Buscar"` |
| Focus       | Halo 2px accent al 20% (token `--mapit-color-focus-ring`)                    |

### Chip de categoría (filtro)

| Estado   | Fondo     | Borde         | Texto     |
| -------- | --------- | ------------- | --------- |
| Inactivo | `#FFFFFF` | `#E2E8F0` 1px | `#334155` |
| Activo   | `#3D4EF2` | `transparent` | `#FFFFFF` |

Altura 40px, padding 0 20px, radius 999px, `aria-pressed`. Conjunto: Todos, Restaurantes, Discotecas, Eventos, Hoteles.

---

## Data Display

### Eyebrow pill (etiqueta de sección)

**Eliminada (decisión de diseño).** Las secciones de `reservas` abren directo con
H2 + subtítulo; ya no existe etiqueta/pill previa (`categories`, `steps`, `cta`).
El eyebrow del hero de landing se mantiene como texto plano uppercase (`.hero-eyebrow`),
sin forma de píldora.

### Category card (categoría de navegación)

Tarjeta blanca 16px de radio, borde `#E5E7EB`, padding 20px, ancho flexible.

| Elemento  | Spec                                            |
| --------- | ----------------------------------------------- |
| Icono     | Círculo 40px fondo `#DFE0FF`, icono accent 20px |
| Título    | Manrope 16px 700                                |
| Subtítulo | Inter 12px 400 `#64748B`, 1–2 líneas            |
| Flecha    | "→" 16px en `#3D4EF2`, margen-superior auto     |
| Hover     | Sombra nivel 2 + flecha se desplaza 4px         |

Set exacto: **Restaurantes** ("Gastronomía y buen ambiente"), **Discotecas** ("Música, tragos y diversión"), **Eventos** ("Celebraciones y momentos especiales"), **Hoteles** ("Descanso y comodidad").

### Establishment card (popular)

Tarjeta blanca, radio 16px, sombra nivel 1, padding 0 (la imagen toca el borde interno con 4px de margen).

| Bloque    | Spec                                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Imagen    | Altura ~190px, radio 12px (propia), `object-fit: cover`                                                                                                                            |
| Badge     | Pill blanco (fondo rgba blanco 95%) arriba-izquierda sobre la imagen: punto verde 8px + texto 11px 600. Variante oscura: fondo `#0F172A`, texto blanco ("12 espacios disponibles") |
| Nombre    | Manrope 17px 700, `#0F172A`                                                                                                                                                        |
| Meta      | Fila: pin 12px + ciudad · icono categoría 12px + tipo — todo Inter 12px `#64748B`                                                                                                  |
| Rating    | Estrella rellena `#F59E0B` 13px + `4.8` 600 `(124 reseñas)` en gris                                                                                                                |
| Amenities | Fila de máx. 3 items: icono 13px + label 11px `#64748B`                                                                                                                            |
| CTA       | Botón pill accent, ancho completo, alto 36px, texto "Ver establecimiento →", blanco 600                                                                                            |

Datos mock (6): Restaurante La Bahía, Club Eclipse, Hotel Los Tajibos, Salón Real, Sky Lounge, Hotel Gran Amazona — ver `establishments.data.ts` (fuente).

### Reservation confirmation (decorativa, sección pasos)

Tarjeta blanca estilo móvil: icono check en círculo accent sobre tinte, título
"Reserva confirmada", establecimiento + fecha, QR decorativo en CSS (grid 12×12 de
módulos negros con ojos en esquinas), botón pill "Ver detalles" en gris claro.
A la derecha, foto/placeholder con pill azul "Pago de anticipo por QR". `aria-hidden`:

### Step indicator (pasos)

5 pasos en fila conectados por línea `#CBD5F5` 2px. Círculo 36px: accent con número
blanco 14px 700. Bajo el círculo: título Inter 13px 700 + descripción Inter 12px 400.
Textos: 1 "Busca tu lugar", 2 "Selecciona espacio", 3 "Completa tu reserva", 4 "Paga el anticipo", 5 "¡Listo!".

---

## Containment

### Hero block

Dos columnas: izquierda eyebrow + H1 (con tramo "reserva tu espacio." en `#1C2EDB`) +
párrafo + search + fila de chips; derecha imagen `assets/img/imagen_inicio_reservas.png`
con sombra nivel 2 y radio 16px. Fondo de sección con gradiente radial azul muy suave.

### CTA banner (final)

Banda a lo ancho del contenedor con radio 20px y gradiente `#1D4ED8→#1E3A8A` con halo
blanco radial decorativo. Eyebrow en pill blanco/10%, H2 blanco ("Explora, descubre y
reserva."), subtítulo blanco/80%, botón pill blanco con texto `#1D4ED8` a la derecha
(en columna de acciones). Padding 48px; en mobile, apila.

### Section band (pasos)

Franja de fondo `#EEF4FF` degradado, radio 20px, padding 40–48px, contiene heading,
fila de pasos y el bloque de confirmación a la derecha.

---

## Feedback

### Rating (reutilizado en tarjetas)

Estrella 13px `#F59E0B` + valor 600 + "(N reseñas)" `#64748B` en Inter 12px.
El valor nunca se muestra sin el conteo (evita sesgo visual).
