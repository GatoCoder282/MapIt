# CU-25 — Tareas

> Se generan desde `plan.md`. Cada tarea debe ser **ejecutable y verificable**:
> al terminarla, algo observable cambia (un test pasa, un endpoint responde).
> Si una tarea no se puede verificar, está mal descompuesta.

## Orden de ejecución

- [x] **T1 — Prerequisito MAP-175.** Crear rol `mapit_app` sin superusuario (V7),
      `TenantScope` con `SET LOCAL`, doble datasource en `application.yml`/`.env.example`,
      tests de aislamiento actualizados al rol real.
      _Verificación:_ `RuntimeRoleIntegrationTest` en verde; `SELECT rolsuper, rolbypassrls … WHERE rolname='mapit_app'` → `f, f`.
      _Nota:_ subido en la rama `MAP-175-rol-mapit-app` (commit `6851fab`) con la
      resolución de conflictos de `SecurityConfig.java` (unión con rutas de `floors/sectors` de main).

- [ ] **T2 — Contrato (MAP-182).** Editar `packages/api-contract/openapi.yaml` con
      `POST /api/v1/auth/activate` y `POST /api/v1/users`; correr `pnpm api:gen`.
      _Verificación:_ `openapi.yaml` en verde y artefactos generados actualizados.
      _Nota:_ subido en CU-25 junto con el resto del flujo (pues el código depende
      del contrato generado). Dejar evidencia en el PR.

- [ ] **T3 — Migración invitation_tokens.** `V8__crear_tabla_invitation_tokens.sql` con
      `tenant_id` + índice + RLS + expiración 24 h.
      _Verificación:_ `pnpm db:migrate` aplica limpio; test de aislamiento entre tenants.

- [ ] **T4 — Dominio.** `InvitationToken`, `InvitationTokenStore`, `PasswordHasher`,
      `AppUserCreator`, `TenantDirectory`, `ActivationExceptions`,
      `SuperAdminBootstrap` reglas puras.
      _Verificación:_ tests unitarios del dominio sin Spring.

- [ ] **T5 — Casos de uso.** `ActivateAdmin` (transaccional atómico), `CreateUser`,
      `CreateSuperAdminUseCase`, `PasswordPolicy`.
      _Verificación:_ tests con puertos simulados; login posterior contra JWT.

- [ ] **T6 — Adaptadores.** Controllers de activación/usuarios, adaptadores JDBC
      de invitaciones y usuarios, BCrypt, envío de email (`AdminInvitationEmailAdapter`),
      `SuperAdminBootstrap`.
      _Verificación:_ `SuperAdminBootstrapTest`, `AdminActivationIntegrationTest`,
      `UserCreationIntegrationTest`, `TenantAdministrationIntegrationTest` en verde.

- [ ] **T7 — Frontend.** Pantalla pública de activación en `public-web` (`features/activation/`),
      shell SUPER_ADMIN en `console` (`/admin/**` + `roleGuard`), ajustes de rutas.
      _Verificación:_ E2E `apps/e2e/tests/public-web/activation.spec.ts` y
      `console/tenants-admin.spec.ts` pasan; el guard bloquea roles no autorizados.

- [ ] **T8 — Cierre.** `pnpm check` en verde; marcar los criterios de aceptación de
      `spec.md`; `docs/db/mapit.dbml` actualizado en el mismo commit; PR con
      descripción completa.
      _Verificación:_ todo en verde local + CI.

## Notas de ejecución

- **2026-09-14 (specs adelantadas):** el shell de administración (`/admin/**`),
  el `roleGuard` y el CRUD de tenants se anticiparon a CU-03 y quedan registrados
  aquí; hubo que añadir una nota en `specs/CU-01-registro-tenant/spec.md` porque
  ya no era una representación fiel del estado real.
- **2026-09-17 (estructura de ramas):** se aprendió que apilar ramas
  (`MAP-175-rol-mapit-app` → `CU-25`) sobre un `main` que avanzó lo suficiente
  genera conflictos solo en archivos que tocan muchos temas a la vez
  (`SecurityConfig.java`, `app.routes.ts`, `pnpm-lock.yaml`). La política de
  resolución aplicada fue: **unión en backend** (no perder rutas públicas nuevas
  de `main` ni constantes `ApiPaths` del trabajo) y **"main" en frontend puro**,
  regenerando el lockfile tras el merge. El `app.routes.ts` se restauró desde
  el stash para recuperar el shell admin sin descartar las rutas de `floors/sectors`.
- **Corrección pendiente de ambigüedad:** MAP-180 exige que el bootstrap del
  SUPER_ADMIN funcione con `mapit_app` bajo RLS **del tenant técnico `platform`**.
  Eso exige que el mecanismo cross-tenant de MAP-175 esté _verdaderamente_
  definido y probado (`SET LOCAL` por transacción). La definición no se
  postergó, pero la evidencia de que el bootstrap opera bajo ese mecanismo se
  validó solo en las pruebas de `RuntimeRoleIntegrationTest` /
  `TenantAdministrationIntegrationTest` — cualquier refactor del Runner debe
  recorrer el mismo camino documentado.
- **Conflicto conocido y pendiente de discusión:** qué ocurre si el envío del
  email de invitación falla **después** de crear el tenant (compensación vs.
  regeneración de invitación): el ticket no lo explicita; en la implementación
  actual la invitación es una entidad persistida, por lo que es re-generable sin
  rehacer el tenant — confirmar si conviene exponer un endpoint para re-enviar.
