# MapIt Reference Landing Implementation Plan

> **For agentic workers:** use subagent-driven-development; reuse the designer session holding the approved design. Track progress with the checkboxes below.

**Goal:** Implement the approved reference-led landing while retaining the reservas navbar.
**Architecture:** Adapt existing Angular landing sections and shared chrome. Static HTML/CSS product illustrations use synthetic demo data; no backend calls or new dependencies.
**Tech Stack:** Angular 22, existing SCSS/tokens and image assets, Vitest, Playwright Chromium.
**Spec:** `apps/public-web/design/landing-reference-design.md` (approved by user).

## Global Constraints

- Preserve all preexisting worktree edits; no commits, resets or unrelated changes.
- Keep `<mapit-ui-site-nav [compact]="true" />` and shared footer; do not redesign reservas.
- Text lives in STRINGS and all existing language catalogs. No staff auth imports or real internal data.
- No invented commercial metrics, testimonials, pricing links, support or integrations.
- Validate widths 360, 390, 768, 1280 and 1440 px; reuse existing server on port 4300.
- Use local assets; no generated imagery or new dependencies. Keep public build within configured budget.

## Review Focus

- Narrow mobile viewport: no horizontal overflow or unreadable device/table mockups.
- Locale changes: complete catalogs, no untranslated new labels, readable long strings.
- Keyboard/reduced motion: working mobile navigation, visible focus, visible content without animations.
- Synthetic data: visibly demo-only, no fake actions or live API/staff requests.
- CTA/anchors: contact and four-step anchors resolve; no pricing or nonexistent destinations.

## Task 1 — Reference composition (designer owns all UI changes)

**Files:** existing `apps/public-web/src/app/features/landing/**`; existing `core/strings*.ts`; minimum new steps/mockup files only where needed. Design notes remain in this folder. Shared navbar/footer remain unchanged unless a verified functional defect demands a separate correction.

**Interface:** existing standalone landing selectors, `STRINGS`, shared navbar/footer and actual `/negocios#contacto` destination. Output preserves app routes and contains approved section order.

- [x] Read zone instructions, current components/assets and approved design; inspect local photos before assigning them.
- [x] Add a focused `landing.spec.ts` regression using existing test conventions: single h1, shared navbar/footer, industries, steps anchor, contact CTA, demo labels and absence of fake pricing links.
- [x] Run focused test before implementation; record expected failures (first run exposed missing `ActivatedRoute` in test setup; after providing router, the not-yet-implemented selectors failed).
- [x] Adapt hero (warm restaurant, HTML/CSS laptop map + overlapping booking phone), four industry photos, operation dashboard, establishments table, QR block, steps, verified capabilities and final CTA. Preserve navbar/footer and real routes. Add only genuinely reused abstractions.
- [x] Update existing locale catalogs; use non-interactive demo markup and accessible headings/table names.
- [x] Run focused tests, changed-file lint and formatting. Captured and inspected the live Landing at five widths on fresh port 4317; parent owns the final integrated suite/build.
- [x] Report exact modified files, evidence paths, remaining gaps, skills used and API/console/network observations.

## Task 2 — Integration, browser verification and scoped review (orchestrator owns)

**Files:** read implementation; verification artifacts under ignored `test-results/landing-reference/`. A small durable Playwright smoke test may live in `apps/e2e/tests/public-web/landing.spec.ts` if existing coverage does not already establish the invariants.

- [x] Review actual produced source and diff against design; request corrections from the same designer session.
- [x] Run public app production build, frontend tests once after reconciling writers, scoped lint and formatting; record preexisting/unrelated failures separately.
- [x] Exercise five target widths in Chromium: full-page captures, overflow, failed images, console/page errors, h1/demo labels, internal anchors, contact navigation, keyboard/mobile menu and reduced-motion visibility. Reuse active port 4300; no backend needed for isolated landing.
- [x] Designer compares screenshots with supplied reference and corrects significant visual defects. A source screenshot is not a local pixel-diff baseline; do not claim pixel-perfect.
- [x] Run scoped accessibility, spec/code quality and Ponytail review; fix concrete defects without broad refactors.
- [x] Recheck only changed evidence after fixes; summarize exact limits and screenshots, mark this checklist.

## Execution notes

### Corrección solicitada: Negocios en puerto 4300

### Ajuste posterior: franja de industrias según recorte

- La última referencia sustituye solo la composición de industrias: texto a la izquierda y cuatro fotos a la derecha, con iconos/títulos blancos superpuestos sobre degradado oscuro. Elimina las descripciones en tarjetas blancas inferiores; conserva las demás secciones.
- Diseñador mantiene el alcance en markup/estilos/iconos/textos de industrias y su prueba focalizada. Validación final del orchestrator: build público, regresión E2E existente y revisión de capturas reales en 4300, sin repetir toda la suite por este ajuste visual acotado.

- El usuario exige la implementación en `/negocios` sobre el puerto habitual **4300**, conservando el navbar de reservas y priorizando ahora la composición completa de la imagen (incluida la segunda fila de presentación del producto).
- [x] Adaptar directamente `features/negocios/negocios.{ts,html,scss}` y catálogos necesarios; no limitar el cambio a la otra landing ni importar entre features.
- [x] Reiniciar exclusivamente el servidor public-web identificado en 4300 con detección por polling; detener la vista previa propia en 4317. HTTP 200 verificado para `http://localhost:4300/negocios`.
- [x] Añadir regresión de navegación real a Negocios, responsive y diálogo de acceso en `apps/e2e/tests/public-web/negocios.spec.ts`.
- [x] Reconciliar escritores, comprobar fuente/capturas de `/negocios`, ejecutar suite frontend una vez y build público; informar exclusivamente la URL de 4300.
- Validación final de la corrección: 578 pruebas frontend, 2 proyectos E2E, lint/formato y build correctos. SCSS consolidado a 11.94 kB sin aumentar el límite de 12 kB; persisten advertencias, no errores. Prueba focalizada de Negocios repetida tras el último ajuste.
- Diseñador: Negocios y sus textos; fixer: E2E nuevo; orchestrator: procesos, integración y validación final. Mantener intactas reservas y rutas existentes.

- User approved both approach and design, explicitly requested implementation. Continue without further approval gates.
- Ruling: work in the current dirty feature workspace to preserve the user's uncommitted redesign/assets and active dev server; no checkout/worktree migration or commits.
- Ruling: static synthetic staff-product illustrations are allowed by the request; public-web restrictions prohibit real private data access, not marketing mockups.
- Existing Playwright 1.62.1 and Chromium are installed; browser MCP is unavailable. Use local Playwright instead.
- Task 1 source/test/format/lint completed. Focused test passed (`ng test public-web --no-watch --include "**/landing.spec.ts"`); changed-file ESLint passed with no warnings.
- Route integration was corrected by the parent: `/` mounts `Landing`, `/negocios` remains `Negocios`. The existing listeners on 4300/4301 served stale bundles, so they were left untouched; fresh port 4317 served the updated landing.
- Real Landing screenshots and notes are in root `test-results/landing-reference/` (not under the E2E package). On 4317 at 360, 390, 768, 1280, and 1440: one h1, three benefits, four hero nav labels, phone QR, three dashboard indicators, six chart bars, four venue columns, no horizontal overflow, broken images, page errors, or console errors. Desktop, tablet and mobile screenshots were visually inspected.
- Local photo inspection: `restaurant.webp` is a dark restaurant interior; `nightclub.webp` DJ lighting; `events.webp` warm table setting; `hotel.webp` wood resort/pool. QR reference is a printed illustrative QR sign; booking copy states QR deposits apply only when enabled and the image caption says the QR does not process payments.
- Browser regression prepared in existing `apps/e2e/tests/public-web/smoke.spec.ts`; focused discovery/lint passed. Live execution waits for UI writer completion. Parent corrected initial viewport to desktop before nav checks and added footer-year assertion.
- Small explicit-requirement correction: shared `site-strings*.ts` copyright now computes the current year, without changing footer visuals or navigation.
- Active implementation owner: designer session `ses_e4c0ee317ffesh7aAWEo5dMf7F`; parent owns final integration validation. E2E writer completed; no overlapping writers remain.
- Integration finding: `/` originally mounted `Negocios`, not the edited `Landing`. Parent added a route regression (observed expected failure) and changed only the root route; `/negocios` and business routes remain intact.
- Environment finding: existing 4300 and 4301 servers both serve stale root bundles. Kept both untouched; validation uses a fresh dev instance on 4317. Earlier screenshots of Negocios are not evidence for this landing.
- First production public build passed with style/CommonJS warnings. First full frontend suite exceeded the 120-second runner timeout during console tests; no green-suite claim. Rerun with a larger budget after final UI reconciliation.
- Source audit adjudication: section names do not determine meaning. `LandingDashboard` implements operation and `LandingEditor` implements venues in the approved order; adding old realtime/product/problem sections would duplicate content. Static demos and empty alt on decorative photos are intentional, not private-data exposure or missing semantics.
- Final evidence: 577 frontend tests passed (367 console, 129 public-web, 81 libs); final Chromium smoke including actual CTA/anchor navigation passed; production build passed with warnings. Five viewport captures and logs are in `test-results/landing-reference/`; see `landing-reference-delivery.md` for limits. Last CSS-only table geometry correction has focused test and repeated browser/build evidence.
- Impeccable detector ran once: `ngSrc` images reported as missing `src` were false positives verified by browser image-loading assertions. No new dependency or speculative abstraction found in the Ponytail pass.
