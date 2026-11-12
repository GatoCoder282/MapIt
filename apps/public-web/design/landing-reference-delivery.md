# Entrega de la landing MapIt

## Corrección: pestaña Negocios y puerto habitual

- Último ajuste de industrias: texto a la izquierda y cuatro tarjetas fotográficas con títulos/iconos blancos sobre degradado oscuro; sin descripciones inferiores. En móvil, cuadrícula 2×2. Capturas verificadas en `test-results/negocios-industries/industries-4300-{360,390,1151,1440}.png`; se conservan las fotos locales (eventos y hotel no son las de la referencia).
- La implementación pedida está ahora directamente en **`http://localhost:4300/negocios`**, no solo en la landing de `/`. Se reinició exclusivamente el servidor public-web de 4300 con polling y se cerró la vista previa propia de 4317.
- Archivos adicionales: `features/negocios/negocios.ts`, `negocios.html`, `negocios.scss`, nuevo `negocios.spec.ts`, textos en los tres catálogos y nuevo `apps/e2e/tests/public-web/negocios.spec.ts`.
- Composición compacta según la imagen: hero, segunda fila de presentación con teléfono, industrias con fotografía/caption, dashboard de línea, sedes, QR, pasos y CTA. Se conserva el navbar compartido de reservas; sin nuevas rutas comerciales ni datos privados.
- Se corrigieron hashes relativos que salían de Negocios por el `<base href="/">`: los enlaces propios usan `/negocios#como-funciona` y `/negocios#contacto`.
- Suite frontend: **578 pruebas** correctas (367 console, 130 public-web, 81 libs); dos proyectos Playwright (desktop/mobile) correctos con capturas en 360, 390, 768, 992, 1280 y 1440 px. ESLint/Prettier focalizados correctos. Evidencia en `test-results/negocios-reference/`.
- Build final correcto: SCSS de Negocios consolidado a **11.94 kB**, sin aumentar el límite estricto de 12 kB. Se repitió la prueba focalizada y el formato después del ajuste. Quedan advertencias de presupuesto de aviso/CommonJS, no errores de compilación.
- Limitación fotográfica: se reutilizó una foto real de restaurante, no una fotografía inexistente de una empleada. El resultado aproxima la referencia, no se afirma igualdad píxel a píxel.

Lo siguiente documenta la primera entrega y su evidencia histórica; la URL de vista previa de 4317 ya no aplica.

## Cambios y archivos

La ruta `/` monta `Landing`; `/negocios` conserva el contacto. Se implementaron hero con portátil y teléfono HTML/CSS, cuatro industrias, dashboard, sedes, QR, pasos y CTA. Se reutilizan navbar/footer de reservas, componentes standalone, fuentes/tokens y fotografías locales. No hay dependencias nuevas, cambios backend ni datos privados en las demos.

Rutas relativas a `apps/public-web/src/app/`:

- `app.routes.ts`, `app.routes.spec.ts`.
- `core/strings.ts`, `core/strings.en.ts`, `core/strings.ja.ts`.
- `features/landing/landing.ts`, `landing.html`, `landing.spec.ts` (nuevo).
- Dentro de `features/landing/ui/`: `hero/hero.html`, `hero/hero.scss`; `business-types/business-types.html`, `business-types/business-types.scss`; `dashboard/dashboard.ts`, `dashboard/dashboard.html`, `dashboard/dashboard.scss`; `editor/editor.ts`, `editor/editor.html`, `editor/editor.scss`; `booking/booking.html`, `booking/booking.scss`; `cta-final/cta-final.html`, `cta-final/cta-final.scss`; `steps/steps.ts`, `steps/steps.html`, `steps/steps.scss` (nuevos).

Otros archivos:

- `apps/e2e/tests/public-web/smoke.spec.ts`.
- `libs/ui-kit/src/lib/site-strings.ts`, `site-strings.en.ts`, `site-strings.ja.ts` (solo año dinámico).
- Documentos nuevos `apps/public-web/design/landing-reference-{design,plan,delivery}.md`.

El repositorio ya tenía cambios sin confirmar: no se revirtieron ni se hicieron commits. El diff contra HEAD también contiene trabajo previo ajeno a esta entrega.

## Decisiones

- Se conserva la navbar de reservas, no la navegación distinta de la imagen. Sin enlaces inventados a precios/recursos ni testimonios o promesas comerciales no verificadas.
- Capacidades verificadas integradas en operación; mockups sintéticos estáticos, identificados como ilustrativos, sin controles falsamente funcionales ni consultas de staff.
- CTA real a `/negocios#contacto` y ancla de los cuatro pasos. Español, inglés y japonés; copyright con año actual.

## Herramientas usadas

- Skills cargadas en la sesión principal: brainstorming, writing-plans, ponytail, verification-planning, subagent-driven-development, test-driven-development, systematic-debugging, a11y, ponytail-review, impeccable y verification-before-completion. Los especialistas no tenían herramienta de invocación de skills; no se les atribuye su ejecución.
- Angular CLI, Vitest, ESLint, Prettier, Playwright 1.62.1 con Chromium local y detector Impeccable. Sin MCP de navegador ni generación de imágenes.
- El detector señaló imágenes sin `src`: falsos positivos sobre `ngSrc`, contrastados con imágenes cargadas y `naturalWidth > 0` en navegador. No se añadieron atributos redundantes para silenciarlo.
- Revisión Ponytail: sin dependencias ni capas especulativas; se conserva una regresión de navegador reutilizable.

## Verificación

- `pnpm fe:test`: **577 pruebas**, 79 archivos: console 367/41, public-web 129/22, libs 81/16. La primera ejecución agotó 120 segundos; la repetición con mayor presupuesto terminó correctamente.
- `pnpm exec ng build public-web`: correcto tras la última corrección CSS. Advertencias de bundle inicial superior al umbral de aviso de 400 kB, estilos superiores al aviso de 4 kB y CommonJS. Sin superar límites de error ni relajar presupuestos.
- ESLint focalizado sin warnings, Prettier y `git diff --check` correctos para el alcance.
- Smoke Playwright correcto: anónimo, navbar/footer, año, CTA/ancla, menú por teclado, imágenes, consola, overflow y capturas en **360, 390, 768, 1280 y 1440 px**, con reduced-motion. También navega realmente a `/negocios#contacto`.
- Capturas finales: `test-results/landing-reference/public-web/landing-{360,390,768,1280,1440}.png`. El diseñador revisó capturas y corrigió composición, legibilidad, iconos y mesas circulares. Más evidencia y logs en `test-results/landing-reference/` (ignorado por Git).
- Las instancias preexistentes 4300 y 4301 servían bundles antiguos; se dejaron intactas. Vista previa y validación final: `http://localhost:4317/`.

## Límites

- No se afirma pixel-perfect: fotos, proporciones y mockups son aproximaciones; no hay original local para diff automático. Navbar conservada por petición expresa.
- QR, métricas, plano, teléfono y sedes son demos, no integraciones nuevas. La landing no necesita backend nuevo; pagos reales siguen dependiendo del flujo existente y sus flags.
- No se ejecutaron backend/Testcontainers ni E2E completos de negocio. Sin auditoría automatizada completa de contraste/lector de pantalla ni verificación cross-browser.
- Las capturas `stale-server` no validan esta implementación.
