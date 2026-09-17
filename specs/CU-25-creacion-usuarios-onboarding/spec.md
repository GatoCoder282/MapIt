# CU-25 — Creación de usuarios y onboarding del primer Admin

> **Estado:** En implementación · **Creada:** 2026-09-17 · **Responsable:** Integrante A/E (Matias Moron) · **Ticket:** MAP-180

## Enunciado

Habilitar la creación programática de usuarios staff: bootstrap del SUPER_ADMIN
de plataforma, onboarding del primer ADMIN de cada tenant mediante invitación por
email con token de activación, y creación general de usuarios staff mediante
`POST /api/v1/users`. Hoy el único camino para crear usuarios es un INSERT manual
en la base de datos, lo cual no es aceptable más allá del MVP.

---

## 1. Por qué (contexto)

Existe `POST /api/v1/auth/login` funcional que emite JWT con claims `tenant`,
`role` y `email`, pero no hay forma programática de crear usuarios staff. El
único camino disponible es el INSERT manual en base de datos, lo que impide la
operación real del producto más allá del MVP. La tabla `app_user` ya existe con
roles `SUPER_ADMIN`, `ADMIN`, `STAFF` y `USUARIO_FINAL`, email único por tenant,
`password_hash` BCrypt y RLS con `FORCE ROW LEVEL SECURITY`.

## 2. Actores

| Rol           | Qué hace en este caso de uso                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Super Admin   | Login con `tenantSlug: "platform"`; crea tenants (dispara invitación); crea cualquier rol en cualquier tenant |
| Admin         | Recibe invitación, se activa definiendo su propia contraseña; crea solo STAFF de su propio tenant             |
| Staff         | Nada; recibe 403 si intenta crear usuarios                                                                    |
| Usuario final | Nada; recibe 403 si intenta crear usuarios                                                                    |

## 3. Precondiciones

- **MAP-175 completada:** rol `mapit_app` sin privilegios de superusuario (el
  bootstrap y el onboarding deben funcionar bajo RLS real, sin bypass).
- **CU-23 / CU-24:** JWT y autorización por rol disponibles.
- **CU-01:** registro de tenant, que provee el tenant y dispara la invitación.
- Tabla `app_user` existente con email único por tenant y `password_hash` BCrypt.

## 4. Flujo principal

### 4.1 Bootstrap del SUPER_ADMIN

1. Al arrancar, un `ApplicationRunner` comprueba si existe un `SUPER_ADMIN` (por rol, no por email).
2. Si no existe, `CreateSuperAdminUseCase` lo crea usando `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD`,
   alojado en el tenant técnico `platform` (porque `app_user.tenant_id` es `NOT NULL`).
3. Si falta `SUPER_ADMIN_PASSWORD`, solo se genera aleatoria con `SUPERADMIN_AUTO_GENERATE=true`
   (default `false`); en producción debe fallar claramente.
4. El login del SUPER_ADMIN usa `tenantSlug: "platform"`.

### 4.2 Onboarding del primer ADMIN

1. `POST /api/v1/tenants` (protegido por SUPER_ADMIN) crea el tenant y genera la invitación del primer ADMIN en el mismo flujo transaccional.
2. Se genera un token criptográficamente aleatorio, de un solo uso, con expiración de 24 h, persistido en `invitation_tokens` asociado al tenant y al `administratorEmail`.
3. El email contiene solo el enlace/token de activación: nunca una contraseña temporal ni un JWT.
4. El invitado abre la pantalla pública de activación, define y confirma su contraseña.
5. `POST /api/v1/auth/activate` valida el token vigente, persiste la contraseña como hash BCrypt, activa el usuario como ADMIN y consume el token de forma atómica en la misma transacción.
6. El ADMIN iniciado puede autenticarse con `POST /api/v1/auth/login`.

### 4.3 Creación general de usuarios (`POST /api/v1/users`)

1. Caller autenticado invoca `POST /api/v1/users` con email/rol; el `tenant_id` proviene del claim `tenant` del JWT (nunca del body ni headers), salvo SUPER_ADMIN según el mecanismo cross-tenant autorizado en MAP-175.
2. El caso de uso `CreateUser` valida email único por tenant y aplica la matriz de autorización.
3. Responde `201` con el recurso y sin `password_hash`.

## 5. Flujos alternativos y errores

| Situación                                                   | Comportamiento esperado                                  |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| Token de activación inválido / expirado                     | Rechazo explícito; la cuenta no se crea                  |
| Token reutilizado                                           | Rechazo aunque la primera activación haya sido correcta  |
| Contraseña inválida o no coincidente                        | Rechazo con validación visible; no se activa la cuenta   |
| Email duplicado en el mismo tenant                          | Respuesta `409` (Problem Details)                        |
| STAFF / USUARIO FINAL invoca `POST /users`                  | Respuesta `403`                                          |
| ADMIN intenta crear otro rol o fuera de su tenant           | Respuesta `403`                                          |
| `tenant_id` arbitrario desde body/headers                   | Se ignora/rechaza: el tenant sale solo del claim del JWT |
| Falta `SUPER_ADMIN_PASSWORD` sin auto-generación habilitada | Fallo claro en el arranque                               |
| `POST /api/v1/tenants` sin JWT de SUPER_ADMIN               | `401/403`                                                |

## 6. Reglas de negocio

- **RN-1:** El token de activación es criptográficamente aleatorio, de un solo uso y expira a las 24 h. La activación invalida el token de manera atómica en la misma transacción.
- **RN-2:** Ninguna contraseña circula en claro: persistencia solo en hash BCrypt; los emails nunca contienen contraseña temporal; las respuestas nunca incluyen `password_hash`.
- **RN-3:** Se crea exactamente un SUPER_ADMIN (validación por rol, no por email).
- **RN-4:** El `tenant_id` de un usuario nuevo sale del claim `tenant` del JWT; solo el SUPER_ADMIN puede operar explícitamente cross-tenant mediante el mecanismo autorizado y probado en MAP-175. No hay bypass global de RLS.
- **RN-5:** Matriz de autorización: SUPER_ADMIN crea cualquier rol en cualquier tenant; ADMIN solo STAFF de su propio tenant; STAFF y USUARIO_FINAL no pueden crear usuarios.
- **RN-6:** `POST /api/v1/tenants` queda protegido por autenticación y autorización de SUPER_ADMIN, coherente con HU-1.01.

## 7. Criterios de aceptación

- [ ] **CA-1:** Dado el arranque de la aplicación, cuando no existe ningún SUPER_ADMIN, entonces se crea exactamente uno (rearranques no duplican), y `tenantSlug: "platform"` permite su login con JWT válido.
- [ ] **CA-2:** Dado `POST /api/v1/tenants` sin JWT o con rol no autorizado, cuando se invoca, entonces responde `401/403`; con JWT de SUPER_ADMIN crea el tenant y dispara la invitación del primer ADMIN.
- [ ] **CA-3:** Dado un tenant registrado, cuando se revisa el email enviado, entonces contiene únicamente el enlace/token de activación (24 h, un solo uso, asociado al tenant correcto) y nunca una contraseña temporal.
- [ ] **CA-4:** Dado un token válido, cuando el invitado define y confirma su contraseña, entonces su cuenta queda activa como ADMIN, el token queda consumido en la misma transacción y puede hacer login posterior.
- [ ] **CA-5:** Dado un token inválido, expirado o ya utilizado, cuando se intenta activar, entonces el endpoint lo rechaza y no crea/modifica ninguna cuenta.
- [ ] **CA-6:** Dada una contraseña inválida o no coincidente, cuando se intenta activar, entonces el endpoint lo rechaza sin activar la cuenta.
- [ ] **CA-7:** Dado un ADMIN autenticado, cuando invoca `POST /api/v1/users`, entonces solo puede crear STAFF de su propio tenant; email duplicado responde `409 ProblemDetail` y la respuesta `201` no incluye `password_hash`.
- [ ] **CA-8:** Dado un STAFF o USUARIO FINAL, cuando invoca `POST /api/v1/users`, entonces recibe `403`.
- [ ] **CA-9:** Dado cualquier intento de operación cross-tenant o escalación de rol fuera del mecanismo autorizado de MAP-175, cuando se ejecuta, entonces responde `403` (nunca `201`).
- [ ] **CA-10:** Dado `invitation_tokens` en la BD, cuando se verifica el esquema, entonces tiene `tenant_id NOT NULL`, índice `(tenant_id, id)` y RLS validada por tests de aislamiento; y el seeder funciona con `mapit_app` sin bypass.
- [ ] **CA-11:** Dado el trabajo fusionado, cuando se ejecuta `pnpm be:test`, `pnpm be:it` y `pnpm api:check`, entonces todo queda en verde, y ningún entorno soportado crea usuarios por SQL manual.

## 8. Fuera de alcance

- Envío de contraseñas temporales por email y "forced password change" en primer login (decisión deliberada: el usuario define su contraseña en la activación).
- `PATCH /users/:id` para cambio de rol o desactivación: será una historia posterior de gestión de usuarios.
- El mecanismo cross-tenant de SUPER_ADMIN propiamente diseñado/probado: es responsabilidad previa de MAP-175.

## 9. Impacto multi-tenant

- Tabla nueva `invitation_tokens`: `tenant_id NOT NULL`, índice `(tenant_id, id)`, RLS vía `enable_tenant_isolation()`; test de aislamiento entre tenants obligatorio.
- El SUPER_ADMIN vive en el tenant técnico `platform`: sus operaciones cross-tenant quedan acotadas al mecanismo definido en MAP-175 (sin bypass global de RLS).
- Los tests de aislamiento se ejecutan con el rol real `mapit_app`, demostrando comportamiento fail-closed (query sin `app.tenant_id` → 0 filas) y que el contexto tenant no gotea entre transacciones del pool.

## 10. Requerimientos relacionados

RF16, RF17, RNF09, RNF11 de `docs/roadmap/project_definition.md`. Dependencias: MAP-175, CU-23, CU-24, CU-01; subtasks MAP-182…MAP-187.
