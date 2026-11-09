# Selector de establecimiento — Componentes

> Especificación de una superficie de consola; los colores y medidas inferidas se explican en [design.md](design.md), y los requisitos operativos/accesibles en [design-guidelines.md](design-guidelines.md).

## Contención

### Diálogo de selección obligatorio

| Propiedad              | Especificación                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Primitiva              | `<dialog>` nativo, abierto con `showModal()`.                                                                                             |
| Tamaño en referencia   | Aproximadamente 1046 × 616 px; estimación del brief, no medida de imagen disponible.                                                      |
| Centrado en referencia | Viewport 1810 × 869; x≈382, y≈127, medidas aproximadas.                                                                                   |
| División               | Panel azul ~36%, panel blanco ~64%, proporción aproximada.                                                                                |
| Radio                  | ~28 px, excepción exclusivamente local.                                                                                                   |
| Fondo                  | Scrim oscuro con desenfoque del shell; opacidad y blur por validar visualmente.                                                           |
| Descartar              | Sin cierre en selección inicial; en reapertura, X y Escape solo si una selección previa sigue autorizada. Nunca cerrar por clic exterior. |

Debe cubrir la aplicación sin modificar su shell o tokens globales. El foco se mantiene dentro mediante comportamiento nativo modal.

### Panel de marca

- Fondo de gradiente eléctrico local desde `#104BFF` a azul noche `#111D77`; no propagar estos tonos a los tokens globales.
- Contenido: insignia de storefront delineada, título y apoyo; más abajo, icono decorativo mapa/pin a la izquierda de tres beneficios con checks. Usar strings aprobados, sin añadir promesas de producto.
- Retícula de puntos blancos y ondas rellenas de bajo contraste como decoración `aria-hidden`; mantener contraste WCAG AA para los textos blancos.
- El panel es una excepción local a la preferencia global por superficies sobrias; no propagar estilo ni introducir una paleta global.

## Acciones

### Continuar

- Botón primario ancho completo, fondo canónico `#2563EB`, texto blanco, flecha Lucide hacia la derecha con `aria-hidden`.
- Usar tipografía Inter y radio de botón MapIt (8–12 px). La altura exacta no se puede extraer del screenshot; objetivo táctil mínimo recomendado 44 px.
- Deshabilitado durante carga, sin selección, error no recuperado o selección no validada. Activado solo con una opción accesible elegida y validada.
- Foco visible de 2 px; hover `#1D4ED8`. No añadir animaciones que retrasen la acción.

### Cerrar sesión

- Acción secundaria textual, visible en el flujo (no como icono de cierre). Es la salida segura del modal no descartable, nunca una omisión de selección.
- No competir visualmente con Continuar; conservar acceso por teclado y nombre accesible claro.

## Selección

### Opción de establecimiento

- Dos tarjetas horizontales en escritorio, cada una representa una opción real de la respuesta del servidor.
- Estructura: miniatura gráfica neutral común (aprox. 150 × 98 px en escritorio; adaptada en compacto), nombre real, etiqueta neutral “Establecimiento” (no es una categoría) y dirección real o “Sin dirección registrada”. El endpoint no aporta tipo; no inferirlo ni mostrar una clasificación.
- No usar foto de stock como si representase el establecimiento, ni generar tipo desde nombre, slug, dirección o permisos.
- Grupo de radios nativo. Toda la tarjeta es un objetivo de selección; incluir radio visible y nombre accesible. Borde azul y superficie `#DBEAFE` para selección; borde `#E2E8F0` para reposo. Añadir foco distinguible del estado marcado.
- Al menos 44 px de alto para controles; tarjeta puede ser más alta según contenido. Mantener texto legible a zoom 200%.

## Identidad y ornamento

### Marca Mapit

- Usar el activo local de marca ya disponible en `apps/console/public/assets/img/` (escoger variante apropiada para el panel blanco) en lugar de recrear el logotipo con texto o descargar otro.
- Insignia storefront y flecha de CTA: `@lucide/angular`, ya instalado en `apps/console`; no sumar familias de iconos.
- Iconos solo decorativos con `aria-hidden="true"`; no reemplazar etiquetas textuales con iconos.

## Feedback y estados

Los siguientes diseños son propuestas funcionales requeridas; **no aparecen en la referencia visual**:

### Cargando

- Conservar modal y composición; mostrar indicador sobrio en el espacio de opciones y texto de carga. CTA deshabilitado y estado comunicado al lector de pantalla.
- Evitar falsa tarjeta seleccionable mientras la lista no esté disponible.

### Error

- Mensaje legible en la zona derecha y botón “Reintentar”. Mantener intacta la zona izquierda y el estado modal; mostrar “Cerrar sesión” como salida segura.
- No convertir el error en cierre automático ni ofrecer navegación de omisión.

### Sin opciones

- Mensaje de lista vacía, CTA deshabilitado y salida “Cerrar sesión”. No inventar tarjeta de onboarding/alta ni establecimiento de ejemplo.

## Adaptación responsive

- Escritorio: composición lado a lado ~36/64; opciones horizontales conforme a la referencia.
- Compacto: una columna; panel de marca más breve, opciones apiladas y controles/CTA sin desbordamiento. Mantener jerarquía de título → opciones → acción.
- Altura corta: scroll interno con `overscroll-behavior: contain`, CTA y salida alcanzables, ningún contenido oculto bajo el teclado virtual. El límite, los márgenes y el padding móvil respetan `env(safe-area-inset-*)`.
- La implementación cambia a una columna en `≤860px`, alineada con el breakpoint responsive del shell. Es una decisión del producto implementado, no una medida de la referencia.

## Movimiento

El selector es una interacción ocasional, pero la selección de datos debe sentirse inmediata. Oportunidad única de bajo impacto: entrada del diálogo con `opacity` y escala muy sutil, 180 ms, usando `--mapit-ease-out`; no animar lista, selección de radio, CTA ni decoración. Respetar `prefers-reduced-motion`. La duración está dentro del presupuesto de modales del skill de oportunidades; es una recomendación, no código ni evidencia de una baseline.
