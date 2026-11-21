# Tareas — HU-1.06 Autogestión segura de mi cuenta y perfil personal

> **Historia:** [MAP-285](https://matiasmv2005.atlassian.net/browse/MAP-285) · **Estado:** backend parcial de nombre/correo, flag OFF; contacto/idioma y aceptación funcional pendientes.

## 1. Preparación documental de MAP-287 — etapa actual

- [x] Leer `AGENTS.md`, `specs/AGENTS.md`, convenciones de CONTRIBUTING, plantilla de PR y skill `ticket-delivery`; contrastar formatos de historias existentes.
- [x] Revisar instrucciones backend/Console/contrato/libs y catálogo de patrones para documentar una solución compatible con el proyecto.
- [x] Consultar Jira MAP-285 y las seis subtareas; distinguir requisitos confirmados, instrucciones del solicitante y propuestas D01–D07.
- [x] Comprobar árbol limpio, rama actual `main` y sincronización inicial con referencias locales.
- [x] Actualizar referencias con `git fetch --no-tags origin`; confirmar `main` y `origin/main` iguales sin modificar `main`.
- [x] Verificar PR #69 en GitHub y contrastar el head remoto de MAP-238; registrar dependencia sin integrarla.
- [x] Crear únicamente `feat/rodrigo40r/MAP-285-s6-autogestion-segura-de-mi-cuenta-y-perfil-personal` desde la base verificada; sin upstream ni ramas de subtareas.
- [x] Crear `spec.md`, después `plan.md`, después `tasks.md`; incluir aislamiento por tenant y usuario, i18n, contrato, flag y rollback.
- [x] Validar formato de los tres Markdown, enlaces locales y whitespace; revisar diff limitado a documentación.
- [x] Registrar resultados de esa validación en estas notas y preparar el único commit documental solicitado, sin push; verificar ejecución y hash en Git al cerrar la etapa.

## 2. Decisiones antes del código

- [ ] Revisar `spec.md` con los responsables y registrar la aceptación funcional de los criterios; no marcar criterios implementados durante la documentación.
- [x] D01, contrato: concretar contacto permitido, nombres de campos, límites, formato de teléfono, PATCH/null y precedencia de idioma; persistencia/UI pendientes.
- [x] D02, contrato: definir DTOs, operationId, códigos HTTP/Problem, no-store y rechazo de identidad objetivo/propiedades desconocidas; validación efectiva backend pendiente.
- [ ] Volver a verificar PR #69 y coordinar con identidad la integración de MAP-238 en la base; cualquier actualización de rama queda para una etapa posterior autorizada.
- [ ] D03/D04: acordar contraseña actual, confirmación, invalidación de JWT y nuevo login; revisar mecanismo común, STOMP y carreras de emisión.
- [ ] D05: validar rutas staff/plataforma y acceso sin establecimiento seleccionado.
- [ ] D06: acordar tipo del toggle, retiro/issue si es release, caché, fallo después de ON y propagación/rollback.
- [ ] D07: fijar presupuestos propios para cambio de contraseña y reutilización segura del limitador actual.

## 3. MAP-287 — S6 — Perfil personal y API de lectura/edición

- [x] Editar primero OpenAPI para GET/PATCH `/me`; definir esquemas cerrados, campos de solo lectura y errores.
- [x] Ejecutar `api:lint` y `api:gen`; verificar que se generó realmente el cliente TS sin versionar `generated/`.
- [ ] Incorporar el registro OFF/gate de MAP-291 antes de exponer las operaciones.
- [ ] Crear migración expansiva de `app_user` con número disponible y DBML en el mismo commit; no modificar migraciones existentes ni crear identidad paralela.
- [x] Implementar puertos/proyección y casos de uso de nombre/correo existentes; actor y tenant del principal validado.
- [x] Implementar controlador propio y JDBC de nombre/correo con SET LOCAL y filtros por tenant/usuario/rol/estado; escritura exclusiva de full_name.
- [x] Cubrir campos prohibidos, validación, usuario A/B mismo tenant, otro tenant y `platform` en unitarios/REST en memoria; sin escrituras parciales.
- [ ] Completar lectura/escritura de contacto e idioma reales después de la migración compatible; no cerrar MAP-287 con solo nombre/correo.
- [ ] Probar con `mapit_app` real, contexto SQL ausente y reutilización del pool; excluir contexto especial de login en estas consultas.
- [ ] Verificar migración con filas previas y persistencia tras nueva lectura; registrar comandos y resultados reales.

## 4. MAP-288 — S6 — UI Mi cuenta y preferencias básicas

- [x] Crear feature MVVM `my-account/{data,model,ui}`, cliente generado y pruebas de ViewModel/transporte.
- [x] Añadir navegación/ruta staff separada de usuarios, sin bloqueo por selección/alta de establecimiento.
- [x] Implementar carga, errores, guardado, éxito, validación y borradores para nombre/correo disponibles; no mostrar éxito sin persistencia confirmada.
- [x] Actualizar solo el nombre confirmado de la sesión, preservando identidad, token y preferencia de almacenamiento.
- [ ] Integrar idioma de cuenta con `I18nService`; catálogos `es`, `en`, `ja-JP`, fallback español y storage bloqueado.
- [x] Conservar selector de idioma local y añadir textos es/en/ja-JP sin exponer persistencia remota inexistente.
- [x] Limpiar datos ante logout/cambio de identidad, descartar respuestas tardías y probar semántica accesible del DOM.
- [ ] Comprobar presentación móvil real, teclado/lector de pantalla y E2E con stack autorizado.

## 5. MAP-289 — S6 — Cambio seguro de contraseña

- [ ] Resolver D03/D04/D07 y verificar MAP-238 integrado antes de cambiar credenciales/tokens; no crear mecanismo paralelo.
- [x] Definir primero OpenAPI de POST `/me/password`, prueba de control, errores y obligación futura sobre JWT; presupuestos concretos y ejecución del cambio pendientes de MAP-289/MAP-238.
- [ ] Alinear composición/longitud de política, máximo BCrypt en bytes UTF-8, contrato y mensajes; probar caracteres multibyte.
- [ ] Reutilizar `PasswordVerifier`/`PasswordHasher`, validación de confirmación y rechazo de nueva contraseña igual.
- [ ] Reutilizar almacenamiento de límites con presupuestos propios de usuario/IP, independientes del rollback de credenciales.
- [ ] Actualizar hash y corte de tokens atómicamente; probar rollback, concurrencia, emisión de JWT e instante límite de `iat`.
- [ ] Verificar JWT previos denegados por HTTP/STOMP y login nuevo operativo, conforme al contrato final.
- [ ] Añadir formulario a la misma feature y extraer reglas de login a `core/` si son compartidas; sin imports entre features.
- [ ] Documentar cierre local tras éxito y exclusión de listado/«cerrar otras sesiones»; no simular revocación ni recuperación general.

## 6. MAP-290 — S6 — QA de identidad y regresión multi-tenant

- [ ] Consolidar unitarios y ArchUnit, tests REST, integración PostgreSQL/RLS y negativos por rol/tenant/usuario.
- [ ] Probar token ausente/manipulado/expirado/revocado, cuenta inactiva, tenant suspendido y rol obsoleto con la identidad vigente.
- [ ] Verificar no exposición de secretos en DTOs, errores, logs, storage y representación de comandos.
- [ ] Ejecutar regresión de login, activación, usuarios/invitaciones y sesiones; conservar la autorización de MAP-238.
- [ ] Añadir E2E del flujo personal con recarga y cambio de contraseña/nuevo login, y cobertura responsive/móvil aplicable.
- [ ] Ejecutar las suites backend/frontend/build, integración y E2E aplicables con infraestructura autorizada; registrar resultados sin marcar lo no ejecutado.

## 7. MAP-291 — S6 — Feature toggle Mi cuenta Unleash y rollback

- [x] Adaptar y probar el generador para claves de varios segmentos, preservando dos segmentos, flags existentes, idempotencia y LF/CRLF.
- [x] Registrar `mapit.s6.my-account` OFF en Java, TS y bootstrap; el gate funcional no forma parte de esta etapa.
- [x] Usar `FeatureFlagPort.isEnabledFor` en GET/PATCH con tenant autenticado; elegibilidad/autorización independiente tanto OFF como ON. Password pendiente de MAP-289.
- [ ] Implementar contexto del proxy desde Console sin enviar JWT staff, limpiar al cambiar sesión y descartar respuestas antiguas.
- [ ] Cubrir valor inicial pendiente, flag ausente, proveedor sin configurar, OFF/ON, tenant/entorno y fallo después de ON.
- [ ] Definir y probar antigüedad de caché y propagación del rollback frontend/backend; no alterar otras flags incidentalmente.
- [ ] Registrar la flag real en Unleash y probar rollout cuando se autorice infraestructura; retiro/issue si se acuerda tipo release.
- [ ] Ensayar rollback conservando perfiles, hash actual, login/usuarios y revocaciones previas; sin migración destructiva ni downgrade inseguro.

## 8. MAP-314 — S6 — Integrar perfil Super Admin en Mi cuenta sin duplicación

- [ ] Reemplazar placeholder `/admin/profile` con la misma feature, API y ViewModel, sin duplicar componentes o casos de uso.
- [ ] Ajustar navegación/gate de AdminShell y probar las rutas diferenciadas.
- [ ] Probar que SUPER_ADMIN solo modifica su fila en `platform`, sin tenant destino, roles editables ni datos de otros usuarios.
- [ ] Verificar contraseña/tokens, flag OFF/ON y regresión de administración de tenants.

## 9. Entrega final de MAP-285 — fuera de esta etapa

- [ ] Actualizar criterios y notas con evidencia de implementación de las seis subtareas.
- [ ] Ejecutar `pnpm check` antes de cada push futuro, además de `api:lint`, integración y E2E aplicables.
- [ ] Cuando se autorice, publicar una única rama/PR hacia `main`, título exacto Jira y plantilla con spec, base y siguiente PR `N/A`.
- [ ] Verificar workflows requeridos del propio PR y adjuntar captura de Checks en verde según `ticket-delivery`; pendiente porque no se crea PR ahora.
- [ ] Realizar Squash and Merge solo en la entrega posterior autorizada. No hay push, PR ni merge en la etapa documental.

## Notas de ejecución

### 2026-11-21 — auditoría MAP-291 antes de cambios

- Árbol limpio en la rama indicada, 11 commits conservados; `main/origin/main` siguen en `fd22d78903a5a2697c1fc20a4769a2f254d8e526`. Jira MAP-291 consultado: **S6 — Feature toggle Mi cuenta Unleash y rollback**, requiere rollout tenant/entorno, fallback, pruebas y QA antes de Listo; estado Por hacer. No se cambia Jira.
- Ya existen clave única/OFF en Java, TS y bootstrap JSON, generador de varios segmentos, gate backend posterior a elegibilidad y evaluación contextual frontend con revisión de sesión, limpieza, timeout y descarte. No se repiten esas implementaciones ni se registra una flag remota.
- Hueco detectado: el SDK backend retiene ON cacheado sin caducidad aunque falle la red; capturar excepciones de `isEnabledFor` no detecta ese caso. Ajuste planeado en §8 del plan, exclusivo de Mi cuenta. Fuente inspeccionada: sources.jar local oficial de Unleash 11.0.2 (`FeatureRepositoryImpl`, `FeatureBackupHandlerFile`, `ClientFeaturesResponse`, `UnleashConfig`), sin iniciar SDK/servidor.
- El seed existente no es un rollback selectivo: recorre todas las flags, añade estrategias y reimpone sus defaults. No se ejecutará ni cambiará en esta subtarea; el runbook usará la consola administrativa para la única clave y entorno seleccionados. El skill `new-feature-flag` mencionado por AGENTS no está en el catálogo/directorio local; no se crea una clave nueva ni se necesita regenerar el registro existente.

### 2026-11-21 — MAP-291: protección backend de caché

- Añadido `MyAccountFlagAvailability`, enlazado al SDK por su configuración y consumido solo al evaluar Mi cuenta. Conserva logging anterior por delegación; las evaluaciones/fallbacks de otras flags no cambian. Requiere tenant explícito; ningún fallback true ni proveedor deshabilitado puede activar esta clave.
- Estado inicial OFF, CHANGED pendiente hasta snapshot aplicado/respaldado, NOT_CHANGED renueva solo snapshot confirmado, error/UNAVAILABLE apaga, caducidad a los 30 s con reloj monotónico. Un backup restaurado o un snapshot fallido seguido de 304 no habilita; debe confirmarse un snapshot nuevo. No se cambia autenticación, JWT, reservas ni estrategias del proveedor.
- `:modules:platform:platform-infrastructure:test --tests 'com.mapit.platform.infrastructure.flags.*'`: **11/11**, incluidas 7 nuevas de disponibilidad/adaptador. Prueban OFF/ON, ausencia/contexto tenant/platform, caducidad exacta, fallo tras ON, recuperación, backup/304 y conservación de otras flags. SpotlessJavaCheck correcto.
- La primera ejecución Gradle intentó una caché no escribible `C:/.gradle`; se repitió con `GRADLE_USER_HOME=C:/Users/rotru/.gradle` y autorización de la herramienta, sin modificar entorno versionado, instalar herramientas o arrancar servicios.

### 2026-11-21 — MAP-288: pantalla, rutas y verificaciones

- Feature MVVM `my-account`: adaptador del cliente OpenAPI generado (GET `/me`, PATCH exclusivamente `{fullName}`), store con Signals y componente OnPush. No se usan datos de sesión como sustituto de GET ni se añade un selector de usuario/tenant. Correo readonly; sin teléfono, idioma remoto ni contraseña.
- Estados de carga/error/reintento/guardado/éxito, validación de 1–120 puntos de código Unicode y una sola línea, normalización de blancos externos, bloqueo de duplicados y descarte de borrador. Solo la respuesta PATCH confirma el nombre en `AuthSession`; se conservan JWT/vencimiento/rol/identidad y almacenamiento. Cancelar una petición al destruir ámbito no revierte una transacción que el servidor ya haya iniciado.
- `MyAccountAccess` evalúa la flag por tenant de sesión y revisión, con nueva evaluación OFF al cambiar de sesión incluso con la misma identidad. Guard espera evaluación inicial; navegación y store comparten ese resultado. OFF oculta accesos y bloquea URL directa, retira el formulario y descarta resultados anteriores. Backend conserva sus comprobaciones propias.
- `/my-account` usa el shell staff con metadata `requiresEstablishment:false`; no fuerza selector ni alta del primer negocio, incluido ADMIN sin establecimientos. `/admin/profile` sustituye su placeholder por la misma feature bajo el guard SUPER_ADMIN; no se modifica gestión de usuarios/tenant. Se reutiliza la guarda de borradores/escrituras, que no depende de establecimiento.
- Catálogos completos `es/en/ja-JP`; selector local existente conservado y descrito como preferencia de este navegador. Semántica DOM probada: labels, email readonly copiable, aria-invalid/describedby, alert/status y botones bloqueados. CSS usa los tokens globales existentes, ancho fluido y acciones apiladas en móvil. No se atribuye a JSDOM verificación visual, contraste computado, lector de pantalla ni breakpoints reales.
- Herramienta de contexto de `impeccable` no disponible (motor local no instalado); se leyeron directamente DESIGN del UI kit, convenciones existentes y referencias Operate. No se instaló el motor ni se inició navegador/aplicación.
- `pnpm.cmd fe:test`: **653/653**, Console 404 (46 archivos), Public Web 148 (24 archivos) y libs 101 (18 archivos). Incluye 30 pruebas nuevas de transporte/store/UI/gate/rutas personales, 2 de navegación y 1 de conservación de contexto, además de AuthSession y flags. Tests usan dobles exclusivamente para simular respuestas en memoria; la aplicación usa el cliente real.
- Verificación final tras el ajuste semántico del enlace del usuario: suite focalizada de Mi cuenta y StaffShell **49/49**; Prettier sobre todos los archivos del incremento, ESLint final de test/plantilla y `git diff --check` correctos.
- Fallos corregidos durante desarrollo: tipado estricto de fixtures, ubicación de prueba de rutas dentro de la propia feature para respetar límites de imports, aserción del valor del input en lugar de textContent y antigua expectativa de ausencia absoluta de canDeactivate en plataforma (ahora contempla el formulario personal). La repetición completa pasa.
- `pnpm.cmd fe:typecheck`, `pnpm.cmd fe:lint` global (0 warnings), `pnpm.cmd api:gen` real y `pnpm.cmd api:check`: correctos. Contrato sin cambios y salidas generadas ignoradas, sin versionar.
- `pnpm.cmd exec ng build console`: correcto. Se corrigió el warning nuevo de Mi cuenta eliminando la importación SCSS que duplicaba tokens ya emitidos globalmente; no se amplían presupuestos. Persisten advertencias del bundle inicial (788,04 kB frente a 600 kB), estilos de otros componentes y CommonJS de qrcode/dijkstrajs/STOMP. Public Web emite NG0956 en su test existente de negocios; libs conserva warning de compilación parcial/completa. Ninguna advertencia provoca fallo.
- Integración real HTTP/PostgreSQL/RLS, proxy Unleash real, Playwright, revisión móvil/teclado/lector de pantalla y captura de Checks del futuro PR: **NO EJECUTADOS/PENDIENTES**. La restricción de no arrancar aplicación/Docker impide verificarlos ahora. MAP-287 sigue parcial por contacto/idioma, MAP-288 no se cierra en su alcance completo y MAP-314 no se declara terminado.
- Para completar: revisar/integrar MAP-238 antes de persistencia pendiente y MAP-289; coordinar cambios compartidos en AuthSession/rutas/shells sin copiar gestión administrativa ni revocación. Resolver política de contraseña/concurrencia/límites y validar invalidación real de JWT/HTTP/STOMP en MAP-289. No hay migraciones, MAP-286, push, PR, merge, squash ni cambios a main.

### 2026-11-21 — MAP-288: compatibilidad con contexto operativo

- La revisión detectó que `EstablishmentContext` invalidaba la selección ante cualquier objeto `SessionUser` nuevo, incluido un cambio de nombre confirmado. Ahora compara revisión de sesión, usuario, tenant y rol; conserva la selección si solo cambia el nombre, y sigue invalidando inmediatamente al reautenticar incluso la misma cuenta.
- `establishment-context.spec.ts`: 14/14 correctas en la suite focalizada, incluida la nueva regresión de selección conservada. `pnpm.cmd fe:typecheck` y `pnpm.cmd fe:lint`: correctos (lint global con cero warnings). No se cambian permisos, catálogo de establecimientos ni backend.

### 2026-11-21 — MAP-288: evaluación contextual de disponibilidad

- `FeatureFlagService.watchInContext` permite sondear una clave con contexto propio y fallback OFF, sin modificar el estado global ni la política de recuperación de flags existentes. Cancela/descarta respuestas al destruir el ámbito, limita la espera inicial a 5 s y apaga tras fallo o respuesta sin clave válida.
- El contexto tenant usa `properties[tenantId]` del protocolo del cliente oficial de [Unleash](https://github.com/Unleash/unleash-proxy-client-js/blob/main/src/util.ts). Solo se envía la clave pública del proxy; nunca JWT ni token admin. La autorización real sigue en backend.
- `pnpm.cmd exec ng test libs --no-watch --include '**/feature-flags/**/*.spec.ts'`: 18/18 correctas (7 contextuales nuevas). ESLint focalizado: cero warnings. La primera compilación detectó un acceso posiblemente undefined en un fixture; se corrigió antes de repetir la suite correctamente.
- Registro `mapit.s6.my-account` permanece OFF; no se conecta ni activa Unleash real. El próximo incremento de Console compartirá este gate entre navegación, guard y ViewModel, reiniciándolo al cambiar de sesión.

### 2026-11-21 — MAP-288: sincronización de sesión

- Inicio limpio en la rama existente, siete commits conservados y `main` en `fd22d78903a5a2697c1fc20a4769a2f254d8e526`. Alcance autorizado: UI de nombre/correo reales; sin contraseña, administración de usuarios, migraciones ni despliegue.
- `AuthSession.updateFullName` acepta solo nombre confirmado y revisión de sesión vigente. Conserva JWT, vencimiento, identidad, rol y almacenamiento elegido; no reinicia la sesión ni su temporizador. La revisión cambia incluso al volver a ingresar con la misma cuenta/token, para invalidar respuestas antiguas.
- `pnpm.cmd exec ng test libs --no-watch --include '**/auth-session.spec.ts'`: 18/18 correctas; incluye persistencia/restauración, expiración, almacenamiento bloqueado, validación y respuestas de sesiones anteriores. El builder mantiene su advertencia existente de compilación completa.
- El cliente OpenAPI se regeneró realmente con `pnpm.cmd api:gen`, sin Docker ni salidas generadas versionadas. La implementación consumirá exclusivamente los campos disponibles de MAP-287; contacto e idioma siguen pendientes de persistencia.

### 2026-11-21 — preparación documental

- Historia consultada: MAP-285, **HU-1.06 — Autogestión segura de mi cuenta y perfil personal**. Las seis subtareas tienen estado Jira «Por hacer» en la consulta; sus nombres exactos figuran en las secciones 3–8. Ninguna se marca terminada por esta entrega.
- Alcance autorizado: una rama para toda la historia, tres documentos iniciales y commit `docs(specs): definir autogestion de cuenta (MAP-285)`. Sin implementación, MAP-286, push, PR, merge, squash, setup, dev ni Docker.
- Estado inicial: árbol limpio en `main`; `git rev-list --left-right --count main...origin/main` devuelve `0 0`. Tras `git fetch --no-tags origin`, ambas referencias conservan `fd22d78903a5a2697c1fc20a4769a2f254d8e526` (`Hu 1.03 — inicio de sesión unificado y registro autónomo de empresas (#66)`).
- Rama creada desde `origin/main`: `feat/rodrigo40r/MAP-285-s6-autogestion-segura-de-mi-cuenta-y-perfil-personal`, sin upstream. No se cambia el commit de `main` ni se crean ramas por subtarea.
- PR [#69](https://github.com/GatoCoder282/MapIt/pull/69) verificado en GitHub: abierto, `merged=false`, destino `main`, head `20e25e5a5ce34ce1308db8c85c0af78d16a0d8a9`. La referencia remota inspeccionada coincide. No confundir el SHA de merge de prueba informado por GitHub con una integración real.
- Dependencia registrada: MAP-238 aporta `CurrentStaffIdentity`, corte `staff_tokens_valid_after` (V36), revisión de autoridad vigente y STOMP; V34–V39 no están en esta base. No se copian ni cambian esas piezas. Antes del código se revisará la versión realmente integrada.
- Se conserva el modelo efectivo de MAP-256: correo globalmente único y una cuenta/tenant. Su spec implementada excluye registro autónomo; no se asumen capacidades de membresías por el título histórico de Jira.
- Hallazgos reutilizables: `app_user`, contextos autenticados/RLS, puertos de contraseñas y limitador PostgreSQL; `AuthSession` e i18n `es/en/ja-JP`. Hay que conciliar 128 caracteres de política frente a 72 bytes de BCrypt, montaje de StaffShell sin establecimiento y contexto/fallback del proxy de flags. El generador actual rechaza tres segmentos.
- `spec.md` distingue R01–R09 (Jira), U01–U04 (solicitante) y D01–D07 (propuestas pendientes). Los endpoints y uso de `app_user` están confirmados por el solicitante; nombres exactos de nuevos campos, respuestas y política de tokens siguen siendo diseño a validar.
- Formato de referencia: secciones numeradas de CU-25, plan con tabla de patrones justificados y tareas/notas de ejecución de HU-7.03. No se copian afirmaciones históricas de esas specs que contradicen el código actual.
- Entorno de herramientas: Node `v24.20.0`, `pnpm.cmd` `11.9.0`; `pnpm.ps1` está bloqueado por ExecutionPolicy de PowerShell. Se usará el shim `.cmd` para comprobaciones sin cambiar políticas del sistema ni instalar dependencias.

### Verificación documental de esta etapa

- `pnpm.cmd exec prettier --write` y `pnpm.cmd exec prettier --check`, limitados a estos tres archivos: correctos. No se ejecutó formato global ni se instalaron dependencias.
- Comprobación de enlaces Markdown relativos mediante Node en memoria: los 9 enlaces locales resuelven a archivos existentes; no se añadieron scripts de validación al repositorio.
- `git diff --cached --check`: correcto. La revisión de nombres/diff preparado contiene exclusivamente `spec.md`, `plan.md` y `tasks.md` de esta historia; sin cambios de código, contrato, migraciones, flags o archivos existentes.
- `git rev-parse main origin/main` conserva en ambas referencias la base `fd22d78903a5a2697c1fc20a4769a2f254d8e526`. No hay modificaciones previas del usuario sobrescritas.
- Commit local preparado con mensaje `docs(specs): definir autogestion de cuenta (MAP-285)`; el resultado y hash se comprueban en el historial Git al terminar, sin incorporar una autorreferencia al hash de este mismo documento.
- No se han ejecutado tests de aplicación ni se afirma cobertura funcional. Las suites, infraestructura, workflows del PR y captura quedan pendientes para implementación/QA; no hay push, PR ni cambios en Jira.

### 2026-11-21 — contrato MAP-287 (incremento posterior a 0d11dfa)

- Alcance autorizado: contrato GET/PATCH `/me` y POST `/me/password`, generación local TS y registro posterior OFF de `mapit.s6.my-account`, con tres commits separados. No se modifica autenticación ni se crean controladores, migraciones o ramas; no se usa Docker. MAP-286 queda fuera.
- `PersonalProfile`, `UpdateMyProfileRequest` y `ChangeMyPasswordRequest` concretan los campos previstos. Esquemas cerrados; email solo lectura, nombre 1–120 de una línea sin blancos externos, teléfono opcional de 1–32 con dígitos/separadores y lenguajes `es/en/ja-JP/null`. PATCH vacío inválido, omisión conserva y null limpia solo opcionales.
- Reutilizadas respuestas `BadRequest`, `Unauthorized`, `Forbidden`, `Conflict`, `AuthRateLimited`, esquema `Problem` y cabeceras RequestId/NoStore. `MyAccountDisabled` define el 404 de disponibilidad tras autenticación/permisos. No se cambia el modelo administrativo ni otras operaciones.
- Las operaciones se marcan `x-implementation-status: planned`; la documentación de éxito de contraseña exige revocación real de MAP-238, aún no disponible, sin emitir JWT nuevo ni simular sesiones. Límites concretos de intentos y solución de concurrencia se mantienen pendientes.
- `pnpm.cmd api:lint`: contrato válido; dos warnings en las operaciones existentes `/health` y `/demo-items` por ausencia de 4xx, fuera del incremento. No se alteran esas operaciones.
- `pnpm.cmd api:gen`: generación real completada con Java 25 y el JAR oficial 7.26.0 en la caché usada por el repositorio, descargado de Maven Central; sin Docker ni instalación global. Inspeccionados `MyAccountService`, los tres modelos, nullables y propiedades de respuesta readonly. La salida sigue ignorada y no se versiona.
- `pnpm.cmd api:check`: hash sincronizado con el cliente generado. Las tres operaciones siguen sin implementación REST; estos comandos no prueban autorización ni revocación backend.
- `pnpm.cmd fe:typecheck`: Console y Public Web compilan tipos con el nuevo cliente generado. Los formularios, tests de autorización, integración/RLS y E2E continúan pendientes para la implementación.

### 2026-11-21 — generador de flags MAP-291

- `new-flag.mjs` admite dos o más segmentos en minúsculas. Se actualiza la prueba de convención del catálogo TS sin alterar ninguna clave o default existente.
- La inspección encontró además que la inserción Java buscaba `");` aunque las entradas reales terminan en `boolean);`: se corrige el punto de inserción y se preserva LF/CRLF. No se modifica el sistema de evaluación ni los adaptadores Unleash.
- `node --test tools/scripts/new-flag.test.mjs`: 4/4 pruebas correctas. Ejecutan el CLI real sobre copias temporales de los tres catálogos y verifican nueva clave OFF, preservación de entradas, idempotencia, LF/CRLF, claves de dos segmentos, `--on`, `kill_switch` y rechazo de entradas inválidas sin escrituras.
- ESLint focalizado en generador, prueba Node y convención TS: correcto, cero warnings. `pnpm.cmd exec ng test libs --no-watch --include '**/feature-flag.catalog.spec.ts'`: 6/6 correctas; warning existente del builder por usar compilación completa en lugar de parcial para aplicaciones.

### 2026-11-21 — registro OFF de Mi cuenta MAP-291

- Ejecutado `pnpm.cmd new:flag mapit.s6.my-account release`, sin `--on`: registro coherente OFF en enum Java, catálogo TS y bootstrap JSON; descripciones TODO sustituidas. Tipo release, retiro previsto `2027-02-21`, seguimiento de esta preparación en MAP-291. Asociar issue específico de limpieza antes del rollout sigue pendiente; no se inventa un ID ni se crean issues externos en esta etapa.
- El registro es local/versionado: no se ejecutó seed, no se abrió Unleash ni se creó/activó una flag remota. No hay controlador, ruta de UI, migración o uso de la flag como autorización. El gate, contexto tenant del proxy, propagación y fallo después de ON siguen pendientes.
- `node --test tools/scripts/new-flag.test.mjs`: 5/5 correctas con registro único OFF en los tres catálogos, metadata release y regresión CLI. ESLint focalizado correcto, cero warnings.
- `pnpm.cmd exec ng test libs --no-watch --include '**/feature-flags/**/*.spec.ts'`: 11/11 correctas (catálogo, logging y nueva prueba de Mi cuenta); sin URL, primer fetch fallido o respuesta sin la clave conservan OFF. La prueba no afirma cambio de política tras una evaluación ON.
- `pnpm.cmd be:test`: BUILD SUCCESSFUL, 87 tareas; unitarios y ArchUnit de todos los módulos correctos. `DisabledFeatureFlagAdapterTest`: 3 pruebas, cero fallos/errores, incluida la nueva comprobación de default OFF para `demo`/`platform` sin Unleash.
- La suite existente emitió un log de error de la tarea programada outbox por PostgreSQL no disponible durante el cierre de contexto; el build y los tests finalizaron correctamente. No se arranca infraestructura ni se modifica ese módulo para silenciarlo.
- Comparación en memoria contra el commit anterior al registro: claves, tipos y valores de las flags previas preservados en Java/TS/bootstrap. No se cambió código de evaluación ni autorización.
- Spotless Java Check en `shared-kernel` y `platform-infrastructure`: correcto. No se aplicó formato Java global ni se modificaron fuentes ajenas al incremento.
- `pnpm.cmd fe:typecheck` tras registrar la nueva clave: correcto en Console/Public Web. Prettier focalizado y `git diff --check`: correctos. Integración/RLS, E2E, rollout remoto, CI/PR y captura siguen pendientes; no se ha ejecutado `pnpm check` porque no hay push y esta etapa valida sus incrementos focalizados.

### 2026-11-21 — backend parcial MAP-287: casos de uso

- Estado inicial limpio en la rama indicada; conservados `0d11dfa`, `9bed32e`, `8d6a20f`, `856e329`. `main/origin/main` permanecen en `fd22d78903a5a2697c1fc20a4769a2f254d8e526`.
- GitHub confirma PR #69 abierto, sin integrar, head `20e25e5a5ce34ce1308db8c85c0af78d16a0d8a9`. Se aplica la autorización del solicitante para avanzar solo campos existentes, sin copiar autenticación ni reservar migración V34–V39 u otro número.
- Contrato actualizado antes del código: GET/PATCH parciales, respuesta con nombre/correo reales y omisión de contacto/idioma no persistibles, PATCH 503 para esos campos (también null y cuerpos mixtos). No hay datos de perfil simulados ni actualizaciones parciales. Password continúa planned, sin controlador.
- `pnpm.cmd api:lint`, `api:gen` y `api:check`: correctos, cliente TS real regenerado e ignorado. Persisten solo los dos warnings de health/demo ajenos al cambio.
- Dominio/puerto y `OwnProfileService`: consulta/edición propias transaccionales, estado/rol elegible antes de flag por tenant, caída de proveedor falla cerrado; ningún setter de correo o autoridad. Pruebas unitarias en memoria son exclusivamente dobles de test, no adaptadores de producción ni evidencia de RLS real.
- Unitarios de `identity-application` y Spotless de domain/application: correctos, sin contexto Spring Boot, servidor ni Docker. Los escenarios nuevos cubren consulta/actualización propias, UUID/tenant/rol equivocados, flag OFF/ON/fallo, nombre inválido y conflicto de actualización.

### 2026-11-21 — backend parcial MAP-287: REST y JDBC

- `JdbcPersonalProfileRepository` exige transacción (MANDATORY), fija SET LOCAL del tenant y usa SQL parametrizado con filtros de tenant/id/rol y cuenta/tenant activos. UPDATE solo asigna full_name y retorna valores reales; no toca hash, email, autoridad o estado. Sin nuevas columnas ni tablas.
- `MyAccountController` reutiliza el principal de Spring Security y la cadena JWT existente sin modificarla. GET/PATCH devuelven no-store y errores Problem; rechazan querys de selección de identidad, headers de identidad conocidos y payloads abiertos/privilegiados. No hay endpoint de contraseña ni acceso por ID.
- Los campos aún sin almacenamiento se omiten de GET. PATCH de contacto/idioma válido, incluido null o mezclado con nombre, devuelve 503 antes de escribir; valores inválidos devuelven 400. No se ofrece éxito simulado.
- Tests REST con RestTestClient ligado al controlador (sin servidor) y pruebas JDBC/obligatoriedad transaccional. La primera corrida encontró una interacción de inicialización del mock JdbcTemplate en el fixture; se aislaron las llamadas de la operación y se corrigió el orden de imports indicado por Spotless. No fueron fallos de aislamiento de producción.
- Unitarios de `identity-infrastructure`: 63 correctos, incluidos rechazo sin principal confiable, campos privilegiados/desconocidos, IDs ajenos, OFF/ON, 503 sin escrituras parciales, errores seguros y SQL limitado. No equivalen a validar PostgreSQL/RLS: eso queda pendiente de integración con infraestructura autorizada.
- Spotless de infraestructura corregido y correcto. El typecheck de Console/Public Web pasó con los campos de respuesta opcionales regenerados. La cadena global de seguridad, JWT, gestión administrativa y las migraciones existentes permanecen intactas.

### 2026-11-21 — autorización y preparación de integración MAP-287

- `MyAccountSecurityTest` usa `SecurityConfig`, `JwtAuthenticationFilter` y JJWT reales, montados en memoria sin Spring Boot ni servidor. Se prueban JWT ausente/alterado/expirado, flags OFF/ON sin saltar elegibilidad, ADMIN/MANAGER/STAFF/SUPER_ADMIN, claims de rol/tenant que no coinciden con la cuenta, selección ajena por body/query/header y PATCH limitado a nombre propio.
- `:bootstrap:test --tests com.mapit.identity.MyAccountSecurityTest --tests com.mapit.architecture.ArchitectureTest`: 6 pruebas de cadena/JWT y 12 de arquitectura correctas. Spotless de bootstrap correcto. Ningún test ejecutado de esta etapa requiere iniciar aplicación, PostgreSQL o Docker.
- `PersonalProfilePersistenceIntegrationTest` queda preparado con PostgreSQL 17/Testcontainers, Flyway actual, rol `mapit_app` sin bypass, un pool de una conexión y servicios/repositorios transaccionales reales. Cubre persistencia/relectura del nombre, filas ajenas del mismo/otro tenant intactas, correo de BD frente al claim, columnas de autoridad intactas, estado/rol vigentes, SUPER_ADMIN propio, OFF sin escritura y RLS/contexto del pool. El fixture respeta vertical obligatoria de tenant; no añade migraciones.
- Integración PostgreSQL/RLS: **NO EJECUTADA**, requiere Docker y no está autorizado iniciarlo. El test se compila pero se excluye mediante tag integration del test unitario. E2E y ensayo de Unleash real: **NO EJECUTADOS**, requieren stack. No hay evidencia de aislamiento físico/RLS nueva hasta ejecutar esta integración, ni aceptación funcional completa de MAP-287.
- Resultados focalizados: OwnProfileServiceTest 15/15, MyAccountControllerTest 41/41, JdbcPersonalProfileRepositoryTest 3/3, MyAccountSecurityTest 6/6 y ArchitectureTest 12/12. Además pasaron las suites unitarias existentes de identity-application/identity-infrastructure invocadas; infraestructura suma 63 tests.
- Pendiente exacto antes de cerrar MAP-287: integrar/revisar MAP-238 sin duplicarlo, crear migración nueva con número disponible y DBML, persistir contacto/idioma y sus reglas PATCH/null, ejecutar integración/RLS y regresiones sobre esa base. MAP-288 podrá consumir el contrato para UI, pero no presentar contacto/idioma como disponibles ni activar un rollout completo antes de esos resultados.
- Compilación final de `bootstrap:compileTestJava` y Spotless correctos tras revisar el fixture contra las migraciones actuales. No se ejecutó `pnpm be:test` completo en este incremento para evitar los tests existentes que levantan contexto/servidor de aplicación; se ejecutaron las suites de identidad y los tests bootstrap focalizados sin servidor. Tampoco `pnpm check`, push, PR o merge.
