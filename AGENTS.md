# MapIt — contexto para agentes

App espacial multi-tenant: **Angular 22**, **Spring Boot 4.1.1 / Java 25**, **PostgreSQL 17**.
`console` (staff, `:4200`, JWT) y `public-web` (anónimo, `:4300`, slug de URL) comparten
código en `libs/` y el contrato en `packages/api-contract/`.
Entorno: `README.md` · flujo de trabajo: `CONTRIBUTING.md` · fallos conocidos: `TROUBLESHOOTING.md`.

## Antes de editar — lee la zona que toques

| Zona               | Instrucciones                     | Qué rige                                                      |
| ------------------ | --------------------------------- | ------------------------------------------------------------- |
| Backend            | `apps/backend/AGENTS.md`          | capas hexagonales, ArchUnit                                   |
| Consola (staff)    | `apps/console/AGENTS.md`          | MVVM, signals, style guide Angular 22                         |
| Público            | `apps/public-web/AGENTS.md`       | anónimo, sin `@mapit/auth`, bundle 800 kB                     |
| Angular compartido | `libs/AGENTS.md`                  | `ui-kit`, `api-client`, `map-engine` (motor sin decidir)      |
| Contrato API       | `packages/api-contract/AGENTS.md` | `openapi.yaml` es fuente de verdad                            |
| E2E                | `apps/e2e/AGENTS.md`              | Playwright, stack completo                                    |
| Infra / Unleash    | `infra/AGENTS.md`                 | compose, puertos, flags en 3 sitios                           |
| Casos de uso       | `specs/AGENTS.md`                 | spec → plan → tasks antes de código                           |
| Arquitectura / BD  | `docs/AGENTS.md`                  | ADR, DBML, `use_cases.md` manda sobre `project_definition.md` |

Para migraciones, flags o tickets Jira: skills `new-migration`, `new-feature-flag`, `ticket-delivery`.

## Comandos cotidianos

Node 24, Java 25 (Temurin), pnpm 11.9.0. Docker Desktop **Running** antes de `pnpm setup`, `pnpm dev*` y `pnpm be:it`.

```bash
pnpm install && pnpm setup   # .env desde .env.example, Docker, migraciones, cliente API
pnpm doctor                  # diagnóstico: qué falta y con qué comando arreglarlo
pnpm dev                     # todo: infra + backend + las 2 apps
pnpm dev:front               # solo apps Angular (levanta infra, no backend)
pnpm dev:back                # solo infra + Spring Boot
pnpm fe:console / fe:public  # Angular sin Docker, :4200 / :4300
pnpm stop                    # baja contenedores
pnpm check                   # ANTES DE CADA PUSH: prettier, lint, tipos, tests, build, contrato
pnpm fmt                     # prettier + spotless (frontend y Java)
```

Focalizadas: `pnpm be:test` (unitario + ArchUnit, sin Docker), `pnpm be:it` (Testcontainers, Docker), `pnpm fe:test` (Vitest). `pnpm e2e` requiere `pnpm dev` o `pnpm infra:full` y navegadores instalados (`pnpm e2e:install`, una vez).

Backend puntual: `node tools/scripts/gradle.mjs <tarea> [...]` (p. ej. `:bootstrap:flywayMigrate`, `test --tests "ClaseTest"`).
Frontend puntual: `pnpm exec ng test console --no-watch --include "**/archivo.spec.ts"` (idem `public-web`, `libs`).
En Windows, `pnpm be:*` usa `gradlew.bat` y carga `.env`.

`.env` **no se versiona**; `pnpm setup` lo (re)genera desde `.env.example`. Añadas una variable, añádela a `.env.example` (`pnpm doctor` verifica que ninguna falte).
`pnpm setup` puede terminar bien aunque fallen migraciones o codegen: **lee sus advertencias**, no solo el mensaje final.
No toques `allowBuilds` ni `publicHoistPattern` de `pnpm-workspace.yaml`: afectan esbuild y el dev server.

## Reglas que un agente probablemente pase por alto

1. **Contrato primero.** `packages/api-contract/openapi.yaml` → `pnpm api:lint` → `pnpm api:gen` → implementar.
   Nunca editar ni commitear `**/generated/` (cliente TS en `libs/api-client/src/lib/generated/`).
   `pnpm api:mock` sirve el contrato en `:4010` si el front está bloqueado esperando al back.
   `pnpm api:check` (CI) verifica que generado y contrato coinciden.
2. **Multi-tenant.** Staff: tenant del claim `tenant` del JWT, nunca de header ni query.
   `public-web`: slug de URL, validado por backend contra `tenant.slug`.
   Toda tabla de negocio: `tenant_id NOT NULL`, índice `(tenant_id, id)`, RLS.
   Sin tenant en sesión → **0 filas** (falla cerrado, a propósito).
3. **Esquema solo por Flyway.** `pnpm db:new "…"`; una migración mergeada **no se edita** (para corregir, otra nueva).
   `ddl-auto: validate` a propósito: **nunca** `update`.
   `docs/db/mapit.dbml` se actualiza en el **mismo commit** que la migración.
4. **Capas del backend (ArchUnit).** `*-domain` no declara Spring ni JPA (no compila si las importa).
   `*-application` no importa `*-infrastructure`: puerto en `domain`, lo implementa la infraestructura.
   Los módulos no se importan entre sí; solo `bootstrap` los conoce. Versiones en `gradle/libs.versions.toml`.
5. **Angular 22.** `inject()` sin parámetros de constructor; `@if`/`@for` y `[class.x]` (`*ngIf`, `NgClass`, `provideZoneChangeDetection` prohibidos por ESLint);
   `protected` en miembros solo de plantilla; `readonly` en inputs/outputs/queries; nada de `utils.ts`/`helpers.ts`/`common.ts`;
   una feature no importa de otra (va a `libs/`); estilos con `@use 'ui-kit/styles/tokens'`; texto visible en `STRINGS`.
6. **Feature flags.** `pnpm new:flag clave tipo` crea enum Java, catálogo TS y `unleash/flags.json`; luego en la UI (`:4242`, `admin`/`unleash4all`).
   El frontend las lee por `unleash-proxy` (`:3063`), **nunca** directo a Unleash.

## CI: qué corre en cada PR

CI corre en push y PR a `main` con `pnpm install --frozen-lockfile` (nunca edites `pnpm-lock.yaml` a mano).

- frontend: `fmt:check`, `fe:lint`, `fe:typecheck`, `fe:test`, `fe:build`
- backend: `build` (tests + ArchUnit)
- integración: Testcontainers (necesita backend verde)
- contrato: `api:lint`, `api:gen`, `api:check` — falla si `openapi.yaml` y lo generado divergen
- e2e: Playwright contra el stack completo (necesita frontend y backend verdes)
  SonarQube solo a mano (`workflow_dispatch`, máquina de calidad), no en CI normal.
  Un PR sin `specs/CU-XX/` vinculado se devuelve (plantilla en `.github/pull_request_template.md`).

## Trampas conocidas (han fallado de verdad)

- **Jackson 3 (Spring Boot 4):** imports `tools.jackson.*`; `com.fasterxml.jackson.*` es Jackson 2 y rompe.
  Props como `spring.jackson.serialization.write-dates-as-timestamps` ya no existen e impiden el arranque.
- **Flyway silenciosa:** en Boot 4 hace falta `spring-boot-flyway` además de `flyway-core`; sin ella, la app arranca y las migraciones **no se ejecutan**, sin error.
- **CORS ambigua:** inyectar `CorsConfigurationSource` con `@Qualifier("corsConfigurationSource")`.
- **Postgres en el host es `:5433`** (no 5432); dentro de Docker el contenedor sigue en 5432.

## Flujo de trabajo (CONTRIBUTING.md)

Rama: `feat/CU-XX-<slug>`; para MAP/HU apiladas, `feat/<usuario>/MAP-122-<subtarea>`, cada PR apunta a la rama anterior y solo la última a `main`.
Commits: Conventional Commits, validados por hook de husky (se rechazan al hacer commit, no en el PR).
Antes de cada push: `pnpm check`.
