# Diseño: landing pública inspirada en la referencia

**Estado: aprobado para implementación.** El enfoque y la dirección visual fueron aprobados por el usuario. Los valores aproximados son decisiones de implementación propuestas; ajustar solo cuando la referencia visual o el comportamiento real lo justifiquen.

## Intención

Una página de producto clara y cálida que explique MapIt mediante vistas ilustrativas del producto y casos de uso. Tomar de la referencia su ritmo compacto, contraste azul/blanco, fotografía gastronómica y mockups editoriales; respetar el orden expresamente indicado por el usuario aunque la captura distribuya algunos bloques de otra forma.

### Objetivos

- En los primeros segundos: comunicar qué es MapIt y mostrar el producto con contexto de restaurante.
- Presentar industrias, operación, sedes y reservas mediante contenido visual demostrativo, no métricas ficticias.
- Dar una ruta de contacto consistente: CTA a `/negocios#contacto`.
- Mantener navegación de reservas y footer existentes, accesibilidad, traducciones y presupuesto de la app pública.

### No objetivos / anti-objetivos

- No reconstruir la navbar ni reemplazarla por una navegación genérica: reutilizar `<mapit-ui-site-nav [compact]="true" />`.
- No inventar cifras, clientes, testimonios, precios, resultados comerciales, garantías ni promesas de soporte o integraciones.
- No mostrar datos operativos o personales reales en demos; usar etiquetas y datos sintéticos claramente ilustrativos.
- No añadir dependencias, imágenes generadas ni lógica de reservas/pagos a la landing.
- No convertir esta página de marketing en consola ni mostrar controles de staff como si fueran funcionales.

## Restricciones y contenido existente

- Aplicación Angular pública anónima; no importar `@mapit/auth`. Bundle límite indicado por `apps/public-web/AGENTS.md`: 800 kB.
- Textos visibles en `apps/public-web/src/app/core/strings.ts` y catálogos de idioma correspondientes; evitar literales en templates. Revisar todos los idiomas al incorporar claves.
- `apps/public-web/src/app/features/landing/landing.html` ya conserva navbar/footer compartidos y monta componentes independientes. Orden presente: hero, problema, product, business-types, editor, booking, dashboard, realtime, CTA. La propuesta reemplaza el orden, no el chrome compartido.
- Tokens claros existentes en `landing.scss`: superficie blanca, azul pálido `#f0f3ff`, texto `#151c27`, texto variante `#454656`, muted `#6b7280`, borde `#e5e7eb`. Hero usa ahora degradado `#f8fbff`–`#eaf2fd`; ajustar localmente para que el hero sea blanco y reservar azul pálido para bandas.
- Fuente: conservar `--mapit-font-display` para titulares y `--mapit-font-sans` para lectura/UI; revisar su apariencia actual antes de cambiar tipografías.
- Strings actuales ya contienen el vocabulario para industrias, operación, tabla de sedes, reservas/QR, pasos e invitación. Aprovecharlos donde sean exactos; validar especialmente que el texto describa funciones disponibles y condicionales.

## Alternativas

1. **Adaptar los componentes actuales — recomendada.** Reordenar el montaje, reutilizar imágenes, markup de tabla y copy ya existente; ajustar plantillas/SCSS. Crear solo el componente de cuatro pasos si no existe un patrón que encaje. Menos duplicación, respeta arquitectura y el coste bajo de mantenimiento.
2. **Reconstrucción integral — descartada.** Una landing monolítica nueva duplicaría componentes, copy y estilos existentes, aumentaría el riesgo de accesibilidad/i18n y el coste de revisión sin una necesidad visual que lo justifique.

## Dirección visual propuesta

- **Paleta aproximada:** blanco `#fff` dominante; canvas `#f7f8fa`; bandas azul hielo `#f0f3ff`; texto tinta `#151c27`; azul de acción tomado del token `--mapit-color-accent` (no fijar hex hasta inspeccionar el token); fotografía cálida como acento natural, no como nuevo color de marca.
- **Espaciado:** contenido central ancho máximo aproximado `1200px`; margen lateral fluido `24–48px`; secciones con `72–96px` vertical en desktop y `48–64px` en móvil. Mantener el conjunto compacto respecto a una landing corporativa extensa; evitar grandes vacíos entre bloques.
- **Titulares:** display pesado, tracking ligeramente negativo; hero aproximado `clamp(2.25rem, 5vw, 4rem)`, line-height 1.02–1.1. Cuerpo 16–18px, line-height 1.55–1.7. La segunda línea del hero y palabras puntuales usan azul de acción; no teñir párrafos completos.
- **Cards y superficies:** radios moderados (12–20px), bordes sutiles y sombras solo para elevar mockups. Azul pálido en alternancia de bloques, no como fondo continuo.
- **Movimiento:** conservar `mapitReveal` existente si es respetuoso con `prefers-reduced-motion`; evitar animación autónoma o esencial para comprender la página.

## Secciones y composición

1. **Navbar:** usar componente compartido de reservas sin alterar sus rutas, botones ni comportamiento. Fondo blanco visualmente continuo con el hero.
2. **Hero dividido, compacto:** copy a la izquierda (eyebrow, titular tinta en dos líneas con acento azul en línea 2, descripción y CTA); visual grande a la derecha. Recrear un portátil con sidebar, plano de mesas y panel de reserva, más un teléfono de reservas parcialmente superpuesto, sobre fotografía cálida de restaurante. Ambos son HTML/CSS estático con datos sintéticos y etiqueta de demostración, nunca pantallas conectadas a datos privados.
3. **Industrias:** título y breve intro, seguidos de cuatro tarjetas con imagen y nombre —restaurantes, discotecas, salones de eventos y hoteles— en desktop. Reutilizar la fotografía existente; no reemplazar por placeholders.
4. **Operación en vivo:** banda azul pálido o composición con fondo blanco y panel azul. Laptop/mockup HTML a la izquierda y título, explicación y cuatro capacidades verificables a la derecha. Usar el mapa visual ilustrativo existente solo como imagen o construir demostración CSS/HTML; no incorporar mapa staff real ni datos privados.
5. **Varios establecimientos:** copy breve a la izquierda y tabla ilustrativa a la derecha, sobre azul pálido. Marcar claramente “ejemplo ilustrativo”; datos de filas sintéticos. No implicar que estados/roles mostrados sean datos actuales.
6. **Reservas y QR:** foto de mesa/restaurante a la izquierda; copy y teléfono HTML de booking a la derecha (invertir en mobile según lectura). Explicar consulta de disponibilidad, reserva y anticipo por QR solo en términos que correspondan a funciones realmente disponibles. Añadir nota de demo si el QR no transacciona.
7. **Cómo funciona:** cuatro pasos numerados en una línea horizontal, con conexión gráfica discreta; en móvil, lista vertical. Usar pasos existentes de configuración, plano, reglas/disponibilidad y operación. Este bloque tendrá `id="como-funciona"` en la landing. No prometer duración o facilidad cuantificada.
8. **Capacidades complementarias verificadas:** bloque corto, no prueba social. Preferir capabilities explícitas en strings/features actuales (mapa interactivo, disponibilidad/reservas, sincronización en tiempo real, indicadores) tras confirmar su vigencia. Sin cifras, logotipos ni claims comerciales añadidos. Si no hay contenido adicional verificable, integrar los puntos en operación y no forzar una sección vacía.
9. **CTA final:** panel redondeado azul/degradado sutil, mensaje concreto y botón de contacto; imagen diagonal/cálida a la derecha si un asset existente encaja. Conservar `/negocios#contacto`. Evitar claims de crecimiento/resultado; la invitación a solicitar acceso debe ser cierta.
10. **Footer:** mantener el compartido y su variante compacta.

### Assets existentes (rutas exactas)

Usar y comprobar visualmente antes de asignar cada rol; existencia no garantiza encaje ni derechos/alt text adecuados:

- Industria: `apps/public-web/public/assets/img/reservas/restaurant.webp`, `nightclub.webp`, `hotel.webp`, `events.webp`; también `Tenants.jpg` y `Tenants.png` (la plantilla actual referencia `Tenants.jpg`).
- Hero/foto: `apps/public-web/public/assets/img/reservas/hero.jpg`, `imagen_inicio_reservas.png`.
- Reservas/QR: `apps/public-web/public/assets/img/Reserva_sin_llamar.png`, `apps/public-web/public/assets/img/landing/qr-reference.jpg`.
- Producto/mapa/dashboard: `apps/public-web/public/assets/img/mockup_app.png`, `product_map.png`, `dashboards.png`, `dashboard.png`, `Herramientas.png`.
- Marca: `apps/public-web/public/assets/img/logo_mapit.png`.

La referencia visual original no está disponible como archivo local en esta fase; el parecido exacto de crop, color y proporciones queda pendiente de comparar con la captura suministrada.

## Navegación y CTA

- Navbar de reservas permanece exactamente como componente: `<mapit-ui-site-nav [compact]="true" />`.
- CTA principal del hero y CTA final: enlace real `/negocios#contacto`; comprobar que ancla y ruta existen en la aplicación integrada. No enlazar a un formulario inexistente.
- CTA secundaria del hero puede apuntar a `#como-funciona`; el bloque de pasos debe tener ese id. Usar enlaces nativos y focus visible.
- No añadir controles de login ni rutas de staff a esta landing salvo que ya sean parte del navbar compartido.

## Responsive

- **Referencia desktop (aprox. 992 px):** hero en dos columnas con visual dominante; secciones con alternancia de lados y contenedores generosos. A 992 px no asumir el espacio de un monitor ancho: reducir gaps y titular para conservar ambas columnas legibles.
- **Tablet (768 px):** conservar dos columnas solo si copy y visual mantienen ancho útil; si no, apilar. Industrias puede usar 2×2; pasos 2×2.
- **Móvil (390 px):** todas las columnas a una; headline y CTA primero, mockup después; cards en 2 columnas si legibles, de lo contrario lista/desplazamiento no. Tablas deben preservar encabezados y lectura, no encogerse hasta ilegibilidad. Mockups no deben causar overflow; ocultar decoración no esencial, nunca contenido esencial.
- **Móvil estrecho (360 px):** sin scroll horizontal, botones con target cómodo, labels y tabla legibles; evitar anchos mínimos de laptop/device.
- Imágenes con dimensiones/aspect ratio reservados, `object-fit` intencional y carga prioritaria solo para el visual LCP; below-the-fold lazy.

## Accesibilidad, i18n, SEO y rendimiento

- Un `h1` único; jerarquía de headings ordenada; regiones semánticas y nombres de sección comprensibles. Alt describe información visual relevante; imágenes decorativas tienen alt vacío. Los mockups se etiquetan como ilustrativos.
- Contraste AA para texto y controles; foco visible; no depender solo del color para los pasos/estados. Demos HTML son estáticas y no aparentan ser controles interactivos. Tabla con `caption`, encabezados y scopes si se implementa como tabla real.
- Reducir/retirar reveal con `prefers-reduced-motion`; orden de lectura DOM coincide con orden narrativo, no depender de CSS `order` para corregir secuencia.
- Todo texto UI, alt, captions, nombres de capacidades y botones en `core/strings.ts` y catálogos; revisar longitud/traducción en cada locale. Evitar screenshots con texto localizable incrustado cuando puede montarse en HTML.
- Mantener title/description/canonical y metadatos existentes; no crear promesas SEO sin respaldo. Asegurar que contenido esencial y enlaces existen en HTML renderizado por Angular aunque no haya SSR.
- Reutilizar assets locales y `NgOptimizedImage`/`ngSrc` cuando corresponda; no instalar librerías ni duplicar imágenes en CSS. Revisar peso de imágenes y presupuesto de 800 kB al build.

## Alcance de implementación

1. Reordenar el montaje y ajustar las plantillas/estilos existentes de hero, industrias, operación, sedes, booking, CTA; retener navbar/footer.
2. Añadir solo la mínima sección de pasos si no hay componente existente reutilizable. Capacidades complementarias se integran en operación si son repetición.
3. Actualizar strings y catálogos para diferencias necesarias; asignar assets solo tras inspección visual. No tocar rutas/backend/contratos, inventario de capacidades ni navegación compartida.
4. Verificar luego de la aprobación del diseño y reportar cualquier imagen/capacidad que no encaje en lugar de fabricarla.

## Criterios de aceptación visual y funcional

- Orden: hero → industrias → operación → establecimientos → reservas/QR → cuatro pasos → capacidades verificadas (o integradas si redundantes) → CTA → footer.
- En desktop: hero de dos columnas, fotografía cálida con mockup, industrias fotográficas, alternancia de composición clara/azul pálido y CTA final destacado. No hay claims sociales o números inventados.
- Navbar y footer existentes; CTA lleva a `/negocios#contacto`; ancla secundaria lleva a pasos.
- En 360, 390, 768, 1280 y 1440 px: sin overflow horizontal ni texto cortado; navegación, CTAs, tabla, cards y pasos utilizables. Comparar screenshots locales de esos anchos con la referencia adjunta; la diferencia automatizada píxel a píxel requiere el original como archivo local.
- Validar teclado/foco, alt/semántica, contraste, reduced-motion, traducciones, imágenes/alt y peso de build. No introducir fallos de plantilla Angular.
- El entorno ya tiene listeners en `::1:4300` y `::1:4200`, Playwright 1.62.1 y Chromium/headless instalados. **Reutilizar** `http://[::1]:4300/` para las comprobaciones aisladas de landing; no reiniciar los servidores. El stack/backend no hace falta para esta página de marketing; E2E de negocio sí requiere backend.
- Capturar screenshot full-page con Playwright CLI, por ejemplo `pnpm --filter @mapit/e2e exec playwright screenshot --browser chromium --viewport-size="360,900" --full-page "http://[::1]:4300/" "landing-360.png"`; repetir para anchos 390, 768, 1280 y 1440 (altura de viewport 900). Revisar consola/overflow e interacción CTA con navegador local. No instalar dependencias; si el listener ya no responde, reportar el bloqueo y no reiniciar sin autorización.

## Gaps pendientes antes de construir

- La captura de referencia no está guardada en el repositorio en esta fase; obtenerla para comparación pixel/recorte, sin bloquear decisiones de estructura.
- Inspeccionar visualmente dimensiones/crops y contenido de cada asset antes de fijarlo a sección; esta lista solo confirma rutas.
- No son bloqueos de producto: el QR de marketing llevará la nota ilustrativa existente; no procesa pagos. Los pagos reales solo se describen con las condiciones verificadas en el código.
- `/negocios#contacto` fue localizado en la aplicación; comprobar su navegación durante las pruebas. Las demos estáticas de consola están permitidas: la restricción de public-web prohíbe exponer o solicitar datos internos reales, no ilustrar el producto.
