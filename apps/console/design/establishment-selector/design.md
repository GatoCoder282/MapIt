# Selector de establecimiento — Referencia visual

> Superficie de entrada de la consola MapIt. Este documento especifica únicamente el selector modal; no redefine los tokens globales. Para accesibilidad y estados, ver [design-guidelines.md](design-guidelines.md); para componentes, ver [design-components.md](design-components.md).
>
> **Fuente de verdad visual:** descripción y referencia entregadas por el usuario. La captura original no está disponible como archivo local; las medidas, proporciones y tonos que no pueden confirmarse se marcan como aproximados/inferidos.

## Dirección

Composición de bienvenida en dos zonas: panel de marca azul a la izquierda y selección funcional sobre superficie blanca a la derecha. La zona azul conserva la composición eléctrica/degradada de la referencia, con decoración de baja intensidad; la interfaz de selección emplea el azul canónico MapIt y los estilos tipográficos existentes. Excepción estrictamente local: no cambia la paleta ni los tokens globales.

## Paleta y superficie

| Rol              | Valor                                             | Uso / certeza                                                                                                  |
| ---------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| CTA y selección  | `#2563EB`                                         | Primario canónico de `_tokens.scss`; botón, radio seleccionado y foco.                                         |
| Hover primario   | `#1D4ED8`                                         | Token global vigente.                                                                                          |
| Selección suave  | `#DBEAFE`                                         | Contenedor primario canónico; tarjeta seleccionada.                                                            |
| Superficie       | `#FFFFFF`                                         | Panel derecho y tarjetas.                                                                                      |
| Lienzo auxiliar  | `#F8FAFC`                                         | Solo si hace falta una superficie neutra local.                                                                |
| Texto principal  | `#0F172A`                                         | Token global.                                                                                                  |
| Texto secundario | `#334155`                                         | Token global; copy y metadatos con contraste suficiente.                                                       |
| Borde            | `#E2E8F0`                                         | Token global; tarjeta no seleccionada.                                                                         |
| Foco             | `rgb(37 99 235 / 0.2)`                            | Halo global de foco, además de contorno visible.                                                               |
| Panel izquierdo  | Degradado eléctrico local (`#104BFF` → `#111D77`) | **Inferido visualmente** de la descripción; valores locales, no tokens globales ni reproducción pixel-perfect. |
| Scrim            | Negro translúcido con desenfoque del shell        | Oscuridad y blur pedidos; opacidad/radio no medibles sin captura, por definir visualmente en implementación.   |

Los tokens globales documentados en `libs/ui-kit/styles/_tokens.scss` son la base. No añadir ni modificar variables compartidas para satisfacer esta composición.

## Tipografía

| Uso                                  | Fuente / estilo                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| Títulos y encabezados                | Manrope Variable; tokens existentes `--mapit-text-display` / `--mapit-text-section`. |
| Texto funcional, tarjetas y acciones | Inter Variable; tokens `--mapit-text-body` / `--mapit-text-body-bold`.               |
| Dirección y metadatos                | Inter Variable; `--mapit-text-metadata`, color secundario de contraste legible.      |
| Texto en el panel azul               | Blanco; verificar contraste sobre todos los puntos del gradiente.                    |

No se dispone de medida tipográfica verificable de la captura; la escala exacta se ajustará visualmente manteniendo la jerarquía anterior.

## Geometría de referencia

| Elemento          | Medida / proporción                                                        | Certeza                                                                           |
| ----------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Viewport mostrado | `1810 × 869 px`                                                            | Dato de la referencia descrita.                                                   |
| Modal             | `≈1046 × 616 px`, centrado en `x≈382, y≈127`                               | Aproximado; proporcionado por el usuario, no medido desde el archivo original.    |
| División          | Izquierda `≈36%`, derecha `≈64%`                                           | Aproximada; objetivo visual del brief.                                            |
| Radio exterior    | `≈28 px`                                                                   | Excepción local aproximada; no ampliar token global.                              |
| Contenido azul    | Insignia a `≈112 px` del borde superior; título a `≈223 px`.               | Ajuste visual basado en la descripción del usuario; responsive compacto en móvil. |
| Beneficios        | Icono mapa/pin a la izquierda; tres filas de check alineadas a su derecha. | Composición aproximada; textos vienen de strings aprobados.                       |
| Tarjetas          | Filas de `≈140 px`; miniatura neutral horizontal de `150 × 98 px`.         | Aproximado; nombre/dirección reales, sin foto ni categoría inventada.             |

Mantener una composición generosa: insignia de storefront, título “Seleccioná tu establecimiento”, texto de apoyo y tres beneficios en el panel azul; identidad Mapit, pregunta “¿Con cuál establecimiento querés entrar?”, subtítulo, opciones y CTA “Continuar” en el panel blanco.

## Forma y profundidad

- Contenedor modal con radio local aproximado de 28 px; tarjetas y botones siguen radios MapIt de 8–12 px salvo que la referencia confirme otra cosa.
- Sombra y scrim deben separar el modal con claridad, sin sustituir el desenfoque del fondo solicitado por una sombra pesada.
- Puntos/arcos del panel izquierdo: decorativos, tenues y `aria-hidden`; no competir con título o bullets.
- Insignia y flecha se dibujan con Lucide existente. No usar símbolos emoji.

## Datos veraces

El endpoint verificado `/api/v1/establishments/accessible` aporta `id`, `name`, `slug`, `address` nullable, `timezone`, `canManagePayments` y `canCheckIn`; no proporciona fotografía ni tipo. La tarjeta usa **miniatura genérica neutral, igual para todas**, y omite el tipo (no inferirlo). Dirección nula usa el string existente “Sin dirección registrada”. No crear fotografías de locales ni clasificaciones ficticias.

## Fuentes de proyecto

- Tokens compartidos: `libs/ui-kit/styles/_tokens.scss` y su especificación `libs/ui-kit/DESIGN.md`.
- Este documento es una guía específica de consola, sin cambios a la paleta global ni a la documentación del editor.
