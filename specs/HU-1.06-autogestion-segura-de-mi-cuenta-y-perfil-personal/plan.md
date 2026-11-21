# Plan — HU-1.06 Autogestión segura de mi cuenta y perfil personal

> **Ticket:** MAP-285 · **Primer incremento:** documentación de MAP-287 · **Estado:** diseño inicial; propuestas D01–D07 pendientes según [spec.md](spec.md).

## 1. Enfoque y límites de entrega

Ampliar `identity` y `app_user` para ofrecer una API personal distinta de la gestión administrativa de usuarios. Console tendrá una única feature `my-account`, reutilizada por staff y SUPER_ADMIN. La autorización siempre procede del backend; los guards y la flag controlan navegación/disponibilidad.

En esta etapa se crean solo los tres documentos. No se modifica `openapi.yaml`, código, esquema, autenticación ni flags. Toda implementación de MAP-287/288/289/290/291/314 se hará en la misma rama de MAP-285, con commits pequeños; no se abrirán ramas hijas. La instrucción expresa del solicitante prevalece sobre los ejemplos de ramas apiladas de `CONTRIBUTING.md`.

## 2. Base observada y dependencias

| Área      | Disponible en la base `fd22d78`                                                                                      | Pendiente o conflicto                                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Identidad | `AuthenticatedPrincipal`, `SecurityActorContext`, `SecurityTenantContext`, filtro JWT y puertos de contraseñas.      | No duplicar el endurecimiento global de MAP-238.                                                                                    |
| Usuarios  | `app_user`, onboarding/activación y `UsersController` de MAP-180.                                                    | PR #69 reemplaza/amplía la administración; no editarla para exponer el perfil personal.                                             |
| Tokens    | JWT de acceso, TTL por defecto de 15 minutos, cierre local en `AuthSession`.                                         | `CurrentStaffIdentity`, `JdbcCurrentStaffIdentity`, `staff_tokens_valid_after` y revisión STOMP están en MAP-238, aún sin integrar. |
| Correo    | V32 hace `app_user.email` globalmente único; `/auth/global-login` identifica una cuenta de un tenant.                | No crear membresías ni cambiar correo. La spec implementada de MAP-256 no incluye registro autónomo.                                |
| Datos     | `full_name` ya existe. RLS y runtime `mapit_app`.                                                                    | Añadir contacto/idioma tras D01; el número de migración no se reserva ahora.                                                        |
| Console   | `/admin/profile` es placeholder, `AuthSession` mantiene snapshot de nombre; `StaffShell` depende de establecimiento. | Liberar la ruta personal del contexto operativo y actualizar solo el nombre confirmado de sesión.                                   |
| i18n      | `@mapit/i18n`, `es`, `en`, `ja-JP`, fallback español y almacenamiento local.                                         | Persistencia de idioma por cuenta y precedencia explícita.                                                                          |
| Flags     | `FeatureFlagPort.isEnabledFor`, catálogo Java/TS y bootstrap.                                                        | Generador de dos segmentos; frontend sin contexto tenant al proxy y con retención del último estado al fallar.                      |

[PR #69](https://github.com/GatoCoder282/MapIt/pull/69) verificado abierto/no integrado el 2026-11-21: base `main` en `fd22d78903a5a2697c1fc20a4769a2f254d8e526`, head `20e25e5a5ce34ce1308db8c85c0af78d16a0d8a9`. La rama remota coincide con el head inspeccionado. V34–V39 pertenecen a ese trabajo.

Antes del código, volver a consultar su estado y revisar el diff integrado. Cualquier actualización de esta rama desde `main` requiere una etapa posterior autorizada; esta entrega no hace merge/rebase ni cambia `main`. Si #69 sigue abierto, mantener el trabajo en diseño/contrato y acordar el orden con identidad; no copiar sus commits ni implementar autenticación paralela.

## 3. Patrones de diseño aplicados

| Patrón                        | Dónde                                                                                            | Por qué aquí                                                                                      | Alternativa descartada                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Ports & Adapters / Repository | Puerto personal en `identity-domain`, casos de uso en application y JDBC/REST en infrastructure. | Conserva los límites hexagonales reales y permite probar permisos/reglas sin Spring o PostgreSQL. | Controlador con SQL y reglas mezcladas; application importando infrastructure. |
| MVVM con Angular Signals      | `features/my-account/{ui,model,data}`.                                                           | Estado de carga, borrador y guardado verificable sin lógica de negocio en plantillas.             | Componentes con llamadas HTTP y estado mutable compartido entre usuarios.      |
| Adapter existente             | `PasswordHasher`, `PasswordVerifier`, `FeatureFlagPort`, i18n y cliente API generado.            | Reutiliza políticas y proveedores disponibles sin acoplar dominio a BCrypt/Unleash.               | Otro codificador, cliente Unleash directo o segundo servicio de autenticación. |

No se necesitan Strategy, State, una nueva jerarquía de perfiles ni otra infraestructura de sesiones para editar tres campos. Referencia: [catálogo de patrones](../../docs/architecture/design-patterns.md).

## 4. Contrato primero

Los paths están confirmados por el solicitante; los nombres de DTO/operationId y respuestas siguientes son propuesta D02. Se incorporarán primero a `packages/api-contract/openapi.yaml` y se validarán antes del código. Como `servers` ya contiene `/api/v1`, las claves serán `/me` y `/me/password`.

| Método | Path público          | operationId propuesto | Body/respuesta propuesta                                                                                                 |
| ------ | --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/v1/me`          | `getMyProfile`        | Sin identidad objetivo; `200 PersonalProfile`: `fullName`, `email` de solo lectura, `contactPhone`, `preferredLanguage`. |
| PATCH  | `/api/v1/me`          | `updateMyProfile`     | `UpdateMyProfileRequest`: subconjunto no vacío de campos D01; `200 PersonalProfile` persistido.                          |
| POST   | `/api/v1/me/password` | `changeMyPassword`    | `currentPassword`, `newPassword`, `newPasswordConfirm`, todos write-only; `204` sin credenciales.                        |

Respuestas personales con `Cache-Control: no-store`. Esquemas cerrados (`additionalProperties: false`) más rechazo backend real de campos desconocidos/prohibidos. No reutilizar DTO administrativo ni serializar la fila de credenciales. Mantener email separado de los datos de contacto editables.

| Situación                                                           | Respuesta propuesta                                                                                                                                                     |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payload inválido, prohibido, vacío o contraseña actual incorrecta   | `400 Problem`, con tipo/código estable por definir y sin secretos. No usar `401` para el error de contraseña actual: el interceptor lo interpreta como sesión inválida. |
| JWT ausente, inválido, expirado, revocado o identidad ya no vigente | `401`, según infraestructura de autenticación existente.                                                                                                                |
| Identidad válida sin permiso para la operación                      | `403 Problem`.                                                                                                                                                          |
| Flag deshabilitada tras validar identidad/permisos                  | `404 Problem` con código de función deshabilitada por acordar.                                                                                                          |
| Conflicto concurrente que impide el cambio                          | `409 Problem`; no devolver éxito si no se actualizó la fila.                                                                                                            |
| Presupuesto agotado                                                 | `429 Problem`, `Retry-After`; conservar contadores incluso cuando se rechaza el cambio.                                                                                 |

Los mensajes visibles se localizan por códigos; no depender de comparar texto libre del backend. Decidir también rechazo de query/headers de identidad objetivo: nunca deben influir en la fila seleccionada.

Flujo futuro: editar contrato → `pnpm api:lint` → `pnpm api:gen` → comprobar generación TS real → implementar → `pnpm api:check`. No versionar `generated/`. El generador actual produce TypeScript, no interfaces Java, como aclara `AGENTS.md` raíz.

## 5. Backend y datos — MAP-287

Ubicación base: `apps/backend/modules/identity/`, paquetes `com.mapit.identity`.

| Capa/archivo probable                                                       | Responsabilidad                                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `identity-domain/.../PersonalProfile.java`                                  | Proyección personal sin hash, tokens ni propiedades administrativas.            |
| `identity-domain/.../PersonalProfileRepository.java`                        | Lectura/escritura acotada a tenant y usuario autenticados.                      |
| `identity-application/.../GetOwnProfile.java`                               | Obtener actor/tenant del contexto confiable y consultar el perfil propio.       |
| `identity-application/.../UpdateOwnProfile.java`                            | Validar campos permitidos, identidad vigente y actualización transaccional.     |
| `identity-infrastructure/.../MyAccountController.java`                      | DTOs cerrados, validación HTTP, errores y respuestas sin caché.                 |
| `identity-infrastructure/.../JdbcPersonalProfileRepository.java`            | SQL parametrizado con `tenant_id = ? and id = ?`; columnas explícitas.          |
| `bootstrap/.../db/migration/V<N>__agregar_contacto_e_idioma_a_app_user.sql` | D01: columnas opcionales, límites/checks y compatibilidad con filas existentes. |
| `docs/db/mapit.dbml`                                                        | Mismo cambio conceptual y mismo commit que la migración.                        |

Los nombres son orientativos. Reutilizar `ActorContext`/`TenantContext` o pasar `AuthenticatedPrincipal` reconstruido en el límite REST, según el patrón final de identidad; nunca reconstruirlo del body ni duplicar autoridad con valores del cliente. Mantener autorización de los cuatro roles staff aplicables y estados vigentes conforme a MAP-238. No acceder a tipos Spring desde dominio ni importar otros contextos de negocio.

El adaptador fija `TenantScope.SET_LOCAL_SQL` en la misma transacción, con filtros explícitos por tenant y usuario, e informa si no existe una fila elegible. No usar `findByEmail` ni `app.login_email` para Mi cuenta. Guardar exclusivamente `full_name`, contacto e idioma; no actualizar por mapeo masivo de `app_user`.

Migración expansiva: columnas opcionales para filas existentes, sin nueva tabla de usuarios ni duplicación de RLS. Confirmar siguiente versión después de integrar cambios de compañeros; no tocar V32, V33 ni V34–V39 del PR #69. Si cambiara el diseño y apareciera una tabla nueva, actualizar spec §9, índices, RLS y pruebas antes de crearla.

## 6. Console e i18n — MAP-288/MAP-314

- Crear `apps/console/src/app/features/my-account/data/my-account-api.ts`, `model/my-account-store.ts` y `ui/my-account.{ts,html,scss}`, con pruebas del transporte, ViewModel y bindings relevantes.
- Consumir servicios/modelos desde `@mapit/api-client`; nada de imports profundos ni duplicación de DTOs de contrato.
- En `app.routes.ts`, proponer `/my-account` bajo shell staff y reutilizar la feature en `/admin/profile`. Guards de auth/rol y flag, sin dependencia del establecimiento activo.
- Ajustar `layout/staff-shell.{ts,html}` para que ruta personal no fuerce primer establecimiento ni selector; preservar los controles de las páginas operativas. Coordinar sus cambios con MAP-238.
- Actualizar `layout/admin-shell.ts` y la navegación para reutilizar la misma pantalla. SUPER_ADMIN sigue dentro de `platform`, sin parámetro destino.
- Ampliar `libs/auth/src/lib/auth-session.ts` solo con actualización limitada del nombre confirmado por backend, conservando identidad, rol, token, expiración y elección session/local storage.
- Coordinar preferencia remota y `I18nService` desde Console; no hacer que `i18n` dependa de auth/apps ni introducir autenticación staff en Public Web.
- Añadir textos en `core/strings.ts`, `strings.en.ts`, `strings.ja.ts`, y reutilizar selector, UI kit y tokens existentes.
- Limpiar borradores/contraseñas al cerrar sesión o cambiar identidad; invalidar respuestas tardías; bloquear doble guardado y manejar abandono de borradores sin fingir que cancelar HTTP revierte el servidor.
- Las reglas/medidor de contraseña de `features/login/` solo se reutilizarán después de mover lo compartido a `core/`; no importar una feature desde otra.

## 7. Contraseña y tokens — MAP-289

Implementar solo después de resolver D03/D04/D07 y revisar MAP-238 integrado. Ubicaciones probables: `identity-application/.../ChangeOwnPassword.java`, puerto de credenciales propias en domain, adaptador JDBC, extensión de `MyAccountController` y formulario de la misma feature.

Reutilizar `PasswordPolicy`, `PasswordVerifier`, `PasswordHasher` y el almacenamiento de límites existente. La contraseña actual se verifica contra la cuenta autenticada, sin buscar un correo enviado. Verificar confirmación, composición, límite efectivo UTF-8 de BCrypt y nueva contraseña diferente; no truncar contraseñas.

Con D03, actualizar hash y corte temporal de tokens en una sola transacción; tras commit, devolver éxito sin JWT nuevo y cerrar la sesión local. Reutilizar `staff_tokens_valid_after` y su validación por `CurrentStaffIdentity`, también en STOMP. No crear denylist, refresh tokens ni una segunda columna equivalente.

Antes de aceptar el diseño, demostrar con pruebas la carrera entre lectura/verificación de credenciales, emisión de JWT y cambio de contraseña; también la precisión de `iat` frente al timestamp de PostgreSQL. Si el mecanismo integrado no cubre la carrera, acordar una solución compartida con identidad antes del código, sin afirmar revocación completa por actualizar solo una columna.

Ampliar `AuthAttemptLimiter` con presupuestos de cambio separados, clave de cuenta autenticada/IP y persistencia independiente del rollback del cambio. Fijar límites concretos y política de reset antes del contrato; mantener intactos los presupuestos actuales de login. No confiar en IP reenviada arbitraria ni permitir reiniciar contadores cambiando un email del body.

No reutilizar el rescate excepcional de ADMIN como recuperación general. Si se requiere auditoría adicional, acordar un evento mínimo con identidad/auditoría y sus constraints; no añadir datos sensibles ni una tabla paralela de seguridad por defecto.

## 8. Feature flag y rollback — MAP-291

Registrar `mapit.s6.my-account` OFF en enum Java (`shared-kernel/.../FeatureFlag.java`), catálogo TS (`libs/feature-flags/.../feature-flag.catalog.ts`) y `infra/docker/unleash/flags.json`. Antes, adaptar la validación de `tools/scripts/new-flag.mjs` para claves con más de dos segmentos y probar compatibilidad con las actuales. Tipo, retiro e issue de limpieza de D06 pendientes; no crear otro nombre de flag.

El registro/gate básico debe llegar antes de exponer MAP-287, aunque el cierre completo de rollout sea posterior. Backend usa `FeatureFlagPort.isEnabledFor` con tenant autenticado, incluyendo `platform`; valida identidad y autorización aunque la flag esté OFF. La flag no concede roles ni permisos.

Console proporciona contexto tenant al proxy desde una integración en `core/`, sin dependencia inversa a auth en la lib compartida y sin enviar JWT staff al proxy. Limpiar evaluación al cambiar/cerrar sesión y descartar fetches de un contexto anterior. Resolver estado inicial pendiente para que no muestre la entrada antes de evaluar.

Fallback requerido: flag ausente o sin proveedor configurado → OFF. D06 debe precisar y probar fallo después de una evaluación ON, límite de antigüedad de caché y propagación del OFF tanto frontend como SDK backend. El frontend actual retiene último valor al fallar; no asumir que ya vuelve a OFF ni cambiar el comportamiento de otras flags por implicación.

Rollback futuro:

1. Deshabilitar el toggle en el entorno/tenant acordado y verificar propagación y acceso directo.
2. Ocultar navegación y deshabilitar nuevas operaciones personales; conservar login, activación, usuarios y validación global de JWT.
3. Mantener columnas y perfiles persistidos; no borrar datos, revertir hashes ni reactivar tokens ya revocados.
4. Si se revierte una versión de aplicación, usar una versión compatible con esquema expansivo y validación de tokens; no desplegar una anterior al control de revocación que reacepte JWT antiguos.
5. Reactivar solo después de corregir la causa y repetir pruebas aplicables. No ejecutar migraciones descendentes ni modificar migraciones mergeadas.

## 9. Pruebas y evidencias — MAP-290 transversal

| Nivel               | Cobertura mínima                                                                                                                                                                        | Ubicación probable                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Unitario backend    | Campos, validación PATCH, permisos, política de contraseña y ausencia de actualización tras rechazo.                                                                                    | Tests domain/application de identity.                                   |
| REST/seguridad      | Principal real, JWT inválido/expirado/revocado, cuenta/tenant/rol vigente, payload cerrado, flag OFF/ON y no-store.                                                                     | Tests infrastructure y `bootstrap/src/test/java/com/mapit/identity/`.   |
| PostgreSQL/RLS      | A/B mismo tenant, tenant C, `platform`, runtime real sin bypass, rollback, pool sin fuga y migración con filas anteriores.                                                              | Integración con Testcontainers, siguiendo `RuntimeRoleIntegrationTest`. |
| Concurrencia/tokens | Dos cambios, login en carrera, precisión temporal y JWT previos rechazados; nueva credencial operativa.                                                                                 | Integración de identidad y STOMP existente.                             |
| Frontend            | ViewModel, cargas/errores, payload permitido, aislamiento de respuestas tardías, actualización de nombre/idioma y navegación sin establecimiento.                                       | Console y tests de libs auth/i18n/flags afectadas.                      |
| E2E                 | Flujo real leer → editar → recargar → cambiar contraseña → nuevo login; regresión login/activación/usuarios y reutilización SUPER_ADMIN; cobertura móvil sin duplicar reglas unitarias. | `apps/e2e/tests/console/my-account.spec.ts` y flujos existentes.        |
| Rollout             | Sin configuración, OFF/ON, tenant/contexto, error tras ON, caché y rollback conservando datos y revocación.                                                                             | Tests de flags backend/frontend y ensayo con Unleash.                   |

Comandos para etapas futuras, no ejecutados en esta entrega:

- `pnpm api:lint`, `pnpm api:gen` y comprobación de la generación real antes del frontend.
- `pnpm be:test` (todos los módulos y ArchUnit), tests focalizados cuando corresponda.
- `pnpm fe:test`, `pnpm fe:typecheck`, `pnpm exec ng build console` y builds de regresión aplicables.
- `pnpm be:it` y Playwright aplicable solo con infraestructura autorizada y disponible; no arrancar servicios automáticamente.
- `pnpm api:check`, `pnpm check` antes de cada push futuro; `check` no sustituye integración, E2E ni `api:lint`.

Esta etapa solo requiere revisión documental, Prettier de los tres Markdown, validación de enlaces locales y `git diff --check`. No hay código nuevo que justifique arrancar suites de aplicación.

## 10. Incrementos y commits propuestos

Una rama, un PR final hacia `main`, Squash and Merge posterior. Cada incremento incorpora sus propias pruebas; MAP-290 consolida regresión, no pospone seguridad hasta el final.

| Orden | Subtarea                         | Incremento/commit propuesto                                                                      | Dependencia                                                 |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 0     | MAP-285 / preparación de MAP-287 | `docs(specs): definir autogestion de cuenta (MAP-285)`; solo esta entrega.                       | Revisión de repositorio y Jira.                             |
| 1     | MAP-287                          | Resolver D01/D02 y cerrar contrato de perfil; `feat(contract): definir perfil propio (MAP-287)`. | Revisión funcional y conciliación con MAP-238.              |
| 2     | MAP-291, base temprana           | Commits separados de generador y catálogo OFF/gate.                                              | D06 y contrato de disponibilidad; antes de publicar la API. |
| 3     | MAP-287                          | Migración + DBML en un commit; casos de uso/adaptadores y pruebas en otro.                       | Base actualizada, contrato generado y gate.                 |
| 4     | MAP-288                          | UI/i18n y actualización limitada de sesión en commits separados.                                 | API personal estable.                                       |
| 5     | MAP-289                          | Contrato de contraseña, caso de uso probado y formulario en incrementos separados.               | MAP-238 integrado, D03/D04/D07 resueltas.                   |
| 6     | MAP-314                          | Reutilizar feature para SUPER_ADMIN y probar sus rutas.                                          | API/UI/contraseña y gate.                                   |
| 7     | MAP-290 / MAP-291                | Consolidar regresiones, E2E, rollout y evidencia de rollback.                                    | Incrementos anteriores; stack autorizado.                   |

No se consideran bloqueadas la redacción o revisión de MAP-287 por el PR #69. Sí se condiciona el código que dependa de su autenticación/revocación a su integración y revisión; no ampliar esta etapa para resolverlo.

## 11. Conflictos y coordinación

- MAP-238: `UsersController`, `AuthenticatedPrincipal`, filtro JWT, `SecurityConfig`, STOMP, rutas, shells, strings, contrato, DBML y V34–V39. Usar controlador personal separado y revisar el diff integrado antes de tocar archivos compartidos.
- MAP-256: mantener unicidad global, login y la política especial de lectura por email; no reconstruir el modelo desde la descripción histórica más amplia de Jira.
- MAP-240: mantener códigos de idioma y dependencia unidireccional; no reemplazar la preferencia local global ni cambiar Public Web por efectos de la cuenta staff.
- Migraciones concurrentes: elegir número en el momento de crearlas, sin reservar V34 o V40 en este documento.
- Flags: ampliar tooling y contexto sin renombrar flags existentes ni cambiar sus defaults/fallbacks incidentalmente.
- Administración/recuperación: la API propia no administra a otros ni amplía el rescate de ADMIN; MAP-286 permanece fuera.

## 12. Entrega posterior

PR final con título exacto `HU-1.06 — Autogestión segura de mi cuenta y perfil personal`, trazabilidad MAP-285 y seis subtareas, base `main` y siguiente PR apilado `N/A`. Enlazar estos documentos desde la plantilla, completar criterios con evidencia y adjuntar captura de los checks requeridos del propio PR conforme a [ticket-delivery](../../.agents/skills/ticket-delivery/SKILL.md).

En esta etapa no hay PR ni workflows propios; esa evidencia queda pendiente en `tasks.md`. No afirmar terminación de MAP-285 ni de sus subtareas por completar documentación.
