# MapIt — contexto para agentes

**Enrutador de contexto**, no documentación. Busca tu tarea en la tabla, carga lo que indica y trabaja con eso. Cada carpeta tiene su `AGENTS.md` con reglas de su zona.

**Requisitos:** Node 24 (`.nvmrc`; mínimo 22 en `engines`), pnpm 11+, **JDK Temurin 25**, Docker. Gradle y Angular CLI vienen en el repo (wrapper y `pnpm exec ng`). Sin JDK, el backend se omite.

## Qué es MapIt

Motor de gestión espacial **multi-tenant**: el mapa es la interfaz operativa. 4 verticales (restaurante, discoteca, salón, hotel). Angular 22 + Spring Boot 4.1 + PostgreSQL 17.

Alcance real: `docs/roadmap/use_cases.md` (manda sobre `project_definition.md`).

## Tabla de ruteo

| Tarea                      | Lee                                                    | Agente              | Skill              |
| -------------------------- | ------------------------------------------------------ | ------------------- | ------------------ |
| Caso de uso completo       | `specs/AGENTS.md` (carpetas `CU-XX-…` / `HU-X.XX-…`)   | —                   | `new-usecase`      |
| Endpoint / contrato API    | `packages/api-contract/AGENTS.md`                      | `api-contract`      | —                  |
| Lógica dominio / backend   | `apps/backend/AGENTS.md`                               | `backend-hexagonal` | —                  |
| Pantalla / feature Angular | `apps/console/AGENTS.md` o `apps/public-web/AGENTS.md` | `angular-feature`   | —                  |
| Cambio esquema BD          | `apps/backend/AGENTS.md` + `docs/db/mapit.dbml`        | `db-migration`      | `new-migration`    |
| Feature flag               | `infra/AGENTS.md`                                      | —                   | `new-feature-flag` |
| Test E2E                   | `apps/e2e/AGENTS.md`                                   | —                   | —                  |
| Decisión arquitectura      | `docs/AGENTS.md`                                       | —                   | —                  |

## Reglas duras (romperlas rompe el build)

1. `*-domain` **no importa Spring, JPA ni Jackson** (no compila; ArchUnit lo verifica)
2. `*-application` **no importa `*-infrastructure`** (habla por puertos)
3. **Contrato primero**: `packages/api-contract/openapi.yaml` es la verdad; `pnpm api:gen` genera cliente TS e interfaces Java
4. **Esquema solo por migración Flyway**: `ddl-auto: validate` falla si entidad ≠ esquema; migración mergeada no se edita
5. **Toda tabla de negocio**: `tenant_id NOT NULL` + índice `(tenant_id, id)` + RLS
6. **Feature Angular no importa de otra feature**; lo compartido va a `libs/`
7. **No `konva` fuera de su adaptador** (`MapEnginePort` en `@mapit/map-engine`)
8. **Zoneless**: nada de `provideZoneChangeDetection()` ni Zone.js
9. **Módulos backend no se importan entre sí**; solo `bootstrap` los conoce
10. **Versiones en `apps/backend/gradle/libs.versions.toml`** (version catalog), nunca en `build.gradle.kts`

## Comandos esenciales

```bash
pnpm setup          # primer clone (~5 min): .env, Docker, migra BD
pnpm dev            # todo: infra + backend + 2 apps Angular
pnpm dev:front      # solo Angular (console :4200, public-web :4300)
pnpm dev:back       # solo infra + Spring Boot
pnpm check          # ANTES DE CADA PUSH: fmt + lint + tipos + tests + build + api:check + ArchUnit
pnpm fmt            # autofix (prettier + spotless); lo 1º que pide check
pnpm doctor         # diagnóstico entorno
pnpm stop           # baja contenedores
pnpm api:gen        # regenera contrato (TS + Java)
pnpm be:test        # tests backend (unit + ArchUnit)
pnpm be:it          # tests integración (Testcontainers)
pnpm fe:test        # tests frontend (Vitest)
pnpm db:new "msg"   # nueva migración Flyway
pnpm new:flag ...   # feature flag coherente en 3 sitios
pnpm new:spec       # andaima spec CU | new:module / new:feature para código
pnpm db:seed        # datos prueba · pnpm api:check = contrato sin drift
pnpm api:mock       # Prism en :4010 — frontend sin backend
pnpm e2e            # Playwright · e2e:ui con UI · fe:typecheck solo tipos
```

Un test: backend `node tools/scripts/gradle.mjs :modulo:test --tests "ClaseTest"`; frontend `pnpm exec ng test console --include "**/archivo.spec.ts"` (Vitest vía `ng test`).

`pnpm check` no se detiene en el primer fallo; resume al final. Sin Java, backend se omite con aviso.

## Puertos y URLs

| Servicio                | URL                                                        |
| ----------------------- | ---------------------------------------------------------- |
| Consola (staff)         | http://localhost:4200                                      |
| Vista pública           | http://localhost:4300                                      |
| API + Swagger           | http://localhost:8080/swagger-ui.html                      |
| Feature flags (Unleash) | http://localhost:4242 — `admin` / `unleash4all`            |
| Proxy flags             | http://localhost:3063/proxy — frontend **solo** habla aquí |
| Correos prueba          | http://localhost:8025                                      |
| PostgreSQL              | `localhost:5433` (host) / `5432` (Docker)                  |

## Commits

**Conventional Commits obligatorio** (hook `commit-msg` rechaza). Mensajes en español. Scope **lista cerrada** en `commitlint.config.js`:

```
backend, platform, identity, spaces, operations, reservations, payments,
frontend, console, public-web, ui-kit, api-client, auth, feature-flags,
realtime, map-engine, contract, infra, e2e, db, ci, docs, specs, deps, tooling
```

Otro scope = reject. Cabecera máx 100 chars.

`pre-commit` corre lint-staged (prettier + `eslint --fix` sobre staged); no uses `--no-verify`.

## Trampas conocidas

- **Jackson 3**: imports `tools.jackson.*`, **no** `com.fasterxml.jackson.*` (error nº1 copiando de internet)
- **Spring Boot 4**: autoconfiguraciones en módulos aparte; Flyway necesita `spring-boot-flyway` + `flyway-core`; sin el primero, migraciones **no corren en silencio**
- **TypeScript 6** obligatorio para Angular 22
- **Angular 22 sin sufijos**: `home.ts`, no `home.component.ts`
- **PostgreSQL en 5433**, no 5432
- **Sin `tenant_id` en sesión → 0 filas** (RLS, no bug)
- **`CorsConfigurationSource` requiere `@Qualifier("corsConfigurationSource")`** (Spring MVC registra otro bean igual)
- **`RestClient`**, no `RestTemplate`; **`RestTestClient`** reemplaza `MockMvc`/`TestRestTemplate`
- **Null-safety JSpecify**: cada paquete tiene `package-info.java` con `@NullMarked`
- **`JAVA_HOME` en `.env` gana** (`gradle.mjs` lo lee); permite Temurin 25 sin admin
- **`**/generated/` no se edita**; se regenera desde contrato
- **`springdoc` puede ir un paso atrás** vs Spring Framework 7; si falla, el contrato es el yaml
- **PowerShell**: `git show HEAD:archivo > salida` corrompe UTF-8; usa `[Console]::OutputEncoding=[Text.Encoding]::UTF8` + `[IO.File]::WriteAllText(..., UTF8 sin BOM)`
- **`.env` está trackeado** (skip-worktree); cambios no siempre en `git status`

## Multi-tenant (clave)

Tenant = **claim `tenant` del JWT** (no header, falsificable). Doble capa:

1. Entidades JPA antiguas: `@TenantId` de Hibernate (`EstablishmentJpaEntity`, `DemoItemJpaEntity`); nuevas (spaces): **queries filtran explícitamente `tenant_id`** (repos solo métodos "vivos y del tenant"). En ambos casos: no omitas el filtro.
2. PostgreSQL RLS filtra en BD, incluso SQL nativo.

Sin tenant → 0 filas. Falla cerrado a propósito.

## Frontend: reglas de estilo (ESLint)

- `@if` / `@for`, no `*ngIf` / `*ngFor`
- `[class.x]` / `[style.x]`, no `NgClass` / `NgStyle`
- `inject()`, no parámetros constructor
- Miembros solo plantilla: `protected`; inputs/outputs/queries: `readonly`
- Nada de `utils.ts`, `helpers.ts`, `common.ts`
- Estilos `libs/` via `@use 'ui-kit/styles/tokens'` (resuelto en `angular.json`)

## Frontend: strings y constantes

**Cero texto visible hardcodeado.** Todo sale del catálogo — errata en clave no compila (`as const` + `typeof`).

| Zona            | Fuente                                                                            |
| --------------- | --------------------------------------------------------------------------------- |
| Consola (staff) | `apps/console/src/app/core/strings.ts` → `STRINGS`                                |
| Web pública     | `apps/public-web/src/app/core/strings.ts` → `STRINGS` (+ `SHARED` CTAs repetidos) |
| `libs/auth`     | `libs/auth/src/lib/auth-strings.ts`                                               |
| `libs/ui-kit`   | `libs/ui-kit/src/lib/site-strings.ts`                                             |

**Librería nunca importa strings de app**; si el texto es de la lib, vive ahí.

**Rutas compartidas backend**: `shared-kernel/.../http/ApiPaths.java` (login, activate, tenants, demo, establishments). Rutas internas por módulo van en su controller, no en ApiPaths.

## Feature flags

```html
@if (flags.isEnabled('payments.qr')()) { … }
<p *featureFlag="'payments.qr'">…</p>
```

Claves tipadas: errata **no compila**. Nueva flag: `pnpm new:flag`.

## Estructura del monorepo

```
apps/
  backend/      Spring Boot 4.1 · Gradle multi-módulo · Hexagonal Modular
  console/      Angular 22 — staff: editor mapas, operación, dashboard
  public-web/   Angular 22 — cliente final: disponibilidad, reserva, pago QR
  e2e/          Playwright
libs/           shared Angular (ui-kit, api-client, auth, feature-flags, realtime, map-engine)
packages/       contrato OpenAPI + config compartida
infra/docker/   compose dev + deploy
specs/          1 carpeta por CU (spec → plan → tasks)
docs/           roadmap, ADR, DBML, diagramas
```

## Antes de dar por terminado

- `pnpm check` en verde
- Si tocaste esquema: `docs/db/mapit.dbml` actualizado **en el mismo commit**
- Si completaste CU: criterios `spec.md` marcados + notas ejecución en `tasks.md`

## Flujo SPEC-Driven (spec → plan → tasks)

```bash
git switch -c feat/CU-12-crear-reserva
pnpm new:spec CU-12-crear-reserva   # crea specs/CU-12-crear-reserva/{spec,plan,tasks}.md
```

Tres archivos, **en este orden**:

| Archivo    | Responde                                                                 | Se escribe antes de |
| ---------- | ------------------------------------------------------------------------ | ------------------- |
| `spec.md`  | **QUÉ** y **POR QUÉ**: criterios de aceptación, reglas, fuera de alcance | pensar en código    |
| `plan.md`  | **CÓMO**: módulos, contrato, migraciones, **patrones de diseño**         | escribir código     |
| `tasks.md` | tareas ejecutables y verificables, en orden                              | empezar             |

> **Regla:** la sección "Patrones de diseño aplicados" de `plan.md` es obligatoria (columnas _por qué aquí_ / _alternativa descartada_). Catálogo: `docs/architecture/design-patterns.md`.

## Ramas y PRs

```
main                    protegida: solo PR con 1 aprobación
feat/CU-12-crear-reserva
fix/reserva-no-libera-mesa
docs/adr-motor-de-mapa
chore/actualizar-angular
```

**Historias Jira con subtareas** → ramas apiladas:

```
feat/usuario/HUT-01-descripcion
  -> feat/usuario/MAP-122-contrato-eventos-stomp
  -> feat/usuario/MAP-120-servidor-stomp
  -> feat/usuario/MAP-121-rooms-establishment-sector
  -> feat/usuario/MAP-123-tests-client-reconexion
```

Cada PR enlaza la historia, indica su rama base y el siguiente PR. Solo la última apunta a `main`.

## Un solo test

```bash
# Backend
node tools/scripts/gradle.mjs :modulo:test --tests "ClaseTest"

# Frontend (Vitest vía ng test)
pnpm exec ng test console --include "**/archivo.spec.ts"
```

## Stack verificación (`pnpm check`)

Ejecuta **todo** sin detenerse en el primer fallo; resume al final:

1. `prettier --check .` (formato)
2. `eslint` (lint frontend)
3. `tsc --noEmit` (tipos frontend)
4. `vitest` (tests frontend)
5. `ng build` (build frontend)
6. `api:check` (contrato sin drift)
7. `gradle build` (backend: compila + tests unit + ArchUnit) — _si hay Java_

## Referencia rápida

| Qué buscas              | Dónde                                  |
| ----------------------- | -------------------------------------- |
| Alcance / casos uso     | `docs/roadmap/use_cases.md`            |
| Decisiones arquitectura | `docs/architecture/adr/`               |
| Modelo datos (fuente)   | `docs/db/mapit.dbml`                   |
| Patrones aprobados      | `docs/architecture/design-patterns.md` |
| Cómo contribuir         | `CONTRIBUTING.md`                      |
| Problemas frecuentes    | `TROUBLESHOOTING.md`                   |
