# Reservas — implementación de la referencia del usuario

## Alcance

Referencia principal: «Mapit, descubre y reserva fácilmente». Hero con la segunda fotografía aportada, buscador integrado, seis categorías, catálogo de tres columnas (dos en tablet, una en móvil), tres pasos, CTA azul y pie compacto. Manrope e Inter locales. Sin franja de beneficios, estrellas, amenidades, QR decorativo ni descargas.

Se conservan el catálogo público y las rutas de disponibilidad por tenant y establecimiento. Se muestran seis resultados reales por página. Las variantes compactas de navegación y pie son opcionales; el resto de páginas mantiene sus componentes habituales. Los tokens de la referencia se limitan al host de Reservas.

## Límites del contrato actual

- La API devuelve nombre, dirección, tipo e identidad pública, sin fotografías ni ciudad estructurada. Las fotos son ilustrativas por categoría, con aviso visible y créditos locales.
- La búsqueda por texto sigue en el servidor. Ubicación (dirección), categoría y orden alfabético operan sobre la página recibida. El contador lo indica expresamente. No hay total global ni ranking en el contrato; «Más relevantes» conserva el orden recibido.
- Eventos y Salones corresponden al mismo tipo público `EVENT_HALL`. Otros recoge tipos no reconocidos.
- La fecha se traslada a disponibilidad; allí el visitante elige las horas y consulta los datos reales. Personas es una preferencia de 1 a 20 que se muestra al consultar disponibilidad, sin afirmar que el catálogo tenga capacidad o disponibilidad garantizadas. No se modifica el contrato de creación de reservas.

## Verificación

Pruebas del store cubren dirección/categoría, orden sin mutación, selección vacía, parámetros de navegación, paginación y cancelación de respuestas anteriores. Disponibilidad valida el rango de personas procedente de la URL.

Revisión con Playwright contra el catálogo real a 1440, 1024, 768 y 390 píxeles, sin desbordamiento horizontal. Capturas entregadas fuera del repositorio como artefactos `reservas-{ancho}.png`.

Herramientas: skills Ponytail y design-taste-frontend, documentación Angular 22 por Context7, Angular CLI local, ESLint, TypeScript y Playwright. No se utilizaron subagentes ni dependencias nuevas. El brief visual prevalece sobre las prohibiciones genéricas de sombras, degradados y separadores de la skill de diseño; no se aplicó una dirección aleatoria.

## Resultados de ejecución

- Public-web: 125 pruebas aprobadas en 19 archivos; se añadió además una prueba focalizada del CTA.
- Librerías: 81 pruebas aprobadas en 16 archivos.
- ESLint y TypeScript de los archivos afectados: sin errores.
- Build de producción: correcto; bundle inicial cercano a 500 kB, por debajo del límite de error de 800 kB. Persisten avisos de presupuesto de advertencia de 400 kB, estilos de disponibilidad/pagos/navegación y dependencias CommonJS.
- Navegador real: búsqueda por texto, filtro de dirección sin resultados, activar/desactivar categoría, orden alfabético, error de red simulado y reintento, menú móvil e idiomas es/en/ja-JP. Flujo real hasta consultar horario, seleccionar espacio y abrir el formulario de reserva. No se envió una reserva.
- El CTA enfoca el catálogo en la misma página; se corrigió el ancla relativa anterior que resolvía contra la portada por el base href.
- El inspector propio de design-taste-frontend no pudo abrir Chrome (crashpad); se sustituyó por Playwright para capturas y medidas. Su lint estilístico señala sombras, degradados y separadores solicitados expresamente por la referencia; se conservan por fidelidad al brief.
- No se ejecutó pnpm check completo ni se tocaron cambios previos de consola/backend. pnpm falló al abrir su base de datos local; se ejecutaron las herramientas ya instaladas mediante Node 24.

## Archivos y componentes

- `features/reservas/`: hero, categorías, catálogo, pasos, CTA, composición y tokens de página; store y pruebas de filtros/paginación/CTA.
- `features/availability/`: fecha y preferencia de personas recibidas desde el catálogo; validación y prueba del rango de personas.
- `core/strings.ts`, `strings.en.ts`, `strings.ja.ts`: textos del rediseño.
- `src/styles.scss`: fuentes locales y ajustes de navegación limitados a Reservas.
- `libs/ui-kit/src/lib/site-nav/` y `site-footer/`: variantes compactas opcionales. Se preservó el SCSS de navegación que ya tenía cambios ajenos.
- `public/assets/img/reservas/`: fotografía del hero, cuatro fotos ilustrativas optimizadas y créditos.
