# MapIt — Agent Context

Angular 22 (TypeScript 6, zoneless) + Spring Boot 4.1.1 (Java 25) + PostgreSQL 17. Multi-tenant engine.
Node 24 (`.nvmrc`), pnpm 11.9.0, JDK Temurin 25, Docker, Gradle wrapper 9.2.0.
Spanish is the working language for commits and most code comments.

## Read the zone AGENTS.md first

Each zone has its own `AGENTS.md` with hard rules — read it before touching that zone:

| Task                  | Read                                            |
| --------------------- | ----------------------------------------------- |
| Backend domain logic  | `apps/backend/AGENTS.md`                        |
| Console feature       | `apps/console/AGENTS.md`                        |
| Public-web feature    | `apps/public-web/AGENTS.md`                     |
| Shared lib / ui-kit   | `libs/AGENTS.md`                                |
| API contract work     | `packages/api-contract/AGENTS.md`               |
| DB schema change      | `apps/backend/AGENTS.md` + `docs/db/mapit.dbml` |
| Full use-case (SDD)   | `specs/AGENTS.md`                               |
| Feature flag          | `infra/AGENTS.md`                               |
| E2E tests             | `apps/e2e/AGENTS.md`                            |
| Architecture decision | `docs/AGENTS.md`                                |

`CLAUDE.md` only points here — never duplicate instructions in it.

`ponytail:` this file is a **router, not a copy** — each fact lives in the zone file that owns it.
Ceiling: an agent reading only this file can miss a zone-only rule; upgrade path: follow the table
above. Do not paste zone content back in — that duplication is what let this file go stale
(`db:seed`/`db:erd` were listed as working commands while the scripts were stubs).

Purpose-built subagents live in `.claude/agents/` (`backend-hexagonal`, `db-migration`,
`angular-feature`, `api-contract`) and skills in `.claude/skills/` (`new-migration`,
`new-feature-flag`, `new-usecase`). The `animate*`/`design*` skills vendored under `agent/`,
`.agents/` and `.claude/skills/` are not MapIt-domain — ignore them.

## Hard rules (breaking the build)

1. `*-domain` modules must not import Spring/JPA/Jackson — it does not compile, by design.
2. `*-application` must not import `*-infrastructure`, and `*-domain` must import neither; define a port in `domain` instead.
3. Backend modules never import each other; only `bootstrap` wires them.
4. No `System.out` / `System.err` / `printStackTrace`, and no `System.currentTimeMillis` — inject a `Clock`.
5. Contract-first: `packages/api-contract/openapi.yaml` is the source of truth; run `pnpm api:gen` after every edit. WebSocket/STOMP is **not** in OpenAPI — it lives in `docs/api/`.
6. DB schema changes only via Flyway (`pnpm db:new "…"`); never edit a merged migration. Update `docs/db/mapit.dbml` in the **same commit**.
7. Every business table: `tenant_id NOT NULL REFERENCES tenant(id)`, composite index `(tenant_id, id)`, and RLS via `SELECT enable_tenant_isolation('<table>')` — do not hand-write policies. Every new table needs a tenant-isolation test.
8. Angular features must not import other features, and libs must not import `apps/`. Shared code goes to `libs/` (or a feature's `core/`).
9. No `konva` outside the `@mapit/map-engine` adapter — use `MapEnginePort` (the engine is not decided; ADR-0006).
10. Angular is zoneless: never `provideZoneChangeDetection()`, never import `zone.js`.
11. Backend versions live only in `apps/backend/gradle/libs.versions.toml`, never in a `build.gradle.kts`.
12. Unleash is touched only from its adapter; everything else uses `FeatureFlagPort`. The frontend never talks to Unleash directly — it goes through the proxy on :3063.
13. `public-web` must not import `@mapit/auth` — that lib is staff-only.

**Who enforces what.** A failure here is an architecture violation, not a style nit:

- Backend rules 1–4 and 12 → `apps/backend/bootstrap/src/test/java/com/mapit/architecture/ArchitectureTest.java` (runs inside `pnpm be:test`). Rule 1 also fails at compile time: the `domain` subproject declares no framework dependency.
- Frontend rules 8–10 → `packages/config-eslint/boundaries.js` (import boundaries) and `packages/config-eslint/angular.js` (template/style rules). `no-restricted-imports` does not merge across configs, so **all** import restrictions live in `boundaries.js` by design.
- Rules 5–7 are enforced by `pnpm api:check`, `ddl-auto: validate`, and the PR checklist — not by a tool that runs on your machine.

## Commands

```bash
pnpm setup            # first run: .env (from .env.example, per-machine JWT_SECRET), Docker, Flyway, api-client
pnpm dev              # infra + backend + both Angular apps (dev:front / dev:back for parts)
pnpm infra:up         # Docker stack only (infra:full = full stack for e2e; pnpm stop = down)
pnpm infra:ps|logs|down|reset

pnpm be:run           # Spring Boot only, infra already up
pnpm be:test          # unit + ArchUnit, no Docker   ·   pnpm be:it = Testcontainers integration (needs Docker)
pnpm be:fmt           # Spotless   ·   be:lint = verify only   ·   be:build = build

pnpm check            # pre-push: prettier --check → fe:lint → fe:typecheck → fe:test → fe:build
                      # → api:check → gradle build (backend skipped if no Java). Runs every step, then summarizes.
pnpm fmt              # prettier --write . + spotlessApply (fmt:check = verify only)
pnpm doctor           # environment diagnostics

pnpm api:lint         # validate openapi.yaml · api:gen = regenerate clients · api:check = drift
pnpm api:mock         # Prism mock server :4010 — frontend works without the backend

pnpm db:migrate       # apply Flyway · db:info = pending/applied · db:new "msg"
pnpm fe:test          # ng test (Vitest): console + public-web + libs
pnpm fe:console       # :4200   ·   pnpm fe:public = :4300
pnpm e2e              # Playwright against an already-running system; e2e:install once per machine
pnpm logging:smoke    # logging + privacy check — CI runs it right after e2e

pnpm new:spec CU-12-crear-reserva   # scaffold specs/CU-12-…/{spec,plan,tasks}.md (fill in that order)
pnpm new:flag payments.qr release    # Java enum + TS catalog + Unleash seed (then create it in the Unleash UI)
```

Stubs that only print "not implemented" — do not rely on them: `new:feature`, `new:module`, `db:seed`, `db:erd`.

Single test: `node tools/scripts/gradle.mjs :modules:identity:identity-application:test --tests "MiClaseTest"` (Backend) or `pnpm exec ng test console --include "**/archivo.spec.ts"` (frontend). Test projects: `console`, `public-web`, `libs`.
`gradle.mjs` forwards args verbatim to the wrapper in `apps/backend` and **dies** if Java or the wrapper is missing (no system-Gradle fallback); `pnpm check` instead skips the backend.
Every `pnpm <script>` delegates to `tools/scripts/` — read those instead of guessing behavior.

## Ports / URLs

Console :4200 · public-web :4300 · API+Swagger :8080 · Prism mock :4010 · Unleash admin :4242 (`admin`/`unleash4all`) · Unleash proxy (frontend) :3063 · Mailpit UI :8025 (SMTP 1025) · PostgreSQL **host 5433** (Docker network 5432).

## Multi-tenancy (the one thing you must not get wrong)

- Tenant comes from the JWT `tenant` claim (staff routes) — never a header. The public slug→tenant resolver is **not implemented yet**: `slug` today is only a column on `tenant`/`establishment`/`floor`/`sector`.
- Double isolation: explicit `tenant_id` in every query (older JPA entities also carry `@TenantId`), plus PostgreSQL RLS in the DB. No tenant in session → 0 rows, failing closed on purpose.
- The app connects as `mapit_app` (`LOGIN NOSUPERUSER NOBYPASSRLS`, no DDL); Flyway migrations run as `mapit` (owner, which **bypasses** RLS). The password arrives via the `MAPIT_APP_DB_PASSWORD` env var as a Flyway placeholder, never versioned — **the migration** fails loudly if it is missing (the runtime datasource keeps a `changeme_local` fallback). Connecting as the owner silently disables RLS at runtime.

## Known pitfalls

The ones that cost a debugging round-trip:

- Boot 4 splits autoconfigurations into modules: Flyway needs `spring-boot-flyway` besides `flyway-core`, or the app boots and migrations never run.
- `pnpm db:new` writes the tenant/RLS rules as **comments**: you must type the `SELECT enable_tenant_isolation(...)` line yourself.
- `libs/api-client/src/lib/generated/` and `packages/api-contract/generated/` are gitignored and rebuilt from the contract: run `pnpm api:gen` after a fresh clone and after every `openapi.yaml` edit, or typecheck/build fails. Never edit them by hand. The first run needs network (downloads the generator JAR, or falls back to Docker).
- Integration tests boot `postgres:16-alpine` while dev and prod run `postgres:17-alpine`.
- Jackson 3 imports are `tools.jackson.*` (`com.fasterxml.jackson.*` is Jackson 2 and does not work on Boot 4). Some `spring.jackson.*` properties moved (`WRITE_DATES_AS_TIMESTAMPS` → `DateTimeFeature`) and block startup.

More traps by symptom: `TROUBLESHOOTING.md` (setup, Docker, DB, backend, frontend) and `apps/backend/AGENTS.md` (`RestClient` vs `RestTemplate`, `@NullMarked`, the CORS bean, first compile).

## Frontend conventions

**Enforced by ESLint** — a failure here is a rule, not a preference:

- `@if`/`@for`/`@switch` and `[class.x]`/`[style.x]`; importing `NgClass`/`NgStyle`/`NgIf`/`NgFor` is banned.
- `inject()`, never constructor parameters. Standalone components. `prefer-signals` is a warning, not an error.
- No `zone.js`, no `provideZoneChangeDetection()`.
- No `konva` outside the map-engine adapter. No feature→feature imports. No `libs/`→`apps/` imports.
- `no-console` in apps and libs (except `libs/logging/src/console-adapter.ts`). Selector prefixes are enforced: `mapit-` in console and libs, `mp-` in public-web (libs skip the directive prefix so `*featureFlag` stays unprefixed).
- Templates: a11y is an error — `click-events-have-key-events`, `interactive-supports-focus`.

**Conventions — not lint-enforced, but the codebase follows them:**

- File names carry no type suffix: `home.ts`, not `home.component.ts`.
- Members used only in templates: `protected`; inputs/outputs/queries: `readonly`.
- No `utils.ts`, `helpers.ts`, `common.ts`.
- No hard-coded visible text — all strings come from `STRINGS` in `apps/<app>/src/app/core/strings.ts`.
- Console features are MVVM with signals: `ui/` (binding only) / `model/` (ViewModel store) / `data/` (api-client). `signal`/`computed`/`linkedSignal`, never `BehaviorSubject`. public-web's `landing`/`reservas` features are flatter — do not force MVVM on them.
- Console reads its config at runtime from `/assets/config.json` (not a build-time `environment.ts`): the same Docker image serves dev and deployment. It falls back to defaults if the file is missing.
- Feature flags: `@if (flags.isEnabled('payments.qr')())`; keys are typed in `libs/feature-flags/src/lib/feature-flag.catalog.ts`, so a typo does not compile. `isEnabled()` returns a signal (hence the trailing `()`); use `isEnabledNow()` imperatively. The catalog must stay in sync with the backend `FeatureFlag` enum — `pnpm new:flag` does both.
- Styles: `@use 'ui-kit/styles/tokens' as *` — resolved through `stylePreprocessorOptions.includePaths: ["libs"]`; the file is `libs/ui-kit/styles/_tokens.scss` (not under `src/`). A new app must copy that option.
- `ChangeDetectionStrategy.OnPush` is the schematic default — keep it.

## Commits, branches, PRs

- Conventional Commits, Spanish subject, header ≤ 100 chars. The allowed scopes are the `scope-enum` list in `commitlint.config.js`; the `commit-msg` hook rejects anything else, so read that file rather than guessing.
- `main` is protected; PRs need 1 approval. Branch naming, stacked PRs and the Jira-story convention are in `CONTRIBUTING.md`.
- The PR template (`.github/pull_request_template.md`) is a hard checklist, not decoration — satisfy every box.

## Layout

`apps/{backend,console,public-web,e2e}` · `libs/{ui-kit,api-client,auth,feature-flags,realtime,map-engine,logging}` (shared frontend, imported as `@mapit/*`) · `packages/{api-contract,config-eslint,config-prettier,config-typescript}` · `infra/docker` · `specs/` · `docs/` · `tools/scripts/`.
Backend module layout (`modules/<context>/{<context>-domain,-application,-infrastructure}` + `shared-kernel` + `bootstrap` + `build-logic`) is in `apps/backend/AGENTS.md`.

## Reference

Use-cases `docs/roadmap/use_cases.md` (it wins over `project_definition.md`) · ADRs `docs/architecture/adr/` · DB model `docs/db/mapit.dbml` · patterns `docs/architecture/design-patterns.md` · realtime `docs/api/realtime.md` · `CONTRIBUTING.md`.
