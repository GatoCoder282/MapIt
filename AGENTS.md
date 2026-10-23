# MapIt – Agent Context

## Overview

- Multi‑tenant engine (tenant claim from JWT, RLS, `tenant_id NOT NULL` + index `(tenant_id, id)`).
- Stack: Angular 22 (TS 6) + Spring Boot 4.1 (Java 25) + PostgreSQL 17.
- Required tools: Node 24 (`.nvmrc`), pnpm 11.9.0 (`packageManager` in `package.json`), JDK Temurin 25, Docker.

## Task routing

Each top‑level folder has its own `AGENTS.md` with local rules — read it before touching that zone.

| Task                            | Read                                            |
| ------------------------------- | ----------------------------------------------- |
| Full use‑case (spec→plan→tasks) | `specs/AGENTS.md`                               |
| API/contract work               | `packages/api-contract/AGENTS.md`               |
| Backend domain logic            | `apps/backend/AGENTS.md`                        |
| Console feature                 | `apps/console/AGENTS.md`                        |
| Public‑web feature              | `apps/public-web/AGENTS.md`                     |
| DB schema change                | `apps/backend/AGENTS.md` + `docs/db/mapit.dbml` |
| Feature flag                    | `infra/AGENTS.md`                               |
| E2E tests                       | `apps/e2e/AGENTS.md`                            |
| Architecture decision           | `docs/AGENTS.md`                                |

## Hard Rules (breaking the build)

1. `*-domain` modules must not import Spring/JPA/Jackson.
2. `*-application` modules must not import `*-infrastructure`.
3. Backend modules never import each other; only `bootstrap` wires them.
4. Contract‑first: `packages/api-contract/openapi.yaml` is source of truth; run `pnpm api:gen` after changes.
5. DB schema only via Flyway migrations; never edit merged migrations.
6. Every business table: `tenant_id NOT NULL`, index `(tenant_id, id)`, RLS enabled.
7. Angular feature modules must not import other features; shared code lives in `libs/`.
8. No `konva` outside `@mapit/map-engine` adapter.
9. Angular is zoneless – no `provideZoneChangeDetection()`.
10. Versions live in `apps/backend/gradle/libs.versions.toml` (catalog), never in `build.gradle.kts`.

## Essential Commands

```
pnpm setup          # .env, Docker, DB migration
pnpm dev            # infra + backend + both Angular apps
pnpm dev:front      # only Angular (console :4200, public‑web :4300)
pnpm dev:back       # only infra + Spring Boot
pnpm check          # fmt, lint, typecheck, tests, build, api:check, ArchUnit
pnpm fmt            # prettier + spotless (auto‑fix)
pnpm doctor         # environment diagnostics
pnpm stop           # stop containers
pnpm api:gen        # regenerate TS & Java client from OpenAPI
pnpm be:test        # backend unit + ArchUnit
pnpm be:it          # backend integration (Testcontainers)
pnpm fe:test        # frontend Vitest
pnpm db:new "msg"   # new Flyway migration
pnpm new:flag …     # create coherent feature flag
pnpm new:spec …     # start a new CU (spec → plan → tasks)
pnpm db:seed        # seed test data
pnpm api:mock       # Prism mock server :4010
pnpm e2e            # Playwright end‑to‑end
pnpm run            # list all available scripts
```

## Ports / URLs

- Console (staff): http://localhost:4200
- Public web: http://localhost:4300
- API + Swagger: http://localhost:8080/swagger-ui.html
- Unleash admin: http://localhost:4242 (admin / unleash4all)
- Unleash proxy (frontend only): http://localhost:3063/proxy
- Mailpit: http://localhost:8025
- PostgreSQL host: localhost:5433 (Docker: 5432)

## Commit Conventions

- Conventional Commits (Spanish) required; scopes limited to:
  `backend, platform, identity, spaces, operations, reservations, payments,
 frontend, console, public-web, ui-kit, api-client, auth, feature-flags,
 realtime, map-engine, contract, infra, e2e, db, ci, docs, specs, deps, tooling`
- Header ≤ 100 chars; no other scopes allowed.

## Known Pitfalls

- Jackson 3 imports: `tools.jackson.*` (not `com.fasterxml.jackson.*`).
- Spring Boot 4 needs `spring-boot-flyway` + `flyway-core`; otherwise migrations silent.
- Angular requires TypeScript 6; file names have no `.component` suffix.
- PostgreSQL runs on host 5433, not 5432.
- Missing `tenant_id` → 0 rows (RLS enforced).
- `CorsConfigurationSource` needs `@Qualifier("corsConfigurationSource")`.
- Use `RestClient`, not `RestTemplate`; tests use `RestTestClient`.
- JSpecify null‑safety via `@NullMarked` in each package.
- `.env` is tracked with `skip-worktree`; changes may not appear in `git status`.
- Do not edit `**/generated/` – regenerated from contract.
- `springdoc` version may lag Spring Framework 7; rely on OpenAPI yaml.
- PowerShell `git show` may corrupt UTF‑8; set output encoding.
- Husky hooks validate commit msg format (`commit-msg`) and run lint-staged (`pre-commit`); bad commits rejected locally, not in PR.

## Multi‑tenant Details

- Tenant claim extracted from JWT (no header).
- Queries filter `tenant_id` explicitly; older JPA entities use `@TenantId`.
- PostgreSQL RLS enforces tenant isolation at DB level.

## Frontend Guidelines

- Use `@if` / `@for`, not `*ngIf` / `*ngFor`.
- Use `[class.x]` / `[style.x]`, not `NgClass` / `NgStyle`.
- Inject services via `inject()`, not constructor parameters.
- Component members used only in template: `protected`; inputs/outputs/queries: `readonly`.
- No `utils.ts`, `helpers.ts`, `common.ts`.
- Styles imported from `libs/` via `@use 'ui-kit/styles/tokens'`.

## Strings & Constants

- No hard‑coded visible text; all UI strings come from catalog (`STRINGS` in each app or lib).

## Feature Flags

```html
@if (flags.isEnabled('payments.qr')()) { … }
<p *featureFlag="'payments.qr'">…</p>
```

- Keys are typed; creation via `pnpm new:flag`.

## Monorepo Layout

```
apps/
  backend/
  console/
  public-web/
  e2e/
libs/
  ui-kit/
  api-client/
  auth/
  feature-flags/
  realtime/
  map-engine/
packages/
  api-contract/
infra/docker/
specs/
docs/
```

## Spec‑Driven Flow

```bash
git switch -c feat/<github-handle>/CU-12-crear-reserva
pnpm new:spec CU-12-crear-reserva   # creates specs/CU-12-crear-reserva/{spec,plan,tasks}.md
```

- Files must be created in order: `spec.md` → `plan.md` → `tasks.md`.

## Branch / PR Workflow

- `main` protected; PRs require 1 approval.
- Ticket branch naming: `feat/<github-handle>/<ticket-id>-<ticket-slug>`; use the authenticated GitHub handle and lowercase kebab case containing every word in the ticket name after the ID.
- PR title uses the exact ticket name; keep its description to one or two sentences, link the Jira ticket, and reference the base branch.
- Every applicable test and required CI workflow must pass before review. Attach a screenshot of the current PR's Checks view showing every required test check green; this evidence is mandatory.

## Testing

- Backend single test: `node tools/scripts/gradle.mjs :modulo:test --tests "ClaseTest"`.
- Frontend single test: `pnpm exec ng test console --include "**/archivo.spec.ts"`.

## Verification (`pnpm check`)

1. `prettier --check .`
2. `eslint`
3. `tsc --noEmit`
4. `vitest`
5. `ng build`
6. `api:check`
7. `gradle build` (if Java present)

CI runs the same steps split across jobs (`.github/workflows/ci.yml`): frontend, backend (unit+ArchUnit), integration (Testcontainers), contract drift check, E2E (Playwright).

## Quick Reference

- Use‑cases: `docs/roadmap/use_cases.md`
- ADRs: `docs/architecture/adr/`
- DB model: `docs/db/mapit.dbml`
- Design patterns: `docs/architecture/design-patterns.md`
- Contributing: `CONTRIBUTING.md`
- Common pitfalls: `TROUBLESHOOTING.md`

## Available Skills

- Ticket delivery workflow: `.agents/skills/ticket-delivery/SKILL.md` (mirrored to `agent/skills` and `.claude/skills`).
- Other repository skills are under `.agents/skills/`, `agent/skills/` and `.claude/skills/`.
