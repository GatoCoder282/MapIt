# MapIt – AGENTS

A concise guide for OpenCode agents to work efficiently in this monorepo.

## Routing Table

| Task type             | Read                                                    | Agent               | Skill              |
| --------------------- | ------------------------------------------------------- | ------------------- | ------------------ |
| Full use‑case         | `specs/AGENTS.md` (CU‑XX… folders)                      | –                   | `new-usecase`      |
| API contract change   | `packages/api-contract/AGENTS.md`                       | `api-contract`      | –                  |
| Backend domain logic  | `apps/backend/AGENTS.md`                                | `backend-hexagonal` | –                  |
| Angular UI feature    | `apps/console/AGENTS.md` or `apps/public-web/AGENTS.md` | `angular-feature`   | –                  |
| DB schema change      | `apps/backend/AGENTS.md` + `docs/db/mapit.dbml`         | `db-migration`      | `new-migration`    |
| Feature‑flag toggle   | `infra/AGENTS.md`                                       | –                   | `new-feature-flag` |
| E2E tests             | `apps/e2e/AGENTS.md`                                    | –                   | –                  |
| Architecture decision | `docs/AGENTS.md`                                        | –                   | –                  |

## Hard Rules (must not be violated)

- `*-domain` modules **never** import Spring, JPA or Jackson.
- `*-application` modules **never** import `*-infrastructure` – they communicate only through ports.
- The OpenAPI contract (`packages/api-contract/openapi.yaml`) is the single source of truth; generate client TS and Java interfaces from it.
- Database schema changes **only** via Flyway migrations; never edit entities directly.
- Every business table includes `tenant_id`, an index on `(tenant_id, id)`, and PostgreSQL RLS.
- Angular features are isolated; shared code lives in `libs/`.
- No `konva` outside its adapter.
- **Zoneless** Angular – do not use `provideZoneChangeDetection()` or Zone.js.
- Backend modules are independent; only the bootstrap module knows about all of them.
- Versions are declared **only** in `apps/backend/gradle/libs.versions.toml`.

## Essential Commands

```bash
pnpm setup          # create .env, start Docker, run Flyway
pnpm dev            # start infra + backend + both Angular apps
pnpm dev:front      # start console (4200) & public‑web (4300)
pnpm dev:back       # start infra + Spring Boot
pnpm check          # format, lint, type‑check, test, build, api:check, ArchUnit
pnpm fmt            # prettier + spotless autofix (run before pnpm check)
pnpm doctor         # full environment diagnostics
pnpm stop           # stop all containers
pnpm api:gen        # regenerate OpenAPI client & Java interfaces
pnpm be:test        # backend unit + ArchUnit tests
pnpm be:it          # backend integration (Testcontainers)
pnpm fe:test        # frontend Vitest tests
pnpm db:new "msg"   # create a Flyway migration
pnpm new:flag …     # add a new feature flag (backend, frontend, Unleash)
pnpm new:spec       # scaffold a new spec (CU/HU)
pnpm db:seed        # load seed data
pnpm api:mock       # run Prism mock server on :4010
pnpm e2e            # Playwright end‑to‑end suite
```

Run a single test:

- Backend: `node tools/scripts/gradle.mjs :modulo:test --tests "ClaseTest"`
- Frontend: `pnpm exec ng test console --include "**/*.spec.ts"`

## Ports & URLs

| Service                 | URL                                            |
| ----------------------- | ---------------------------------------------- |
| Console (staff)         | http://localhost:4200                          |
| Public web              | http://localhost:4300                          |
| API + Swagger           | http://localhost:8080/swagger-ui.html          |
| Unleash (feature flags) | http://localhost:4242 (admin / unleash4all)    |
| Unleash proxy           | http://localhost:3063/proxy                    |
| Maildev                 | http://localhost:8025                          |
| PostgreSQL              | host `localhost:5433` (Docker internal `5432`) |

## Commit Conventions

- **Conventional Commits** (Spanish messages). Allowed scopes (in `commitlint.config.js`):
  `backend, platform, identity, spaces, operations, reservations, payments, frontend, console, public-web, ui-kit, api-client, auth, feature-flags, realtime, map-engine, contract, infra, e2e, db, ci, docs, specs, deps, tooling`
- Header ≤ 100 chars, max 1 line.
- Pre‑commit runs `lint‑staged` (prettier + ESLint fixes). Do **not** use `--no‑verify`.

## Common Pitfalls (quick checklist)

- **Jackson 3** imports are `tools.jackson.*` – never `com.fasterxml.jackson.*`.
- Flyway needs both `flyway-core` **and** `spring-boot-flyway`; otherwise migrations run silently.
- Angular requires **TypeScript 6** – do not downgrade.
- Angular file naming: `home.ts` (no `.component.ts`).
- PostgreSQL runs on **5433** on host; internal containers use **5432**.
- Missing `tenant_id` in the JWT session leads to empty query results (RLS).
- `CorsConfigurationSource` beans need `@Qualifier("corsConfigurationSource")`.
- Use `RestClient` instead of `RestTemplate`; `RestTestClient` replaces `MockMvc`.
- All packages have `package-info.java` with `@NullMarked` for JSpecify null‑safety.
- `.env` is tracked – edit carefully; it may have `skip‑worktree` flag.
- Never edit files under `**/generated/` – they are regenerated from the contract.
- PowerShell `git show` truncates UTF‑8; set `[Console]::OutputEncoding=[Text.Encoding]::UTF8` before extracting files.

## Multi‑tenant Basics

- Tenant ID is taken from the JWT claim `tenant` (not a header).
- Queries filter by `tenant_id` **or** PostgreSQL RLS enforces it.
- Without a tenant in the session, queries return **0 rows** by design.

## Frontend Style (Angular 22)

- Use `@if`, `@for` directives (no `*ngIf`/`*ngFor`).
- Bind classes/styles with `[class.x]`, `[style.x]` (no `NgClass`/`NgStyle`).
- Inject services via `inject()` (no constructor params).
- Component members used only in templates are `protected`; `@Input/@Output/@ViewChild` are `readonly`.
- **No** `utils.ts`, `helpers.ts`, `common.ts` – keep logic in proper services.
- Shared styles via `@use 'ui-kit/styles/tokens'` (configured in `angular.json`).

## UI Strings Locations

| Area            | File                                      |
| --------------- | ----------------------------------------- |
| Console (staff) | `apps/console/src/app/core/strings.ts`    |
| Public web      | `apps/public-web/src/app/core/strings.ts` |
| Auth lib        | `libs/auth/src/lib/auth-strings.ts`       |
| UI‑kit lib      | `libs/ui-kit/src/lib/site-strings.ts`     |

Never hard‑code user‑visible text; a typo will break compilation.

## Feature‑flag Usage

```html
@if (flags.isEnabled('payments.qr')()) { … }
<p *featureFlag="'payments.qr'">…</p>
```

Flag keys are **typed** – a misspelling prevents compilation. Create new flags with `pnpm new:flag`.

## Monorepo Layout

```
apps/
  backend/      # Spring Boot 4.1 (hexagonal modules)
  console/      # Angular staff UI (editor, dashboard)
  public-web/   # Angular public UI (availability, booking, QR payment)
  e2e/          # Playwright end‑to‑end tests
libs/            # Shared Angular libraries (ui‑kit, api‑client, auth, …)
packages/        # OpenAPI contract and shared config
infra/docker/    # Docker‑Compose for dev / deployment
specs/           # Use‑case specifications (spec → plan → tasks)
docs/            # ADRs, DB model (`mapit.dbml`), roadmap, diagrams
```

## Completion Checklist

- `pnpm check` passes with a green exit code.
- If a DB schema change was made, the corresponding diagram in `docs/db/mapit.dbml` is updated in the same commit.
- For completed use‑cases: all criteria in the spec’s `spec.md` are marked and execution notes are in `tasks.md`.

## Documentation Quick‑Links

- Use‑cases & road‑map: `docs/roadmap/use_cases.md`
- Architecture decisions: `docs/architecture/adr/`
- Data model: `docs/db/mapit.dbml`
- Contributing guide: `CONTRIBUTING.md`
- Troubleshooting: `TROUBLESHOOTING.md`

---

_This file is intentionally concise; agents should rely on it to avoid common mistakes and to locate the authoritative sources for deeper information._
