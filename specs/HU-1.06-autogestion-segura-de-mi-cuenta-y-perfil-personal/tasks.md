# Tareas — HU-1.06 Autogestión segura de mi cuenta y perfil personal

> **Historia:** [MAP-285](https://matiasmv2005.atlassian.net/browse/MAP-285) · **Estado:** contrato definido y flag registrada OFF; implementación funcional pendiente.

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
- [ ] Implementar puertos/proyección personal y casos de uso en las capas de identity; actor y tenant del contexto validado.
- [ ] Implementar controlador propio y JDBC con filtros por tenant/usuario, RLS y actualización exclusiva de columnas permitidas.
- [ ] Cubrir campos prohibidos, validación, usuario A/B mismo tenant, otro tenant y `platform`; ningún error deja mutaciones parciales.
- [ ] Probar con `mapit_app` real, contexto SQL ausente y reutilización del pool; excluir contexto especial de login en estas consultas.
- [ ] Verificar migración con filas previas y persistencia tras nueva lectura; registrar comandos y resultados reales.

## 4. MAP-288 — S6 — UI Mi cuenta y preferencias básicas

- [ ] Crear feature MVVM `my-account/{data,model,ui}`, cliente generado y pruebas de ViewModel/transporte.
- [ ] Añadir navegación/ruta staff separada de usuarios, sin bloqueo por selección/alta de establecimiento.
- [ ] Implementar carga, errores, guardado, éxito, validación y borradores; no mostrar éxito sin persistencia confirmada.
- [ ] Actualizar solo el nombre confirmado de la sesión, preservando identidad, token y preferencia de almacenamiento.
- [ ] Integrar idioma de cuenta con `I18nService`; catálogos `es`, `en`, `ja-JP`, fallback español y storage bloqueado.
- [ ] Limpiar datos ante logout/cambio de identidad y descartar respuestas tardías; probar accesibilidad y presentación móvil.

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
- [ ] Usar `FeatureFlagPort.isEnabledFor` en backend con tenant autenticado; autorización independiente tanto OFF como ON.
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
