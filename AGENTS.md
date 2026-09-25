# MapIt — contexto para agentes

Este archivo es un **enrutador de contexto**, no documentación. Encuentra tu tarea en la tabla, carga lo que indica, y trabaja con eso. Cada carpeta tiene su propio `AGENTS.md` con las reglas de su sección.

**Requisitos del entorno:** Node 24, pnpm 11+, **JDK Temurin 25**, Docker. No instales Gradle ni Angular CLI: van en el repo (wrapper de Gradle y `pnpm exec ng`). Sin JDK, todo lo de backend se omite.

## Qué es MapIt

Motor de gestión espacial **multi-tenant**: el mapa del local es la interfaz operativa del negocio, no un dibujo. Un mismo motor sirve 4 verticales (restaurante, discoteca, salón de eventos, hotel). Angular 22 + Spring Boot 4.1 + PostgreSQL.

Alcance real: `docs/roadmap/use_cases.md` (**manda sobre `project_definition.md`**).

## Tabla de ruteo

| Si la tarea es…                  | Lee                                                      | Agente              | Skill              |
| -------------------------------- | -------------------------------------------------------- | ------------------- | ------------------ |
| Un caso de uso completo          | `specs/AGENTS.md`                                        | —                   | `new-usecase`      |
| Endpoint o cambio de contrato    | `packages/api-contract/AGENTS.md`                        | `api-contract`      | —                  |
| Lógica de dominio / backend      | `apps/backend/AGENTS.md`                                 | `backend-hexagonal` | —                  |
| Pantalla o feature Angular       | `apps/console/AGENTS.md` (o `apps/public-web/AGENTS.md`) | `angular-feature`   | —                  |
| Cambio de esquema de BD          | `apps/backend/AGENTS.md` + `docs/db/mapit.dbml`          | `db-migration`      | `new-migration`    |
| Activar/desactivar funcionalidad | `infra/AGENTS.md`                                        | —                   | `new-feature-flag` |
| Test E2E                         | `apps/e2e/AGENTS.md`                                     | —                   | —                  |
| Decisión de arquitectura         | `docs/AGENTS.md`                                         | —                   | —                  |

## Reglas duras (romperlas rompe el build)

1. **`*-domain` no importa Spring, JPA ni Jackson.** No es una convención: esos módulos Gradle no declaran las dependencias, así que no compila. ArchUnit es la segunda red.
2. **`*-application` no importa `*-infrastructure`.** Se habla con el exterior por puertos.
3. **El contrato se edita antes que el código.** `packages/api-contract/openapi.yaml` es la fuente de verdad; de ahí salen el cliente TS y las interfaces Java.
4. **El esquema solo cambia por migración Flyway.** `ddl-auto: validate` rompe el arranque si una entidad no coincide. Una migración mergeada no se edita jamás.
5. **Toda tabla de negocio lleva `tenant_id` + índice `(tenant_id, id)` + RLS.**
6. **Una feature Angular no importa de otra feature.** Lo compartido va a `libs/`.
7. **No se importa `konva` fuera de su adaptador.** El motor de mapa está sin decidir.
8. **Zoneless.** Nada de `provideZoneChangeDetection()` ni Zone.js.
9. **Los módulos backend no se importan entre sí.** Solo `bootstrap` los conoce a todos.
10. **Versiones en `apps/backend/gradle/libs.versions.toml`** (version catalog), nunca escritas en un `build.gradle.kts`.

## Comandos esenciales

```bash
pnpm setup          # primer clone (~5 min): crea .env, levanta Docker, migra BD
pnpm dev            # todo el stack: infra + backend + 2 apps Angular
pnpm dev:front      # solo las apps Angular (console :4200, public-web :4300)
pnpm dev:back       # solo infra + Spring Boot
pnpm check          # ANTES DE CADA PUSH: formato + lint + tipos + tests + build + api:check + ArchUnit
pnpm fmt            # autofix de formato (prettier + spotless); lo 1º que pide `pnpm check`
pnpm doctor         # diagnóstico completo del entorno
pnpm stop           # baja contenedores
pnpm api:gen        # regenerar contrato (cliente TS + interfaces Java)
pnpm be:test        # tests backend (unit + ArchUnit)
pnpm be:it          # tests integración (Testcontainers)
pnpm fe:test        # tests frontend (Vitest)
pnpm db:new "msg"   # nueva migración Flyway
pnpm new:flag ...   # nueva feature flag coherente en 3 sitios
pnpm new:spec       # andamiar spec de un CU | new:module / new:feature para código
pnpm db:seed        # datos de prueba · pnpm api:check = contrato sin drift
pnpm api:mock       # Prism sirve el contrato en :4010 — frontend sin backend
```

Correr un solo test: backend `node tools/scripts/gradle.mjs :modulo:test --tests "ClaseTest"`; frontend `pnpm exec ng test console --include "**/archivo.spec.ts"` (el builder es Vitest, vía `ng test`).

`pnpm check` no se detiene en el primer fallo: resume al final. Sin Java, el backend se omite con aviso.

## Puertos y URLs

| Servicio                | URL                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Consola (staff)         | http://localhost:4200                                                                      |
| Vista pública           | http://localhost:4300                                                                      |
| API + Swagger           | http://localhost:8080/swagger-ui.html                                                      |
| Feature flags (Unleash) | http://localhost:4242 — `admin` / `unleash4all`                                            |
| Proxy de flags          | http://localhost:3063/proxy — el frontend **solo** habla con él, nunca con Unleash directo |
| Correos de prueba       | http://localhost:8025                                                                      |
| PostgreSQL              | `localhost:5433` (host) / `5432` (Docker interno)                                          |

## Commits

**Conventional Commits obligatorio**: el hook `commit-msg` (husky + commitlint) rechaza el commit en el momento. Mensajes en español. El scope es una **lista cerrada** en `commitlint.config.js`:

```
backend, platform, identity, spaces, operations, reservations, payments,
frontend, console, public-web, ui-kit, api-client, auth, feature-flags,
realtime, map-engine, contract, infra, e2e, db, ci, docs, specs, deps, tooling
```

Otro scope = commit rechazado. Cabecera máx. 100 caracteres.

## Trampas conocidas

- **Jackson 3** en Spring Boot 4: los imports son `tools.jackson.*`, **no** `com.fasterxml.jackson.*`. Error nº1 al copiar código de internet.
- **Spring Boot 4 partió autoconfiguraciones en módulos**: Flyway necesita `spring-boot-flyway` además de `flyway-core`; sin él, la app arranca y las migraciones **no se ejecutan, en silencio**.
- **TypeScript 6** es obligatorio para Angular 22. No lo bajes.
- **Angular 22 sin sufijos** en nombres de archivo: `home.ts`, no `home.component.ts`.
- **PostgreSQL en el puerto 5433**, no 5432 (para no chocar con instalaciones nativas).
- **Sin `tenant_id` en la sesión, las consultas devuelven 0 filas.** Es la RLS, no un bug.
- **`CorsConfigurationSource` requiere `@Qualifier("corsConfigurationSource")`**: Spring MVC registra otro bean del mismo tipo.
- **`RestClient`**, no `RestTemplate`. **`RestTestClient`** reemplaza a `MockMvc`/`TestRestTemplate`.
- **Null-safety JSpecify**: cada paquete lleva `package-info.java` con `@NullMarked`.
- **`JAVA_HOME` en `.env` gana sobre la variable de sistema** (`gradle.mjs` la lee): permite apuntar al Temurin 25 correcto sin permisos de admin.
- **El código bajo `**/generated/` no se edita**: se regenera desde el contrato.
- **`springdoc` puede ir un paso atrás** respecto a Spring Framework 7. Si falla, el contrato sigue siendo el yaml.

## Multi-tenant (clave)

El tenant sale del **claim `tenant` del JWT**, no de un header (falsificable). Doble capa:

1. Las entidades JPA antiguas llevan `@TenantId` de Hibernate (p. ej. `EstablishmentJpaEntity`,
   `DemoItemJpaEntity`); las nuevas de spaces no — ahí **todas las queries filtran
   explícitamente por `tenant_id`** (los repos solo tienen métodos «vivos y del tenant»).
   En ambos casos: no omitas el filtro en código nuevo.
2. PostgreSQL RLS filtra en la BD, incluso ante SQL nativo.

Sin tenant en la sesión, las consultas devuelven **0 filas**. Falla cerrado, a propósito.

## Frontend: reglas de estilo (aplicadas por ESLint)

- `@if` / `@for`, no `*ngIf` / `*ngFor`
- `[class.x]` / `[style.x]`, no `NgClass` / `NgStyle`
- `inject()`, no parámetros de constructor
- Miembros solo para plantilla: `protected`. Inputs/outputs/queries: `readonly`
- Nada de `utils.ts`, `helpers.ts`, `common.ts`
- Estilos de `libs/` via `@use 'ui-kit/styles/tokens'` (resuelto por `angular.json`)

## Frontend: strings y constantes

**Cero texto visible hardcodeado.** Todo texto que ve el usuario sale del catálogo de
strings — una errata en la clave no compila (objeto `as const` + `typeof`).

Cada zona tiene su fuente; tu texto va en la que te toca, no en otra:

| Zona                              | Fuente                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Consola (staff)                   | `apps/console/src/app/core/strings.ts` → `STRINGS`                                                               |
| Web pública                       | `apps/public-web/src/app/core/strings.ts` → `STRINGS` (además `SHARED` para CTAs que se repiten entre secciones) |
| `libs/auth`                       | `libs/auth/src/lib/auth-strings.ts`                                                                              |
| `libs/ui-kit` (chrome compartido) | `libs/ui-kit/src/lib/site-strings.ts`                                                                            |

Una librería **nunca importa strings de una app**; si el texto le pertenece a la lib, vive
ahí mismo.

**Rutas compartidas:** en el backend, las rutas que cruzan módulos van en
`shared-kernel/.../http/ApiPaths.java` fija (login, activate, tenants, demo,
establishments). Nuevas rutas internas por módulo van en su controller, no en ApiPaths.
No pongas strings de rutas duplicadas en Security+ o controllers distintos — esa es
justo la fuga que este archivo central evita.

## Feature flags

```html
@if (flags.isEnabled('payments.qr')()) { … }
<p *featureFlag="'payments.qr'">…</p>
```

Claves tipadas: una errata **no compila**. Nueva flag: `pnpm new:flag`.

## Estructura del monorepo

```
apps/
  backend/      Spring Boot 4.1 · Gradle multi-módulo · Hexagonal Modular
  console/      Angular 22 — staff: editor de mapas, operación, dashboard
  public-web/   Angular 22 — cliente final: disponibilidad, reserva, pago QR
  e2e/          Playwright
libs/           librerías Angular compartidas (ui-kit, api-client, auth, feature-flags, realtime, map-engine)
packages/       contrato OpenAPI y configuración compartida
infra/docker/   compose de desarrollo y de despliegue
specs/          una carpeta por caso de uso (spec → plan → tasks)
docs/           roadmap, arquitectura (ADR), modelo de datos (DBML), diagramas
```

## Antes de dar por terminado

- `pnpm check` en verde
- Si tocaste el esquema, `docs/db/mapit.dbml` actualizado en el mismo commit
- Si completaste un CU: todos los criterios de `spec.md` marcados + notas de ejecución en `tasks.md`

## Documentación de referencia

| Qué buscas                          | Dónde                                  |
| ----------------------------------- | -------------------------------------- |
| Alcance y casos de uso              | `docs/roadmap/use_cases.md`            |
| Decisiones de arquitectura          | `docs/architecture/adr/`               |
| Modelo de datos (fuente conceptual) | `docs/db/mapit.dbml`                   |
| Patrones de diseño aprobados        | `docs/architecture/design-patterns.md` |
| Cómo contribuir (ramas, PR, SDD)    | `CONTRIBUTING.md`                      |
| Problemas frecuentes y soluciones   | `TROUBLESHOOTING.md`                   |

## Equipo y ownership

| Integrante | Rol                          | Casos de uso       |
| ---------- | ---------------------------- | ------------------ |
| A          | Backend Core                 | CU-01…CU-08        |
| B          | Backend Reservas/Pagos       | CU-09, CU-11…CU-18 |
| C          | Frontend Editor              | CU-06…CU-08        |
| D          | Frontend Operación/Dashboard | CU-09…CU-18        |
| E          | Full-stack / QA / Verticales | CU-19…CU-24        |
