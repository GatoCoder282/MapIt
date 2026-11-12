# MapIt — contexto para agentes

Monorepo multi-tenant: Angular 22 + Spring Boot 4 / Java 25 + PostgreSQL 17.
`console` es staff con JWT; `public-web` es anónimo: no importar `@mapit/auth` allí.
Entorno: `README.md`; flujo de entrega: `CONTRIBUTING.md`; fallos: `TROUBLESHOOTING.md`.

## Antes de editar

Lee el `AGENTS.md` de la zona antes de editar; aquí se resumen solo límites compartidos:

| Instrucciones                     | Cuándo leerlas                                                 |
| --------------------------------- | -------------------------------------------------------------- |
| `apps/backend/AGENTS.md`          | Capas hexagonales, ArchUnit, trampas de Boot 4/Jackson 3       |
| `apps/console/AGENTS.md`          | Staff: MVVM/signals, contexto operativo, i18n, config runtime  |
| `apps/public-web/AGENTS.md`       | Público: sin sesión de staff, tenant por URL, bundle limitado  |
| `libs/AGENTS.md`                  | APIs públicas, dependencias permitidas, puerto del mapa        |
| `packages/api-contract/AGENTS.md` | OpenAPI; STOMP se documenta aparte en `docs/api/`              |
| `apps/e2e/AGENTS.md`              | Playwright con stack completo                                  |
| `infra/AGENTS.md`                 | Compose, Unleash/proxy, variables y volúmenes                  |
| `specs/AGENTS.md`                 | CU/HU: spec → plan → tasks antes del código                    |
| `docs/AGENTS.md`                  | ADR y DBML; `use_cases.md` manda sobre `project_definition.md` |

Para migraciones, flags o tickets Jira: skills `new-migration`, `new-feature-flag`, `ticket-delivery`.

## Entorno y arranque

- Usa Node 24, JDK 25 y el pin `pnpm@11.9.0` de `package.json`, aunque `engines` permita Node 22. No necesitas Gradle ni Angular CLI globales.
- `pnpm install` → `pnpm setup` → `pnpm dev`. Docker debe estar activo para setup, dev y Testcontainers; `pnpm doctor` diagnostica requisitos y puertos.
- `setup` crea `.env` desde `.env.example` con un JWT secret propio; si ya existe, solo añade claves faltantes. Añade nuevas variables a `.env.example`, nunca versiones `.env`.
- **Lee las advertencias de setup:** puede terminar con éxito aunque fallen migraciones, flags o codegen. Si ya hay `node_modules`, no reinstala dependencias.
- `pnpm dev:front` levanta infra + ambas apps, **no el backend**; `pnpm dev:back` levanta infra + backend. `pnpm fe:console` / `pnpm fe:public` arrancan solo Angular, sin Docker (`:4200` / `:4300`).
- `pnpm dev` / `dev:back` usan el perfil Spring `dev` si no defines `SPRING_PROFILES_ACTIVE`; `pnpm be:run` no lo activa. Importa para la simulación local de pagos mock.
- Reutiliza una sesión existente si los puertos están ocupados. Ctrl+C detiene los procesos de dev pero deja contenedores; `pnpm stop` baja contenedores, **no** Angular/Java del host.
- PostgreSQL en el host: **5433**, no 5432 (dentro de Docker: 5432). `pnpm infra:reset` **borra volúmenes y datos**.
- Conserva `allowBuilds` y `publicHoistPattern` de `pnpm-workspace.yaml`: sin ellos pueden fallar esbuild o la resolución de imports del dev server.

## Contrato, datos y límites

- **Contrato primero:** `packages/api-contract/openapi.yaml` → `pnpm api:lint` → `pnpm api:gen` → implementar. No edites ni versiones salidas `generated/`; el cliente TS vive en `libs/api-client/src/lib/generated/`.
- Regenera antes de typecheck/tests/build frontend en un checkout limpio. `pnpm api:check` solo compara el hash guardado del contrato; **sin cliente generado avisa pero sale con éxito**. No sustituye lint ni codegen. `pnpm api:mock` sirve el contrato en `:4010`.
- `api:gen` genera solo TypeScript (no interfaces Java, aunque lo diga la guía del contrato) y no corre con `pnpm install`. Usa Java del PATH o Docker; **no carga `.env` ni aplica su `JAVA_HOME`**, a diferencia del wrapper Gradle. Puede salir con éxito sin generar: comprueba la salida, no solo el código de retorno.
- Staff: tenant del claim JWT `tenant`, nunca de header/query. Las rutas públicas resuelven el tenant desde la URL validada por backend; no confíes en un tenant arbitrario del cliente.
- Tablas de negocio: `tenant_id NOT NULL`, índice `(tenant_id, id)` y RLS (`enable_tenant_isolation`). Sin `app.tenant_id`, RLS devuelve 0 filas a propósito.
- El datasource usa `mapit_app` (sin bypass de RLS); Flyway usa el owner `mapit`. No sustituyas el usuario de runtime por el owner para resolver consultas vacías (`apps/backend/bootstrap/src/main/resources/application.yml`).
- Esquema solo por Flyway: `pnpm db:new "…"`, `pnpm db:migrate`. Nunca edites una migración mergeada ni cambies `ddl-auto: validate` a `update`. Actualiza `docs/db/mapit.dbml` en el mismo commit y añade prueba de aislamiento si creas tablas.
- No imports entre features Angular; usa `core/` para estado compartido de una app y `libs/` entre apps (API pública en `src/index.ts`, sin imports profundos). Textos visibles en `STRINGS` y sus catálogos por idioma; convenciones MVVM/Angular en los `AGENTS.md` de cada app.
- ESLint se configura en la raíz y `packages/config-eslint/`, no por app. Logs del navegador por `@mapit/logging`; solo su adaptador usa `console`. Estilos compartidos: `@use 'ui-kit/styles/tokens'` (include path `libs`).
- Las restricciones de imports se mantienen juntas en `packages/config-eslint/boundaries.js`: redefinir `no-restricted-imports` en otro bloque reemplaza las anteriores, no las fusiona.
- Flags: `pnpm new:flag clave tipo` mantiene enum Java, catálogo TS y bootstrap Unleash; el argumento CLI es `kill_switch` (el script lo convierte a `kill-switch` para Unleash). Revisa su activación en Unleash. El navegador usa `unleash-proxy` (`:3063`), nunca el servidor/admin directamente.

## Verificación y entrega

- Antes de cada push: `pnpm check`. Ejecuta formato, lint, tipos, tests/build frontend, hash API y build backend; **omite backend si falta Java/wrapper** y no incluye integración, E2E ni `api:lint`. CI los valida en jobs separados (`.github/workflows/ci.yml`).
- Formato de un archivo: `pnpm exec prettier --write AGENTS.md` (sustituye la ruta). `pnpm fmt` formatea **todo** el repo y ejecuta Spotless; para Java solamente: `pnpm be:fmt`.
- `pnpm be:test`: unitarios + ArchUnit, sin Docker. `pnpm be:it`: integración con Testcontainers, requiere Docker. `pnpm fe:test`: Vitest de console, public-web **y libs**.
- Backend puntual desde la raíz: `node tools/scripts/gradle.mjs :bootstrap:test --tests "com.mapit.ClaseTest"` (cambia módulo/clase; usa `integrationTest` para integración). `be:test` abarca todos los módulos, no solo `bootstrap`. El wrapper carga `.env`, aplica Java y selecciona `gradlew.bat` en Windows.
- Frontend puntual: `pnpm exec ng test console --no-watch --include "**/archivo.spec.ts"`; sustituye `console` por `public-web` o **`libs`** (un único proyecto de tests para todas las libs).
- `pnpm fe:typecheck` usa `tsc`, no comprueba plantillas Angular. Para verificar plantillas/SCSS y presupuestos de una app: `pnpm exec ng build console` (o `public-web`); el build predeterminado es producción (`angular.json`).
- E2E: `pnpm e2e:install` una vez; levanta el stack con `pnpm dev` o `pnpm infra:full` antes de `pnpm e2e` (Playwright no inicia servidores). Focalizado: `pnpm --filter @mapit/e2e exec playwright test --project=console tests/console/archivo.spec.ts`.
- Entrega CU/HU siguiendo `specs/AGENTS.md`; registra descubrimientos en las notas de ejecución de `tasks.md`. Ramas/PR apilados Jira y enlace a spec: `CONTRIBUTING.md` y `.github/pull_request_template.md`.
- Husky ejecuta lint-staged al commit y commitlint exige Conventional Commits. Pasar el hook no equivale a `pnpm check`: lint-staged permite hasta 5 warnings, `fe:lint` exige 0.
