# MapIt – Agent Context

## Stack & required tools

- Angular 22 (TS 6) + Spring Boot 4.1 (Java 25) + PostgreSQL 17.
- Node 24 (`.nvmrc`), pnpm 11.9.0 (`packageManager` in `package.json`), JDK Temurin 25, Docker.
- Multi-tenant engine: tenant claim from JWT (no header), RLS, `tenant_id NOT NULL` + index `(tenant_id, id)`.

## Essential commands

```
pnpm setup          # .env, Docker, DB migration
pnpm dev            # infra + backend + both Angular apps
pnpm dev:front      # only Angular (console :4200, public-web :4300)
pnpm dev:back       # only infra + Spring Boot
pnpm check          # fmt, lint, typecheck, tests, build, api:check (via tools/scripts/check.mjs)
pnpm fmt            # prettier --write . + spotlessApply
pnpm fmt:check      # prettier --check .
pnpm doctor         # environment diagnostics
pnpm stop           # stop containers
pnpm api:gen        # regenerate TS & Java client from OpenAPI
pnpm api:check      # fail if contract and generated client diverged
pnpm api:mock       # Prism mock server :4010
pnpm be:test        # backend unit + ArchUnit (gradle test)
pnpm be:it          # backend integration (Testcontainers)
pnpm be:run         # bootRun
pnpm fe:test        # ng test console + public-web + libs (--no-watch)
pnpm fe:lint        # eslint apps libs packages tools --max-warnings=0
pnpm fe:typecheck   # tsc --noEmit for console and public-web
pnpm fe:build       # ng build console + ng build public-web
pnpm db:migrate     # :bootstrap:flywayMigrate
pnpm db:new "msg"   # new Flyway migration (never edit merged migrations)
pnpm db:seed        # seed test data
pnpm new:spec …     # spec -> plan -> tasks (files created in that order)
pnpm new:flag …     # create coherent feature flag
pnpm e2e            # Playwright end-to-end (needs docker compose up)
pnpm run            # list all scripts
```

## Ports / URLs

- Console (staff): http://localhost:4200 — Public web: http://localhost:4300
- API + Swagger: http://localhost:8080/swagger-ui.html
- Unleash admin: http://localhost:4242 (admin / unleash4all)
- Unleash proxy (frontend only): http://localhost:3063/proxy
- Mailpit: http://localhost:8025 — PostgreSQL host: localhost:5433 (Docker: 5432)

## Monorepo layout

```
apps/   backend, console, public-web, e2e
libs/   ui-kit, api-client, auth, feature-flags, realtime, map-engine
packages/api-contract/   openapi.yaml is source of truth
infra/docker/
specs/
docs/
```

Each top-level folder has its own `AGENTS.md` — read it before touching that zone.

## Hard rules (break the build)

1. `*-domain` modules must not import Spring/JPA/Jackson.
2. `*-application` modules must not import `*-infrastructure`.
3. Backend modules never import each other; only `bootstrap` wires them.
4. Contract-first: `packages/api-contract/openapi.yaml` is source of truth; run `pnpm api:gen` after changes.
5. DB schema only via Flyway migrations; never edit merged migrations.
6. Every business table: `tenant_id NOT NULL`, index `(tenant_id, id)`, RLS enabled.
7. Angular feature modules must not import other features; shared code lives in `libs/`.
8. No `konva` outside `@mapit/map-engine` adapter.
9. Angular is zoneless — no `provideZoneChangeDetection()` (default since Angular 21).
10. Versions live in `apps/backend/gradle/libs.versions.toml` (catalog), never in `build.gradle.kts`.

## CI vs `pnpm check`

CI (`.github/workflows/ci.yml`) splits `pnpm check` across jobs and adds steps `pnpm check` does not:

- frontend: `pnpm api:gen`, `fmt:check`, `fe:lint`, `fe:typecheck`, `fe:test`, `fe:build`
- backend: `./gradlew build` (unit + ArchUnit) in `apps/backend`
- integration: `./gradlew integrationTest` (Testcontainers, incl. tenant-isolation CU-02)
- contract: `pnpm api:lint`, `pnpm api:gen`, `pnpm api:check`
- e2e: `api:gen`, `e2e:install`, docker compose up (`compose.yml` + `compose.full.yml`), `pnpm e2e`, `pnpm logging:smoke`
- SonarQube is `workflow_dispatch` only (manual, one machine).

## Testing

- Backend single test: `node tools/scripts/gradle.mjs :modulo:test --tests "ClaseTest"`.
- Frontend single test: `pnpm exec ng test console --no-watch --include "**/archivo.spec.ts"` (also public-web / libs).
- Integration tests need Testcontainers (Docker); run via `pnpm be:it`.

## Commit conventions

- Conventional Commits (Spanish) required. Scopes limited to:
  `backend, platform, identity, spaces, operations, reservations, payments,
frontend, console, public-web, ui-kit, api-client, auth, feature-flags,
realtime, map-engine, contract, infra, e2e, db, ci, docs, specs, deps, tooling`
- Header ≤ 100 chars; no other scopes allowed.
- Husky hooks: `commit-msg` validates format, `pre-commit` runs lint-staged (prettier + eslint). Bad commits rejected locally.

## Branch / PR workflow

- `main` protected; PRs require 1 approval.
- Branch: `feat/<github-handle>/<ticket-id>-<ticket-slug>` (authenticated handle, lowercase kebab, every word of the ticket name after the ID).
- PR title = exact ticket name; description 1–2 sentences, link Jira ticket, reference base branch.
- All applicable tests + required CI checks must pass before review. Attach a screenshot of the PR's Checks view with every required check green (mandatory).

## Spec-driven flow

```
git switch -c feat/<handle>/CU-12-crear-reserva
pnpm new:spec CU-12-crear-reserva   # creates specs/CU-12-crear-reserva/{spec,plan,tasks}.md
```

Files must be created in order: `spec.md` → `plan.md` → `tasks.md`.

## Known pitfalls

- Jackson 3 imports: `tools.jackson.*` (not `com.fasterxml.jackson.*`).
- Spring Boot 4 needs `spring-boot-flyway` + `flyway-core`; otherwise migrations run silently (app starts, no migration).
- `.env` is tracked with `skip-worktree`; changes may not show in `git status`.
- Do not edit `**/generated/` — regenerated from the OpenAPI contract.
- Missing `tenant_id` → 0 rows (RLS enforced).
- `CorsConfigurationSource` needs `@Qualifier("corsConfigurationSource")`.
- Use `RestClient`, not `RestTemplate`; tests use `RestTestClient`.
- JSpecify null-safety via `@NullMarked` in each package.
- PowerShell `git show` may corrupt UTF-8; set output encoding.
- PostgreSQL runs on host 5433, not 5432.

## Multi-tenant

- Tenant claim extracted from JWT (no header).
- Queries filter `tenant_id` explicitly; older JPA entities use `@TenantId`.
- PostgreSQL RLS enforces tenant isolation at DB level.

## Frontend guidelines

- Use `@if` / `@for`, not `*ngIf` / `*ngFor`.
- Use `[class.x]` / `[style.x]`, not `NgClass` / `NgStyle`.
- Inject services via `inject()`, not constructor parameters.
- Component members used only in template: `protected`; inputs/outputs/queries: `readonly`.
- No `utils.ts`, `helpers.ts`, `common.ts`.
- Styles from `libs/` via `@use 'ui-kit/styles/tokens'`.

## Strings & constants

- No hard-coded visible text; all UI strings come from the catalog (`STRINGS` in each app or lib).

## Feature flags

```html
@if (flags.isEnabled('payments.qr')()) { … }
```

- Keys are typed; create via `pnpm new:flag`.
