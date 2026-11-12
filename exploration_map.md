# Landing Redesign — Integration Map

## Scope: apps/public-web + libs/ui-kit shared nav/footer

### Already Reused from Reservas (landing.html already references them)

| Component      | Selector                 | Source File                                      | Props/Usage                                                                                                                                                                              |
| -------------- | ------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SiteNav**    | `<mapit-ui-site-nav>`    | `libs/ui-kit/src/lib/site-nav/site-nav.ts`       | Used as `<mapit-ui-site-nav [compact]="true" />` in both landing and reservas. Links: `/#producto`, `/#como-funciona`, `/#negocios`, `/reservas`. Mobile: same + login/join if provided. |
| **SiteFooter** | `<mapit-ui-site-footer>` | `libs/ui-kit/src/lib/site-footer/site-footer.ts` | Used as `<mapit-ui-site-footer [compact]="true" />` in both landing and reservas.                                                                                                        |

### Existing Landing Sections (all declared in `landing.ts` & `landing.html`)

| Section           | Selector                      | Source File                                                                    | Key Assets                                                                                                                                                                                                                                                                                   | Strings (ES)                                                                                                 |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Hero**          | `<mp-landing-hero>`           | `apps/public-web/src/app/features/landing/ui/hero/hero.ts`                     | `mockup_app.png` 2100×630 — app mockup with map. Currently: badge="Gestión espacial en tiempo real", titleA="Mapea tu negocio,", titleB="opéralo en tiempo real.", primaryCta="Unite a MapIt", secondaryCta="Ver cómo funciona", features=["En tiempo real","Multi-tenant","Datos aislados"] |                                                                                                              |
| **Problem**       | `<mp-landing-problem>`        | `apps/public-web/src/app/features/landing/ui/problem/problem.ts`               | — 4 cards: WhatsApp, Hojas de cálculo, Pizarras, Mapit (comparative)                                                                                                                                                                                                                         | badge="El problema", titleA="Tu negocio cambia.", titleB="Tu información también debería hacerlo.", cards[4] |
| **Product**       | `<mp-landing-product>`        | `apps/public-web/src/app/features/landing/ui/product/product.ts`               | `product_map.png` 1024×582 — interactive map mockup. badge="El corazón de MapIt", titleA="El espacio se convierte", titleB="en información."                                                                                                                                                 | tagline="No es un plano. Es una herramienta de operación.", cta="Ver cómo funciona"                          |
| **BusinessTypes** | `<mp-landing-business-types>` | `apps/public-web/src/app/features/landing/ui/business-types/business-types.ts` | `Tenants.jpg` 3552×636 — tenants visual. badge="Un solo sistema, distintos negocios", title="Un motor, distintos negocios."                                                                                                                                                                  | subtitle: "MapIt se adapta a las necesidades de cada tipo de negocio..."                                     |
| **Editor**        | `<mp-landing-editor>`         | `apps/public-web/src/app/features/landing/ui/editor/editor.ts`                 | `Herramientas.png` 931×485 — editor visual. aria="Editor visual de MapIt", titleA="Diseña el espacio como", titleB="realmente existe."                                                                                                                                                       | subtitle: "Arrastra, mueve, rota y redimensiona elementos de forma simple y visual."                         |
| **Booking**       | `<mp-landing-booking>`        | `apps/public-web/src/app/features/landing/ui/booking/booking.ts`               | `Reserva_sin_llamar.png` 1774×887 — reservation visual. aria: "Reservas públicas: Tu cliente reserva sin llamar"                                                                                                                                                                             | bookingItems: ["Disponibilidad en tiempo real","Pago de anticipo vía QR","Confirmación de reserva"]          |
| **Dashboard**     | `<mp-landing-dashboard>`      | `apps/public-web/src/app/features/landing/ui/dashboard/dashboard.ts`           | `dashboards.png` 1536×1024 — dashboard real visual. badge="Dashboard", title="Ve tu negocio de un vistazo."                                                                                                                                                                                  | subtitle: "Toma decisiones más rápidas con información clara y actualizada."                                 |
| **CtaFinal**      | `<mp-landing-cta-final>`      | `apps/public-web/src/app/features/landing/ui/cta-final/cta-final.ts`           | — background #2563EB, text #FFF. title="Convierte tu espacio en una operación inteligente.", description: "MapIt conecta tu espacio físico, reservas y operación en tiempo real.", cta="Unite a MapIt"                                                                                       | Links to `/negocios#contacto` (same as hero primary CTA)                                                     |

### Design Tokens (shared, from `libs/ui-kit/styles/_tokens.scss`)

| Token                      | Value                            | Usage                                  |
| -------------------------- | -------------------------------- | -------------------------------------- |
| `--mapit-color-primary`    | `#2563eb`                        | Brand blue — CTAs, nav active, accents |
| `--mapit-color-on-primary` | `#ffffff`                        | Text on primary                        |
| `--mapit-color-accent`     | `#2563eb`                        | Button fill, hover                     |
| `--mapit-color-surface`    | `#ffffff`                        | Section backgrounds                    |
| `--mapit-color-text`       | `#151c27`                        | Body text                              |
| `--mapit-color-text-muted` | `#6b7280`                        | Muted text                             |
| `--mapit-radius-lg`        | `0.75rem` (12px)                 | Buttons, cards                         |
| `--mapit-radius-xl`        | `1.5rem` (24px)                  | CtaFinal container                     |
| `--mapit-font-display`     | `Manrope Variable`               | Titles/headings                        |
| `--mapit-font-sans`        | `Inter Variable`                 | Body text                              |
| `--mapit-shadow`           | `0 4px 12px rgb(0 0 0 / 0.05)`   | Elevation                              |
| `--mapit-duration-fast`    | `150ms`                          | Button transitions                     |
| `--mapit-ease-out`         | `cubic-bezier(0.22, 1, 0.36, 1)` | Transition timing                      |

> **Note:** The `reservas` component overrides primary colors to `#0062ef` in its own `reservas.scss`. The landing uses the default `#2563eb`.

### Image Assets (public/assets/img/)

| Asset                        | Dimensions | Used In                                        |
| ---------------------------- | ---------- | ---------------------------------------------- |
| `mockup_app.png`             | 2100×630   | Landing hero                                   |
| `Reserva_sin_llamar.png`     | 1774×887   | Landing booking section                        |
| `dashboards.png`             | 1536×1024  | Landing dashboard                              |
| `Herramientas.png`           | 931×485    | Landing editor                                 |
| `Tenants.jpg`                | 3552×636   | Landing business-types                         |
| `product_map.png`            | 1024×582   | Landing product                                |
| `logo_mapit.png`             | 132×60     | Nav logo, footer logo                          |
| `imagen_inicio_reservas.png` | —          | (referenced but not currently in landing html) |
| `reservas/restaurant.webp`   | —          | Reservas popular grid (not in landing)         |
| `reservas/nightclub.webp`    | —          | —                                              |
| `reservas/hotel.webp`        | —          | —                                              |
| `reservas/events.webp`       | —          | —                                              |
| `reservas/hero.jpg`          | —          | Reservas hero (not in landing)                 |

### Navigation Routes (real CTA routes)

| CTA                                               | Destination          | Section                      |
| ------------------------------------------------- | -------------------- | ---------------------------- |
| "Unite a MapIt" (hero primary, cta-final)         | `/negocios#contacto` | Business/contact section     |
| "Ver cómo funciona" (hero secondary, product cta) | `/#como-funciona`    | Problem/How it works section |
| (No route)                                        | —                    | Problem cards stay in-page   |

### Honest Capabilities / Four Steps

- **Current landing "Problem" section** already provides an honest comparison of 4 approaches (WhatsApp, sheets, pizarras vs Mapit). This can serve as the "honest capabilities" section.
- **Four steps** — the reservas page has 3 steps (`mp-reservas-steps`) with items Busca/Selecciona/Confirma. The landing currently has **4 problem cards** (not steps). To get "four steps," the existing `LandingProblem` cards could be re-purposed, or a new section modeled after `ReservasSteps` with 4 items could be added.
- The strings under `landing.steps` already exist (title, subtitle, items[4]: Configura tu negocio, Diseña el plano, Define reglas y disponibilidad, Opera en tiempo real) but are **not used in any landing component yet**. They could be wired into a new `<mp-landing-steps>` component or reused from the existing `LandingProblem` template.

### QR Booking

- The `LandingBooking` section exists with `Reserva_sin_llamar.png` but does **not** explicitly highlight QR.
- Strings mention: `bookingItems` includes "Pago de anticipo vía QR" and `bookingNote`: "Imagen y QR ilustrativos; el código no procesa pagos."
- To emphasize QR, a QR code or QR badge could be added to the booking visual, but no new routes/features are needed — the existing API mock and strings are sufficient.

### Ambiguities — Requiring User Choice

| #   | Ambiguity                                                                                                          | Options                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Hero content** — user wants "restaurant laptop/phone hero". Current hero has app mockup.                         | A) Replace mockup with restaurant/phone scene (new image needed).<br>B) Keep mockup and add restaurant context overlay.<br>C) Add restaurant photos alongside mockup (use existing `reservas/` industry webp or new).                                                      |
| 2   | **Four industry photos** — design references 4 industries (restaurantes, discotecas, salones de eventos, hoteles). | A) Use the 4 `reservas/` industry images (`restaurant.webp`, `nightclub.webp`, `events.webp`, `hotel.webp`) in a grid.<br>B) Create 4 new industry photos in the mapit style.<br>C) Reuse the existing `business-types` Tenants.jpg with 4 visual quadrants.               |
| 3   | **Four steps** — user wants 4 steps; landing has problem cards (4) or reserva steps (3).                           | A) Re-purpose `LandingProblem` cards as steps (title/description format).<br>B) Create new `LandingSteps` component wired to `landing.steps` strings (already defined but not used).<br>C) Keep problem section as "honest capabilities" and add a separate steps section. |
| 4   | **Establishments table** — not present in landing.                                                                 | A) Add a table component showing sample establishments (data from API, marketing-focused).<br>B) Reuse `business-types` visual with table overlay.<br>C) Omit table; rely on the business-types visual + CTA to establishments.                                            |
| 5   | **QR booking emphasis** — strings mention QR but UI doesn't highlight it.                                          | A) Add QR badge/icon to booking section visual.<br>B) Keep as-is; the reservation image implies the flow.<br>C) Add short text under the image: "Pago de anticipo vía QR".                                                                                                 |
| 6   | **Honest capabilities section** — could be the existing problem section or a new one.                              | A) Keep `LandingProblem` as-is (comparative cards).<br>B) Rename/re-purpose as "Capabilidades honestas" with same content.<br>C) Add a new section after dashboard, before cta-final.                                                                                      |
| 7   | **Final CTA route** — currently goes to `/negocios#contacto`. Same as hero primary.                                | A) Keep as-is (consistent single CTA).<br>B) Change to `/reservas` or `/disponibilidad`.<br>C) Add a secondary CTA with different route.                                                                                                                                   |
| 8   | **Tests / browser availability** — no landing spec files found.                                                    | A) Landing has no unit tests yet; add if required.<br>B) Use existing `pnpm fe:test` which runs Vitest on console, public-web and libs.<br>C) E2E available via `pnpm e2e` with Playwright (requires stack).                                                               |

### Preservation Notice (dirty worktree)

All preexisting modifications in the worktree are preserved. No files were written or modified during this exploration. The integration map identifies **existing** components, assets, strings, and tokens without altering any source.

### Validation — Owner of Discovered Facts

- **Explorer** (this subagent): identified all paths, component selectors, file locations, string keys, image dimensions, token values, and navigation routes.
- **Parent session**: reconciles the integration map with the redesign requirements and makes final choices on the ambiguities above.

---

_End of map. No files modified._
