# CU-01 — Tareas

## Orden de ejecución

- [x] **T1 — Contrato.** Actualizar `openapi.yaml`, validar y regenerar el cliente.
- [x] **T2 — Dominio.** Crear entidad, value objects y puertos sin frameworks.
- [x] **T3 — Persistencia.** Añadir solo la migración necesaria, mapeo JPA y unicidad.
- [x] **T4 — Caso de uso.** Implementar `TenantService` y sus tests unitarios.
- [x] **T5 — API.** Implementar POST, validaciones y tests con Testcontainers.
- [x] **T6 — Correo.** Implementar puerto SMTP y comprobar Mailpit.
- [x] **T7 — Frontend.** Crear store, formulario, ruta y adaptador API.
- [x] **T8 — Cierre.** Ejecutar `pnpm check`, actualizar criterios y entregar a QA.

## Notas de ejecución (ampliación 2026-09-14 — gestión SUPER_ADMIN)

Alcance ejecutado en esta iteración, más allá del alta original:

- **Contrato (OpenAPI primero):** se añadieron `GET /tenants` (paginado
  `page`/`size≤100`, filtros `search` y `status`), `GET /tenants/{id}` y
  `PATCH /tenants/{id}` con `TenantUpdateRequest{name?, status?}` (sin
  `minProperties` < 1). **Sin DELETE**: el negocio suspende. `TenantStatus` quedó
  como schema compartido. `Tenant.status` ahora referencia al enum compartido.
- **Inmutables:** `slug` y `vertical`. El dominio (`Tenant` record) no exponía
  mutadores y se preservó así: el PATCH solo cambia `name`/`status`
  (`rename`/`changeStatus` nuevos en dominio). `administratorEmail` **no** se
  persiste y queda fuera del PATCH hasta CU-25 (invitación del primer ADMIN).
- **Autorización:** `SecurityConfig` exige `ROLE_SUPER_ADMIN` en
  `/api/v1/tenants/**`. Cubierto en `TenantAdministrationIntegrationTest`:
  sin JWT → 401, ADMIN/MANAGER/STAFF → 403, SUPER_ADMIN → ciclo completo,
  404/409/400 verificados contra PostgreSQL real (Testcontainers). Resultado:
  16/16 tests de integración del bootstrap en verde sin regresiones.
- **Tenant técnico `platform` (V6):** creado por migración, marcado como técnico
  (no es una empresa de negocio). La tabla `tenant` no tiene RLS por diseño
  (ADR-0004, global): el acceso cross-tenant se regula por el rol, no por bypass
  de RLS.
- **Bootstrap SUPER_ADMIN:** `SuperAdminBootstrap` (identity-infrastructure) crea
  la cuenta al arrancar desde `SUPER_ADMIN_EMAIL/_PASSWORD` (configurable, nunca
  en Flyway ni versionada). Idempotente: si ya existe, no toca nada. Inserta
  dentro del contexto `app.tenant_id='platform'` con SET LOCAL. Sin password
  configurada, la app arranca igual y solo avisa en el log.
- **Frontend:** nuevo shell `/admin` (sidebar + header + usuario/rol + logout,
  iconos Lucide), `roleGuard` en `@mapit/auth`, redirección por rol tras login
  (SUPER_ADMIN → `/admin/tenants`), feature `administration/tenants` (lista
  paginada con búsqueda con debounce, filtro por estado, estados vacío/error/
  loading, paginación), detalle con edición de nombre, suspender/reactivar con
  confirmación, dashboard básico, y `core/strings.ts` como catálogo central de
  textos (sin framework i18n). El alta reutiliza la feature existente
  `administration/tenant-registration`. Las rutas huérfanas `/establishments` y
  `/administration/tenants/new` quedaron protegidas (`authGuard`/`roleGuard`).
- **E2E:** `apps/e2e/tests/console/tenants-admin.spec.ts` — redirección sin
  sesión y ciclo completo login → listar → crear → 409 → detalle → editar →
  suspender → reactivar, ejecutado en verde contra el stack local real.

## MAP-175 (rol de runtime) — RESUELTO (2026-09-14)

Ya no es deuda:

- `V7__rol_runtime_mapit_app.sql` crea `mapit_app` con `LOGIN NOSUPERUSER
NOBYPASSRLS NOCREATEDB NOCREATEROLE`, contraseña por placeholder de Flyway
  (`MAPIT_APP_DB_PASSWORD`, nunca en el repo), grants mínimos (CRUD, sin DDL) y
  `flyway_schema_history` revocada.
- `application.yml`: el datasource de la app usa `MAPIT_APP_DB_USER/mapit_app`;
  Flyway queda con el owner `mapit` en su propio datasource
  (`spring.flyway.url/user/password`).
- El SQL de `SET LOCAL` está centralizado en `shared-kernel` (`TenantScope`).
- Verificación: `RuntimeRoleIntegrationTest` cubre `current_user = mapit_app`,
  flags del rol, fail-closed sin tenant, aislamiento A/B y que una conexión
  reutilizada del pool no hereda el tenant anterior.

## CU-25 / MAP-182…187 — Onboarding del primer ADMIN (resuelto, 2026-09-15)

- **MAP-182:** contrato `POST /api/v1/auth/activate` versionado antes de tocar
  código + migración `V8__crear_tabla_invitation_tokens.sql` (`tenant_id`
  NOT NULL, índice `(tenant_id, id)`, RLS, `token_hash` SHA-256 único,
  `expires_at`, `consumed_at`, `user_id` se rellena al consumir).
  `pnpm api:lint`/`pnpm api:gen`/`pnpm api:check` al día.
- **MAP-183:** `TenantService.register` ahora además emite la invitación
  (token de 32 bytes SecureRandom con base64url, solo su hash persiste) y
  envía el enlace `…/activar?tenant=<slug>&token=<token>` vía
  `AdminInvitationEmailAdapter` (Mailpit en desarrollo). Misma transacción:
  si el correo falla no queda tenant a medias. `mapit.public-web-url`
  configurable.
- **MAP-184:** `ActivateAdmin` + `ActivationController` en `identity` (ruta
  pública registrada en `SecurityConfig` vía `ApiPaths.AUTH_ACTIVATE`).
  `tenantSlug` se resolverá a `tenantId` en el servidor; el token se busca
  por hash y se consume con `markConsumed` atómico; BCrypt para la
  contraseña. Errores específicos `invitation-invalid/-expired/-used`,
  `password-mismatch`, `password-weak`, `email-already-registered` (409).
- **MAP-185:** `createUser: POST /api/v1/users`. Matriz estricta:
  SUPER_ADMIN crea ADMIN/MANAGER/STAFF y exige `tenantSlug`; ADMIN crea
  solo STAFF dentro de su tenant; MANAGER y STAFF reciben 403; SUPER_ADMIN
  no es creable por API; el correo duplicado por tenant da 409.
  No hay lectura de `tenant_id` arbitrario.
- **MAP-186:** ruta pública `/activar` en public-web
  (`features/activation/`: store con signals, formulario con doble
  contraseña, mensajes por tipo de error y redirección al login de la
  consola tras éxito). Mis strings del catálogo `core/strings.ts`.
- **MAP-187:** bootstrap del SUPER_ADMIN ahora es estrictamente un único
  SUPER_ADMIN (por tenant `platform`, sin duplicar aunque cambie el email
  del `.env`); integration test dedicado. MB: `RuntimeRoleIntegrationTest`
  cubre también fallo fail-closed + pool reuse. E2E de punta a punta en
  `apps/e2e/tests/public-web/activation.spec.ts`: registro del tenant con
  API real → correo en Mailpit → activación pública → login del ADMIN.
  Backend y frontend verificados con tests unitarios, integración (`be:test`,
  `be:it`), contrato (`api:check`) y `pnpm check` todos en verde.

## MAP-175 (rol de runtime) — RESUELTO (2026-09-14)

del ADR-0004: **también implementada en esta iteración**
(`TenantIdentifierConfiguration` en bootstrap + `@TenantId` en las entidades JPA
con `tenant_id`). La doble capa del ADR — filtro en Hibernate y filtro por RLS —
queda completa; ambas leen el mismo `TenantContext`. Verificación: las 20 pruebas
de integración del bootstrap pasan, incluidas las de aislamiento RLS con roles
NOBYPASSRLS y el nuevo `RuntimeRoleIntegrationTest` de MAP-175.
