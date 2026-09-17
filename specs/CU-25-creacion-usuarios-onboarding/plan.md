# CU-25 — Plan técnico

> Se escribe **después** de que `spec.md` está aprobada, y **antes** de tocar código.

## 1. Enfoque

El CU se divide en tres entregas encadenadas, todas sobre el módulo `identity`
(con apoyo de `platform` y `shared-kernel`):

1. **Contrato primero (MAP-182).** Se edita `packages/api-contract/openapi.yaml`
   con `POST /api/v1/auth/activate` y `POST /api/v1/users`, se corre
   `pnpm api:gen`, y se crea la migración de `invitation_tokens`.
2. **Flujo de onboarding (MAP-183…MAP-185).** `POST /api/v1/tenants` protegido
   por SUPER_ADMIN genera la invitación en la misma transacción; el endpoint de
   activación valida el token y crea/activa al ADMIN de forma atómica; luego
   `POST /api/v1/users` con la matriz de autorización por rol.
3. **Frontend + E2E (MAP-186…MAP-187).** Pantalla pública de activación en
   `public-web` y validación end-to-end del flujo completo bajo `mapit_app`
   (sin bypass RLS), incluido el bootstrap idempotente del SUPER_ADMIN.

Se eligió el camino **invitación con token de un solo uso** en lugar de
"contraseña temporal + cambio forzado": elimina de raíz el envío de secretos por
email y reduce la cantidad de estados intermedios del usuario.

## 2. Patrones de diseño aplicados

| Patrón                             | Dónde                                                                                                                                      | Por qué aquí                                                                                               | Alternativa descartada                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Ports & Adapters (Hexagonal)       | `InvitationTokenStore` / `PasswordHasher` / `AdminInvitationEmailPort` en `identity-domain`; adaptadores JDBC/BCrypt en `*-infrastructure` | El dominio define contratos puros; permite testear reglas de negocio sin Spring ni BD real.                | Acoplar dominio directo a JPA/JdbcTemplate: rompería la regla "dominio sin frameworks". |
| Use Case (Application Service)     | `CreateSuperAdminUseCase`, `ActivateAdmin`, `CreateUser`                                                                                   | Un servicio transaccional por comando, orquestando puertos; mantiene las reglas fuera de los controllers.  | Lógica en el controller: duplicaría validaciones y dificultaría el testing.             |
| Token criptográfico de un solo uso | `SecureTokenGenerator` + tabla `invitation_tokens`                                                                                         | El token es un secreto independiente del JWT; caduca, se consume atómicamente y es verificable en BD.      | Reutilizar el JWT como token de activación: acoplaría validez temporales y revocación.  |
| Idempotent Bootstrap               | `ApplicationRunner` validando **por rol** (no por email)                                                                                   | Permite cambiar el email sin duplicar el super-admin; arranques repetidos son seguros.                     | Constraint por email: impediría rotar la credencial inicial.                            |
| Tenant técnico `platform`          | Migración V6 + contexto de bootstrap                                                                                                       | Resuelve el `NOT NULL` de `app_user.tenant_id` para el SUPER_ADMIN sin violar el modelo multi-tenant.      | Hacer nullable la columna: debilitaría la garantía global del modelo.                   |
| Mecanismo cross-tenant explícito   | `TenantScope` / contexto de actor (definido en MAP-175)                                                                                    | SUPER_ADMIN opera cross-tenant de forma controlada y probada; el rol `mapit_app` nunca obtiene bypass RLS. | Bypass global de RLS: rompería el aislamiento que MAP-175 viene a garantizar.           |

## 3. Cambios en el contrato API

- [x] ¿Hay endpoints nuevos o modificados? → editar `packages/api-contract/openapi.yaml` **primero**
- [x] `pnpm api:gen` tras cada cambio del contrato

| Método | Ruta                    | Descripción                                                                                                            |
| ------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/auth/activate` | Activa al primer ADMIN con token de invitación + nueva contraseña (token válido/expirado/inválido/reutilizado).        |
| POST   | `/api/v1/users`         | Crea un usuario staff; el tenant sale del claim `tenant` del JWT; `409` si email duplicado; `201` sin `password_hash`. |

## 4. Backend

**Módulo(s):** `identity` (principal), `platform` (invitación en registro de tenant), `shared-kernel` (`TenantScope`, `ApiPaths`).

| Capa                          | Qué se añade                                                                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity-domain`             | `ActivationExceptions`, `AppUserCreator`, `InvitationTokenStore`, `PasswordHasher`, `StoredInvitation`, `TenantDirectory` (puertos y reglas puras)                                                  |
| `identity-application`        | `ActivateAdmin`, `CreateUser`, `PasswordPolicy`, `CreateSuperAdminUseCase`                                                                                                                          |
| `identity-infrastructure`     | `ActivationController`, `UsersController`, `BCryptPasswordHasher`, `JdbcAdminOnboardingAdapter`, `SuperAdminBootstrap`, `LoginProblemTypes`, ajustes en `LoginController`/`JwtAuthenticationFilter` |
| `platform`-application/domain | `SecureTokenGenerator`, flujo de invitación en registro de tenant, `AdminInvitationEmailPort`                                                                                                       |
| `platform-infrastructure`     | `AdminInvitationEmailAdapter`, `JdbcInvitationTokenRepository`                                                                                                                                      |
| `bootstrap`                   | `SecurityConfig` (rutas públicas + `hasRole(SUPER_ADMIN)` en tenants), `TenantIdentifierConfiguration`                                                                                              |
| `shared-kernel`               | `TenantScope`, `ApiPaths`                                                                                                                                                                           |

## 5. Base de datos

- [x] Migración necesaria → `pnpm db:new`
  - `V6__tenant_tecnico_platform.sql` — tenant técnico `platform`
  - `V7__rol_runtime_mapit_app.sql` — rol runtime sin superuser/bypass RLS (MAP-175)
  - `V8__crear_tabla_invitation_tokens.sql` — tabla de invitaciones
- [x] `tenant_id NOT NULL` + índice `(tenant_id, id)` + `enable_tenant_isolation()` en `invitation_tokens`
- [x] `docs/db/mapit.dbml` actualizado en el **mismo** commit

## 6. Frontend

**App:** `console` → **Feature:** `administration/` (shell SUPER_ADMIN) · `public-web` → **Feature:** `activation/`

| Parte                   | Qué se añade                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `console` shell         | `layout/` (AdminShell, placeholder), `roleGuard(SUPER_ADMIN)`, rutas `/admin/**`                                                 |
| `console` tenants       | `features/administration/tenants/` + dashboard + registro adaptado al shell                                                      |
| `public-web` activation | `features/activation/` (pantalla pública: definir y confirmar contraseña, estados de token válido/expirado/inválido/reutilizado) |
| `libs/auth`             | `role-guard`, ajustes en `auth-session` (`tenantSlug`, claims)                                                                   |

## 7. Feature toggle

- No aplica: no hay flags nuevas en este CU. La protección es autenticación/autorización.

## 8. Testing

| Nivel              | Qué se prueba                                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (dominio)     | Reglas de `PasswordPolicy`, validación de tokens y consumo                                                                                                                                                 |
| Integración        | `RuntimeRoleIntegrationTest` (MAP-175); `SuperAdminBootstrapTest`; `AdminActivationIntegrationTest`; `UserCreationIntegrationTest`; `TenantAdministrationIntegrationTest`                                  |
| Aislamiento tenant | `DemoItemIsolationIntegrationTest`, `EstablishmentIsolationIntegrationTest`, `TenantApiIntegrationTest`, `AuthenticationIntegrationTest` actualizados al rol real `mapit_app` y comportamiento fail-closed |
| Frontend           | Specs del store de tenant-registration y pasos de login; ruta con guard                                                                                                                                    |
| E2E                | `apps/e2e/tests/public-web/activation.spec.ts`, `apps/e2e/tests/console/tenants-admin.spec.ts`                                                                                                             |

## 9. Riesgos

| Riesgo                                                                                    | Mitigación                                                                                                                                                  |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El cambio del rol de runtime (MAP-175) rompe endpoints que dependían del bypass implícito | Despliegue en dos pasos (primero crear rol/privilegios, luego apuntar el datasource); `pnpm be:it` + E2E completos antes de merge                           |
| La definición del mecanismo cross-tenant de SUPER_ADMIN queda pendiente                   | GATE explicitado en MAP-175: no se cierra CU-25 sin que el mecanismo esté definido, documentado y probado (`SET LOCAL` por transacción, no `SET` de sesión) |
| El email de invitación falla tras crear el tenant                                         | Decisión explícita a documentar en ejecución: compensación o re-generación de invitación; el token queda asociado al tenant                                 |
| Fuga de contexto tenant entre conexiones del pool                                         | Test dedicado de `SET LOCAL` por transacción; RLS fail-closed demuestra el comportamiento por omisión                                                       |
| Subtasks secuenciadas incorrectamente (MAP-186 antes del contrato)                        | Vínculos _blocked by_ entre MAP-182→183/184/185→186→187 en Jira                                                                                             |
