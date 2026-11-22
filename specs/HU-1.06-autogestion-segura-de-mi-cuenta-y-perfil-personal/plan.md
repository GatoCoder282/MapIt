# Plan — HU-1.06 Autogestión segura de mi cuenta y perfil personal

> **Ticket:** MAP-285 · **Incremento actual:** campos completos de MAP-287/MAP-288 sobre MAP-238 integrado · **Estado:** nombre/correo implementados en API y Console; persistencia de contacto/idioma, contraseña y QA con stack pendientes según [spec.md](spec.md).

## 1. Enfoque y límites de entrega

Incremento vigente del 2026-11-22: V40 expansiva y DBML; `PersonalProfileChanges.Field` comparte la presencia entre aplicación y puerto de dominio. GET/PATCH usan JDBC transaccional/RLS y un único UPDATE con CASE por presencia; no se mezclan campos ausentes con una proyección obsoleta ni se trunca texto. Los tres campos editables están conectados y se elimina el rechazo temporal por migración pendiente. Las etapas históricas que describen solo nombre/correo quedan superadas por este incremento; no se implementa contraseña.

Jackson: la aplicación mantiene NON_NULL global. Un módulo/mixin local de infraestructura aplica ALWAYS únicamente a PersonalProfile para garantizar las cuatro claves requeridas incluso sin contacto/idioma, sin anotar el dominio ni afectar otros DTOs. El test del controlador reproduce esa configuración, además de probar el módulo aisladamente.

Console envía solo los campos cambiados, transformando vacío de opcionales en null. Lee respuestas completas del cliente generado y rechaza respuestas antiguas/malformadas sin fabricar nulls. El idioma del perfil se muestra al cargar; se aplica con `I18nService` únicamente después de guardar un cambio de idioma confirmado en la misma revisión de sesión, si el idioma local coincide todavía con el capturado al enviar. Limpiar la preferencia no modifica el idioma local. No se cambia AuthSession/JWT ni el selector global, ni se guardan teléfonos en storage. Se preservan las rutas compartidas de staff/SUPER_ADMIN y los gates existentes OFF.

Próxima aceptación: aplicar V40 y ejecutar PostgreSQL/RLS e integración/E2E con infraestructura autorizada antes de rollout. Rollback mediante OFF y código previo que ignora las columnas, sin borrarlas ni revertir V40. MAP-289 continúa pendiente de escritura segura/revocación efectiva probada; MAP-238 integrado no sustituye ese trabajo.

Ampliar `identity` y `app_user` para ofrecer una API personal distinta de la gestión administrativa de usuarios. Console tendrá una única feature `my-account`, reutilizada por staff y SUPER_ADMIN. La autorización siempre procede del backend; los guards y la flag controlan navegación/disponibilidad.

La etapa inicial `0d11dfa` creó solo los tres documentos. La siguiente etapa autorizada añade OpenAPI y registro OFF de la flag con pruebas; no modifica esquema, autenticación ni controladores. Toda implementación de MAP-287/288/289/290/291/314 se hará en la misma rama de MAP-285, con commits pequeños; no se abrirán ramas hijas. La instrucción expresa del solicitante prevalece sobre los ejemplos de ramas apiladas de `CONTRIBUTING.md`.

## 2. Base observada y dependencias

Base actualizada el 2026-11-22: #69 fusionado y disponible en `origin/main` (`c0de5d7`). Se conserva autenticación/revalidación HTTP/STOMP de MAP-238 sin cambios, incluyendo `issuedAt` y V34–V39. El fixture de seguridad de Mi cuenta usa el filtro nuevo con `CurrentStaffIdentity` de test y fechas de emisión explícitas; identidades rechazadas responden 401 antes del controlador, independientemente del flag. Se conservan las rutas/permisos administrativos y el acceso personal sin establecimiento. La tabla y comprobaciones fechadas abajo registran la base histórica.

Siguiente MAP-287: elegir entonces una migración libre posterior a las integradas, añadir columnas opcionales/constraints y DBML, conectar JDBC/aplicación/contrato/UI y ejecutar PostgreSQL/RLS antes de retirar 503. Siguiente MAP-289: reutilizar corte de tokens en una escritura atómica con hash, resolver precisión `iat` en segundos frente al corte TIMESTAMPTZ, carreras con login, limitación de intentos y reautenticación con verificación HTTP/STOMP. No se declara que integrar MAP-238 resuelva esas decisiones o cierre las subtareas.

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

Los paths están confirmados por el solicitante; los nombres de DTO/operationId y respuestas siguientes concretan D02 en el incremento de contrato, antes del código. Como `servers` ya contiene `/api/v1`, las claves son `/me` y `/me/password`. Las tres operaciones llevan `x-implementation-status: planned` y `x-feature-flag: mapit.s6.my-account`; no describen controladores ya disponibles. Contraseña exige la implementación y pruebas de MAP-238 antes de habilitarse.

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

Incremento compatible con la base anterior a MAP-238: `PersonalProfile` proyecta solo `fullName/email`; `PersonalProfileRepository` lee/actualiza únicamente la fila elegible del principal. `OwnProfileService` implementa los dos casos de uso transaccionales, valida pertenencia de SUPER_ADMIN a `platform`, cuenta/tenant activos y rol persistido coincidente antes de evaluar la flag por tenant. Estos filtros son elegibilidad de la fila personal; no son una copia de la validación/revocación global de MAP-238.

El adaptador JDBC exige una transacción y usa SET LOCAL más filtros de tenant/usuario/rol/estado. UPDATE solo escribe `full_name` y devuelve `RETURNING full_name,email`. REST omite campos sin almacenamiento y rechaza su escritura con `503 profile-fields-unavailable` antes de cualquier actualización. OpenAPI documenta esta transición, manteniendo `fullName/email` obligatorios y contacto/idioma opcionales en respuesta. Cuando se integre MAP-238, definir la migración expansiva real, ampliar proyección/repositorio y ejecutar integración/RLS antes de completar la historia; ningún número se reserva en esta rama.

Ubicación base: `apps/backend/modules/identity/`, paquetes `com.mapit.identity`.

| Capa/archivo probable                                                       | Responsabilidad                                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `identity-domain/.../PersonalProfile.java`                                  | Proyección personal sin hash, tokens ni propiedades administrativas.            |
| `identity-domain/.../PersonalProfileRepository.java`                        | Lectura/escritura acotada a tenant y usuario autenticados.                      |
| `identity-application/.../OwnProfileService.java` (`read`)                  | Consultar el perfil del principal validado con transacción de lectura.          |
| `identity-application/.../OwnProfileService.java` (`updateFullName`)        | Validar nombre, elegibilidad y actualización transaccional de la fila propia.   |
| `identity-infrastructure/.../MyAccountController.java`                      | DTOs cerrados, validación HTTP, errores y respuestas sin caché.                 |
| `identity-infrastructure/.../JdbcPersonalProfileRepository.java`            | SQL parametrizado con `tenant_id = ? and id = ?`; columnas explícitas.          |
| `bootstrap/.../db/migration/V<N>__agregar_contacto_e_idioma_a_app_user.sql` | D01: columnas opcionales, límites/checks y compatibilidad con filas existentes. |
| `docs/db/mapit.dbml`                                                        | Mismo cambio conceptual y mismo commit que la migración.                        |

Los nombres son orientativos. Reutilizar `ActorContext`/`TenantContext` o pasar `AuthenticatedPrincipal` reconstruido en el límite REST, según el patrón final de identidad; nunca reconstruirlo del body ni duplicar autoridad con valores del cliente. Mantener autorización de los cuatro roles staff aplicables y estados vigentes conforme a MAP-238. No acceder a tipos Spring desde dominio ni importar otros contextos de negocio.

El adaptador fija `TenantScope.SET_LOCAL_SQL` en la misma transacción, con filtros explícitos por tenant y usuario, e informa si no existe una fila elegible. No usar `findByEmail` ni `app.login_email` para Mi cuenta. Guardar exclusivamente `full_name`, contacto e idioma; no actualizar por mapeo masivo de `app_user`.

Migración expansiva: columnas opcionales para filas existentes, sin nueva tabla de usuarios ni duplicación de RLS. Confirmar siguiente versión después de integrar cambios de compañeros; no tocar V32, V33 ni V34–V39 del PR #69. Si cambiara el diseño y apareciera una tabla nueva, actualizar spec §9, índices, RLS y pruebas antes de crearla.

Preparación independiente de PATCH posterior a los 17 commits: `OwnProfilePatch` en application conserva presencia/valor/null y valida el comando completo; `OwnProfilePatchPayload` en infraestructura valida claves/tipos antes de construirlo. Reutiliza la validación de nombre existente. El controlador consume el comando, pero mantiene GET sin campos ficticios y 503 para cualquier teléfono/idioma presente, incluido null o cuerpo mixto, antes de escribir nombre. La conexión JDBC/migración se mantiene pendiente; no cambia OpenAPI ni se activa UI.

## 6. Console e i18n — MAP-288/MAP-314

Incremento ejecutado: UI de nombre y correo, con `MyAccountAccess` compartido por guard, navegación y ViewModel. La evaluación inicial de la flag es contextual por tenant y OFF hasta respuesta válida; cada revisión de sesión destruye la evaluación anterior. Un fallo posterior apaga solo esta evaluación, sin cambiar la política global de otros flags. `AuthSession.revision` también evita que las respuestas de perfil de una sesión anterior modifiquen la nueva; actualizar el nombre no incrementa esa revisión. `EstablishmentContext` usa esta revisión y los datos de identidad, conservando la selección operativa al editar el nombre. No se muestran contacto ni idioma editables: el selector existente conserva únicamente su preferencia local. Las tareas siguientes describen también el alcance futuro aún pendiente de almacenamiento y contraseña.

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

### 7.1 Operación conectada tras integrar MAP-238

POST /api/v1/me/password reutiliza el actor confiable de MyAccountController y el lector cerrado OwnPasswordChangePayload. ChangeOwnPassword comprueba elegibilidad y flag contextual mediante OwnProfileService, consume el presupuesto existente independiente (5/cuenta-tenant, 20/dirección real, 900 s; REQUIRES_NEW) y llama a CommitOwnPasswordChange en otra transacción. No utiliza contadores de login ni X-Forwarded-For. Los fallos semánticos consumen presupuesto aunque la escritura revierta.

El escritor obtiene la fila propia activa con SELECT FOR UPDATE, tenant/id/rol explícitos y SET LOCAL bajo mapit_app/RLS. Después de esperar el bloqueo revalida cuenta/tenant/rol e issuedAt estrictamente posterior al corte vigente, y vuelve a comprobar elegibilidad/flag. OwnPasswordChangeValidator verifica la contraseña actual, política efectiva, UTF-8 válido hasta 72 bytes, confirmación y no reutilización antes de PasswordHasher. Una sola sentencia con CAS del hash actual cambia password_hash y staff_tokens_valid_after = greatest(corte previo, clock_timestamp(), iat del actor). El 204/no-store solo se produce después del commit. No escribe identidad, roles, membresías, email ni perfil, ni emite JWT nuevo.

No hay denylist, refresh tokens ni revocación paralela. JdbcCurrentStaffIdentity, JwtAuthenticationFilter y RealtimeStompInterceptor de MAP-238 conservan su semántica. Los errores de validación son 400 genéricos; identidad no vigente 401, flag OFF 404, límite 429/Retry-After y fallo de persistencia/commit 503 sin secretos ni confirmación de éxito. Tras un resultado de red incierto se debe autenticar de nuevo antes de reintentar; cancelar HTTP no revierte una transacción aceptada.

### 7.2 Login concurrente y precisión temporal

OpenStaffSession mantiene una transacción desde la lectura/verificación de credenciales hasta la firma. JdbcUserCredentialsRepository conserva la búsqueda por correo normalizado bajo la excepción RLS de login, deriva el tenant desde esa fila, limpia login_email, fija SET LOCAL del tenant real y relee la misma cuenta con FOR UPDATE. Solo entonces obtiene clock_timestamp() en PostgreSQL. BCrypt valida el hash releído, no el descubierto antes de esperar. El bloqueo se mantiene hasta finalizar la firma y el commit.

Si login obtiene el bloqueo primero, su token queda firmado antes del cambio y el corte posterior lo revoca. Si el cambio obtiene el bloqueo primero, login relee el hash nuevo y rechaza la contraseña anterior. Dos cambios concurrentes no pueden reutilizar un principal cuyo corte ya fue actualizado.

El iat continúa expresado en segundos enteros y la revocación exige iat > staff_tokens_valid_after sin tolerancias. Si floor(hora DB) <= corte, el login falla cerrado con 503, Retry-After: 1 y no-store, sin JWT. JjwtTokenService también rechaza emitir con un iat futuro respecto al reloj verificador o ya expirado; no adelanta fechas artificialmente. El login acepta el siguiente segundo seguro. Los relojes de BD y JVM de todas las réplicas deben estar sincronizados y no retroceder: supervisar NTP y desfase; un desfase que no supera esta barrera afecta disponibilidad y no se solventa relajando revocación.

### 7.3 UI y verificación pendiente

PasswordChangeForm se monta dentro de la misma pantalla Mi cuenta para staff y SUPER_ADMIN, detrás del gate existente. Usa MyAccountApi y el cliente generado real. PasswordChangeStore bloquea duplicados/navegación durante el envío, limpia los tres secretos al enviar/error/cambio de ámbito/destrucción y usa mensajes es/en/ja-JP. El 204 de la misma revisión/ámbito cierra AuthSession con clearIfCurrent del token capturado; una respuesta de otra sesión no cierra la nueva. No persiste contraseñas ni emite secretos por outputs. Las cadenas en memoria no ofrecen borrado criptográfico y el gestor de contraseñas del navegador queda fuera del almacenamiento de la app.

Las pruebas locales cubren validación, orquestación, SQL parametrizado/atómico, precisión, lector vigente compartido, cadena HTTP en memoria, consumidor STOMP existente, cliente y UI. OwnPasswordPersistenceIntegrationTest prepara PostgreSQL17/Flyway/mapit_app real con rollback, aislamiento, cuotas y las dos carreras de bloqueo observando pg_stat_activity. CurrentStaffSecurityIntegrationTest añade el cambio HTTP real y un socket ya suscrito antes/después del corte; su helper de login contempla la barrera 503. Estos tests solo están compilados, NO ejecutados sin infraestructura. La ejecución de PostgreSQL/RLS, HTTP/STOMP y E2E sigue siendo requisito para cerrar MAP-289/MAP-285 y activar el rollout; flag OFF por defecto sin cambios.

## 8. Feature flag y rollback — MAP-291

Auditoría MAP-291 posterior a MAP-288: registro, gate de GET/PATCH y contexto frontend ya implementados. Se completó el control del ON cacheado del backend: `MyAccountFlagAvailability`, consumido solo por esta clave, observa los callbacks del SDK 11.0.2 y mantiene OFF al iniciar/fallar/caducar. No altera estrategias ni autorización. El SDK notifica `togglesFetched(CHANGED)` antes de aplicar el estado; se espera `featuresBackedUp` posterior a la aplicación y se renueva por NOT_CHANGED/304 solo si se confirmó previamente ese snapshot. Un backup restaurado no habilita. Un fallo al aplicar/respaldar un snapshot nuevo lo deja sin confirmar: un 304 posterior tampoco lo valida. El logging anterior se conserva por delegación.

Registro verificado: `mapit.s6.my-account`, Java `MAPIT_S6_MY_ACCOUNT`, TS y `infra/docker/unleash/flags.json`, una entrada/OFF, tipo release y retiro previsto `2027-02-21`. Generador ya compatible con varios segmentos y LF/CRLF; no se regenera ni duplica. Falta verificar el estado remoto y asociar un issue específico de limpieza antes del rollout; no se inventa ni crea uno. Fecha versionada no equivale a apagado/archivo automático en Unleash: el seed no transmite esa metadata.

El adaptador backend requiere `isEnabledFor` con tenant explícito para Mi cuenta; las variantes sin tenant y los fallbacks explícitos ON no la habilitan. Sin proveedor configurado permanece OFF. GET/PATCH reutilizan identidad JWT y elegibilidad de la cuenta antes del gate, sin cachear decisiones por usuario/sesión. Las demás flags conservan su evaluación y fallback previos.

El registro/gate básico debe llegar antes de exponer MAP-287, aunque el cierre completo de rollout sea posterior. Backend usa `FeatureFlagPort.isEnabledFor` con tenant autenticado, incluyendo `platform`; valida identidad y autorización aunque la flag esté OFF. La flag no concede roles ni permisos.

Console proporciona contexto tenant al proxy desde una integración en `core/`, sin dependencia inversa a auth en la lib compartida y sin enviar JWT staff al proxy. Limpiar evaluación al cambiar/cerrar sesión y descartar fetches de un contexto anterior. Resolver estado inicial pendiente para que no muestre la entrada antes de evaluar.

Fallback local implementado: flag ausente o sin proveedor → OFF. El watcher contextual frontend apaga ante fallo, respuesta inválida o timeout; su ciclo global sigue reteniendo valores anteriores para las otras flags. Las pruebas separan estas políticas. La evaluación por tenant/sesión y el gate son disponibilidad, nunca autorización ni verificación de firma JWT.

Procedimiento básico, a ejecutar únicamente con infraestructura autorizada:

1. Deshabilitar el toggle en el entorno/tenant acordado y verificar propagación y acceso directo.
2. Ocultar navegación y deshabilitar nuevas operaciones personales; conservar login, activación, usuarios y validación global de JWT.
3. Mantener columnas y perfiles persistidos; no borrar datos, revertir hashes ni reactivar tokens ya revocados.
4. Si se revierte una versión de aplicación, usar una versión compatible con esquema expansivo y validación de tokens; no desplegar una anterior al control de revocación que reacepte JWT antiguos.
5. Reactivar solo después de corregir la causa y repetir pruebas aplicables. No ejecutar migraciones descendentes ni modificar migraciones mergeadas.

### 8.1 Caché, propagación y límites comprobables

| Capa                | Comportamiento implementado                                                                                                                                                                                                   | Límite / pendiente                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend             | Snapshot confirmado por red/aplicación; caduca a los 30 s desde última confirmación con reloj monotónico. UNAVAILABLE/error del SDK cierra inmediatamente al observarse. Cada solicitud vuelve a comprobar frescura y tenant. | El SDK 11.0.2 sondea por defecto cada 15 s; puede aplicar backoff. No es una promesa de propagación instantánea desde la UI de Unleash. Sin callbacks nuevos la siguiente solicitud falla cerrada a los 30 s. No cancela operaciones ya autorizadas.                                                                                                                            |
| Frontend contextual | OFF inicial y al cambiar revisión/usuario/tenant/rol; nuevo fetch sin heredar ON global. Destrucción aborta y descarta respuestas tardías.                                                                                    | Intervalo por defecto 15 s y timeout `min(5 s, intervalo)`: con temporizadores activos, un sondeo bloqueado cierra como máximo un intervalo + timeout desde su última respuesta. Las pestañas suspendidas pueden demorar temporizadores; backend sigue siendo obligatorio.                                                                                                      |
| Unleash Proxy       | El navegador solo recibe evaluaciones por `properties[tenantId]` y usa clave pública de proxy, nunca JWT ni token admin.                                                                                                      | Un proxy vivo puede responder HTTP 200 con su propia caché ON aunque haya caído el upstream. El navegador no recibe metadata de frescura upstream. Medir y validar este caso con la versión real del proxy antes de prometer ocultamiento por caída del servidor. La caducidad backend impide nuevas lecturas/escrituras propias aunque persista temporalmente el enlace en UI. |

No se presenta el timeout frontend como SLA de extremo a extremo ni como sustituto del gate backend. Un problema al respaldar/aplicar el snapshot deja Mi cuenta OFF de forma conservadora; para recuperar, corregir el error y verificar un nuevo snapshot CHANGED aplicado/respaldado. Un 304 solo renueva un snapshot ya confirmado, no uno que falló.

### 8.2 Runbook selectivo OFF / rollback

1. Registrar responsable, incidente, hora, versión desplegada, proyecto y entorno efectivos, estado y estrategias actuales de **esta única clave**. Confirmar que backend y proxy usan credenciales del mismo proyecto/entorno; localmente el seed usa proyecto `default` y entorno `UNLEASH_ENVIRONMENT` (default `development`). No registrar secretos, JWT ni cuerpos personales en evidencias.
2. En la consola administrativa de Unleash, abrir `mapit.s6.my-account` y el entorno confirmado; desactivar **ese entorno**. Para emergencia usar OFF del entorno completo. Si el rollback es solo de tenant, retirar su autorización de todas las estrategias/segmentos aplicables: las estrategias pueden combinarse por OR. Si no puede verificarse la exclusión, usar OFF del entorno, no improvisar una estrategia adicional.
3. Verificar propagación en sesiones de A/B del tenant afectado, C de otro tenant y SUPER_ADMIN/`platform` cuando corresponda: entrada ausente, `/my-account` redirige a `/home`, `/admin/profile` a `/admin/dashboard`; sin sesión redirige a login. Una pantalla ya abierta retira el formulario al recibir OFF. Un staff de negocio no puede usar el shell admin con ON ni OFF.
4. Con JWT válido y actor elegible, comprobar GET `/api/v1/me` y PATCH válido de nombre: OFF → 404 `my-account-disabled`, `Cache-Control: no-store`, sin escritura nueva. JWT ausente/alterado/expirado → 401, combinación rol/tenant prohibida → 403, independientemente del toggle. No usar un token ajeno ni exponerlo en logs/historial de comandos.
5. Conservar filas, nombre persistido, credenciales y esquema. Una operación autorizada antes del OFF puede haber terminado aunque el navegador cancelara HTTP; comprobar el valor real por GET después de recuperar y no reenviar un borrador antiguo automáticamente. No borrar datos, revertir migraciones, resetear volúmenes, cambiar roles ni tocar hashes/JWT/sesiones para apagar esta función.
6. Verificar en el entorno de QA que login/logout, reservas, pagos, usuarios y STOMP siguen su comportamiento previo. El toggle no los controla; no alterar otras flags para resolver un fallo de Mi cuenta. Registrar resultados y tiempos observados, sin incluir datos personales.

No usar `pnpm db:seed:flags`, `setup` ni una edición del JSON bootstrap como rollback en caliente: el seed recorre todas las flags, añade estrategias y reimpone defaults; el JSON no modifica Unleash remoto por sí solo. Tampoco apagar globalmente `mapit.unleash.enabled` como procedimiento selectivo, pues cambia el proveedor para otros módulos.

### 8.3 Comprobación ON y recuperación

1. Mantener OFF hasta resolver la causa y aprobar alcance de prueba. Guardar la configuración previa. Para piloto, configurar en el entorno elegido restricciones de `tenantId` con allowlist explícita; comprobar que ninguna estrategia sin restricción habilite a todos. Incluir `platform` solo si se autoriza probar SUPER_ADMIN. El registro de contexto/estrategias real se valida en Unleash, no se presupone por el JSON local.
2. Habilitar solo la clave/entorno previstos. Esperar snapshot backend confirmado y evaluación contextual frontend válida. Si hay error de backup del SDK, corregirlo y obtener un snapshot nuevo confirmado; no forzar fallbacks true ni borrar caches indiscriminadamente.
3. Verificar lectura propia, PATCH de nombre y relectura persistida; A no puede seleccionar B/C mediante query/body/header. Correo continúa readonly. Cambiar cuenta/tenant y repetir: no debe aparecer perfil/borrador ni respuesta previa. Comprobar ambas rutas y roles, con y sin establecimiento.
4. Simular por separado caída del proxy, caída del servidor upstream, respuestas inválidas y timeout; medir recuperación ON → OFF/fallo → ON. Tras recuperar, cargar perfil fresco y no reutilizar borradores descartados ni declarar éxito de solicitudes previas. Los JWT/credenciales y negocio existente no se modifican por el ciclo.
5. Restaurar la configuración **capturada** del entorno de QA y confirmar finalmente OFF por defecto para este trabajo. Guardar evidencia de clave, entorno, restricciones, matriz de resultados y tiempos; no habilitar rollout general sin QA. Asociar issue de retirada y revisar la fecha prevista antes de producción.

### 8.4 Evidencia pendiente de infraestructura

No ejecutados ahora: estado de la flag remota, versión/configuración efectiva de servidor/proxy, restricciones/segmentos por tenant, caché upstream del proxy, latencia real y backoff, fallo de red real, persistencia/RLS en PostgreSQL, E2E/teclado/móvil y regresión de negocio con stack. Las pruebas unitarias de mocks/callbacks prueban la política local, no esas integraciones. CA-07/CA-12 y cierre MAP-291 siguen abiertos hasta completar esa evidencia; no se marca Listo sin QA según Jira.

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

La etapa inicial solo requirió revisión documental. El incremento backend se valida con unitarios de identidad, REST en memoria, pruebas de la cadena de seguridad sin servidor y ArchUnit; integración PostgreSQL/RLS y E2E quedan pendientes porque no se autoriza arrancar infraestructura ni aplicación.

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
