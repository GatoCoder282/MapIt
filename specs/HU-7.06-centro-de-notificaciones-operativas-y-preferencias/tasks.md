# Tareas — HU-7.06 Centro de notificaciones operativas y preferencias

> **Historia:** [MAP-286](https://matiasmv2005.atlassian.net/browse/MAP-286) — HU-7.06 — Centro de notificaciones operativas y preferencias.
> **Estado:** Contrato MVP MAP-294 validado y cliente generado localmente; HTTP/persistencia/autorización real pendientes. MAP-299 mantiene protección local y validación de infraestructura pendiente.

## Preparación de esta etapa

- [x] Leer instrucciones raíz, backend, consola, libs, contrato, docs y specs; revisar README, CONTRIBUTING, plantilla PR y skill `ticket-delivery`.
- [x] Comprobar árbol limpio y conservar el SHA de MAP-285 con sus 18 commits.
- [x] Actualizar referencias mediante `git fetch --no-tags --no-recurse-submodules origin` y crear la rama solicitada desde `origin/main`, sin copiar commits.
- [x] Consultar MAP-286, MAP-292–299 y dependencias en Jira; verificar PR #69 por GitHub.
- [x] Auditar eventos, outbox, permisos/tenant, STOMP, consola, contrato y flags en la nueva base.
- [x] Crear `spec.md` → `plan.md` → `tasks.md`, distinguiendo Jira de propuestas y pruebas pendientes.
- [x] Evaluar publicación del contrato MVP: aplazada por D-1/D-3/D-4; propuesta de operaciones en `plan.md`, sin endpoints ficticios.
- [x] Validar formato y enlaces de los tres documentos y preparar el commit documental con mensaje Conventional Commits.

## Decisiones previas a implementación

- [x] Autorizar el incremento acotado de MAP-292 por instrucción del usuario del 2026-11-21: modelo, puertos y pruebas sin PostgreSQL; sin ampliar a productores ni endpoints.
- [x] Definir matriz mínima interna de reserva creada/llegada con permisos existentes, separada de eventos pendientes de MAP-257; ámbitos por tipo sin capacidades de rol nuevas.
- [ ] Revisar/aprobar la especificación inicial y resolver D-1–D-5; dejar evidencia de la decisión y su responsable.
- [ ] Cerrar matriz tipo → productor → categoría → recurso/establecimiento → destinatarios/permisos vigentes.
- [ ] Confirmar alcance de solicitudes de MAP-257, actor del solicitante y tratamiento separado del tenant `platform`.
- [ ] Cerrar categorías optativas/obligatorias, defaults, retención, paginación/contador y respuestas del gate.
- [ ] Revalidar la integración de MAP-238 antes de usar identidad vigente/corte de tokens; no copiarla.
- [ ] Coordinar generador multisegmento y garantías de flags con MAP-285/MAP-291, sin trasladar sus commits.

## MAP-292 — S6 — Modelo persistente de notificaciones y migración

- [x] Modelar notificación, hechos mínimos, categorías derivadas y ámbito propio en `operations-domain`, con paquete `@NullMarked`. Preferencias siguen en MAP-297.
- [x] Diseñar puerto de creación idempotente, listado por cursor, contador y marcado propio; ningún método de lectura/marcado admite solo tenant o ID global.
- [x] Probar invariantes, aislamiento de ámbito y clave estable por tenant/destinatario/evento/tipo sin PostgreSQL; ejercitar contrato de repositorio con doble solo de test.
- [ ] Cerrar esquema e índices, FK compuestas, RLS y política de retención; no reservar números Flyway.
- [ ] Tras integrar la base requerida, generar migración con numeración libre y actualizar DBML en el mismo commit.
- [ ] Implementar JDBC con tenant transaccional y filtro explícito de usuario en lecturas, contador y escrituras.
- [ ] Probar PostgreSQL con `mapit_app`: dos tenants, dos usuarios del mismo tenant, sin contexto, FK inválidas y reentrega concurrente.

## MAP-293 — S6 — Generar eventos de negocio y destinatarios autorizados

- [x] Implementar resolución interna con candidatos del evento, exclusión cross-tenant, ámbito vigente y predicado de establecimiento según tipo; sin destinatarios ni roles desde payloads externos.
- [x] Implementar creación mediante clave estable y `createIfAbsent`, conservando avisos canónicos/lecturas, sin depender del feature toggle ni conectar productores.
- [x] Probar selección y reentrega con dobles de puertos: matriz mínima, usuarios/tenants ajenos, establecimiento/tipo, repetidos, ausencia de destinatarios y fallo de autorización antes de escribir.
- [ ] Publicar hechos estables en la transacción real; cubrir reserva staff y reserva pública sin depender de auditoría de actor no nulo.
- [ ] Conectar llegada al productor existente y añadir cancelación solo donde exista transición real de reserva.
- [ ] Integrar solicitud/aprobación/rechazo con MAP-257 cuando sus contratos y destinatarios estén disponibles.
- [ ] Resolver destinatarios mediante puertos, usuarios activos y permisos efectivos por recurso/establecimiento.
- [ ] Implementar consumo durable, reintentos y deduplicación independiente de `published_at` del broker actual.
- [ ] Probar rollback de hecho, evento repetido, usuario desactivado/sin permiso y ausencia de PII innecesaria.
- [ ] Probar negocio y publicación de hechos con flag del centro OFF y fallo de broker/proveedor; sin cambios globales.

## MAP-294 — S6 — Endpoints de listado y marcado como leído

- [x] Implementar incremento interno autorizado: listado propio por cursor, contador y marcado individual/masivo, sin endpoints ni registro como beans con adaptadores inexistentes.
- [x] Resolver identidad desde `ActorContext`/`TenantContext` y ámbito desde un puerto de autorización, en cada llamada y sin argumentos de usuario/tenant/establecimiento desde cliente.
- [x] Ampliar `NotificationRepository` con marcado masivo único, acotado por ámbito/snapshot/corte del servidor, sin duplicar interfaz ni recorrer páginas.
- [x] Probar unitariamente aislamiento, contexto ausente/denegado, cursor/límites, orden, contador y marcado idempotente sin modificaciones ajenas; sin acreditar todavía SQL/RLS.
- [x] Definir contrato OpenAPI MVP de cuatro operaciones, con bearer, Problem/no-store, cursor opaco y estado de implementación pendiente; sin API de preferencias/categorías.
- [x] Ejecutar `pnpm api:lint`, `pnpm api:gen` y `pnpm api:check`, comprobar los cuatro métodos TS y no versionar `generated/`.
- [x] Validar el contrato con seis pruebas focalizadas de alcance, identidad, cursor/límites, privacidad, respuestas/headers y proyecciones existentes.
- [ ] Implementar codec HTTP seguro de cursor y validar ámbito/manipulación/caducidad sin exponer NotificationScope ni valores del token.
- [ ] Implementar casos de uso y API de bandeja propia paginada/contador y marcado una/todas con persistencia real.
- [ ] Rechazar campos desconocidos/privilegiados; principal como única identidad y autorización vigente independiente del flag.
- [ ] Probar `400/401/403/404`, flags, orden/límites/cursor, no leídas, lectura idempotente, snapshot y carreras con nuevas notificaciones.
- [ ] Probar que listado, detalle, contador y marcado no revelan avisos ajenos dentro del mismo tenant ni entre tenants.

## MAP-295 — S6 — Canal de notificación STOMP y reconexión

- [ ] Definir destino personal, identidad no ambigua y envelope mínimo en `docs/api/realtime.md`.
- [ ] Extender broker/parser/interceptor y `@mapit/realtime` sin romper salas operativas ni acceso público de pagos.
- [ ] Revalidar CONNECT/SUBSCRIBE/outbound con MAP-238 y permisos actuales; rechazar SEND, suplantación y sesión anónima.
- [ ] Señalizar después de persistir; recuperar estado por API y deduplicar/reconciliar tras reconectar.
- [ ] Probar dos sesiones, token revocado, cambio de rol/tenant/usuario, expiración y respuestas tardías.
- [ ] Verificar que OFF del centro solo cancela su suscripción y no desconecta operaciones/pagos.

## MAP-296 — S6 — Centro de notificaciones UI y contador

- [ ] Crear feature MVVM `notifications` con data sobre cliente generado y estado Signals reutilizable desde shells.
- [ ] Sustituir campana/punto decorativos por estado real, panel/lista/detalle y acciones; estados carga/vacío/error/reintento.
- [ ] Conservar acceso propio sin establecimiento activo; guard de sesión/gate y rutas internas autorizadas.
- [ ] Vaciar estado y descartar solicitudes/eventos de sesiones anteriores; reconciliar el contador tras marcado y reconexión.
- [ ] Usar catálogos español/inglés/japonés, componentes/tokens existentes, teclado, foco y contador accesible.
- [ ] Probar flag OFF/ON y URL directa, datos reales, errores, dos sesiones, móvil y accesibilidad aplicable.

## MAP-297 — S6 — Preferencias por categoría y notificaciones obligatorias

- [ ] Acordar catálogo/defaults y persistencia; aplicar preferencias solo a categorías optativas en backend.
- [ ] Rechazar silenciar seguridad y payloads desconocidos de forma atómica; documentar canal obligatorio independiente del centro.
- [ ] Publicar/validar contrato de preferencias antes de implementar su API, sin simular éxito o persistencia.
- [ ] Integrar UI en Mi cuenta cuando MAP-285 esté disponible, mediante APIs compartidas permitidas y sin copiar su feature.
- [ ] Probar enforcement, cambios de sesión y aislamiento; no convertir una preferencia local de idioma en persistencia ficticia.

## MAP-298 — S6 — QA E2E de notificaciones, roles y deduplicación

- [ ] Cubrir evento real → persistencia → recepción → lectura, recarga y reconexión sin duplicación.
- [ ] Cubrir matriz de roles, pérdida de permisos, dos sesiones y tenants con contador/detalle/lectura seguros.
- [ ] Probar retención, concurrencia, errores, carga acotada y regresión de reserva/check-in con flag OFF/ON.
- [ ] Probar escritorio/móvil, foco/teclado e idiomas con el stack real cuando se autorice iniciarlo.
- [ ] Registrar comandos, resultados y limitaciones; no sustituir integración/E2E por mocks o inspección estática.

## MAP-299 — S6 — Feature toggle Centro de notificaciones Unleash

- [x] Resolver tooling multisegmento y cierre del enum sin copiar MAP-285 ni cambiar flags ajenos.
- [x] Registrar `mapit.s6.notification-center` idéntico en Java/TS/bootstrap OFF; tipo kill switch permanente para rollback, responsable Rodrigo. Sin activación/seed en un servidor real.
- [x] Preparar evaluación contextual y fallo cerrado después de ON, invalidación de caché/respuestas y frescura local, manteniendo comportamiento de otros flags.
- [x] Probar localmente OFF/ON, flag ausente, proveedor con error, cambio de contexto y evaluación tardía en frontend/backend.
- [ ] Conectar cambios reales de AuthSession al contexto frontend y construir contexto backend desde identidad validada; no usar JWT como nonce.
- [ ] Aplicar gate a acceso UI/URL/API/canal personal; mantener autorización y eventos de negocio independientes.
- [ ] Ejecutar runbook de `plan.md` con Unleash real: propagación, rollback sin pérdida de datos y restauración segura.

## Cierre y entrega futura

- [ ] Completar criterios de `spec.md` con evidencia real; no marcar subtareas Listo solo por tener plan o contrato.
- [ ] Ejecutar comprobaciones focalizadas de cada incremento; checks completos requeridos antes de push/PR cuando se autoricen.
- [ ] Crear PR futuro con título exacto Jira, enlace a esta spec y checks requeridos; adjuntar captura de Checks del propio PR en verde conforme a `ticket-delivery`.

## Notas de ejecución

### 2026-11-21 — Preparación independiente de MAP-285

- Rama: `feat/rodrigo40r/MAP-286-s6-centro-notificaciones-operativas`, creada mediante `git switch --no-track -c ... origin/main` después de verificar limpieza y ejecutar fetch.
- Base y `origin/main`: `983dee7887ce6e47cfcdebc69dffd33d9ed64886` (`chore(infra): habilitar previews QA para ramas feature (#68)`). `main` local permanece en `fd22d78903a5a2697c1fc20a4769a2f254d8e526`.
- MAP-285 se conserva en `29442a21fee67d869dad89d85f87f4d4ae13c1ce`, 18 commits sobre su base `fd22d789`; no se copiaron código ni commits.
- Jira consultado: MAP-286 y MAP-292–299 están «Por hacer». MAP-103/MAP-145 constan Listo; MAP-257 está Por hacer; MAP-238 en Control de calidad. El estado de Jira no equivale a integración en `main`.
- GitHub PR #69: abierto, `merged: false`, head `20e25e5a5ce34ce1308db8c85c0af78d16a0d8a9`; aporta `CurrentStaffIdentity`, validación vigente y migraciones V34–V39. Inspección solo de lectura, sin integración ni copia.
- El comentario de Jira del 2026-11-20 corrige la dependencia histórica MAP-260: ahora es HU-3.03 — Despliegue real de Unleash y operación segura, no el panel Staff. Hay productor de check-in en la base, pero requiere sus propias pruebas.
- Hallazgos: STOMP personal, bandeja, preferencias y flag nuevo faltan en esta base. El generador rechaza la clave de tres segmentos y el frontend conserva el estado anterior ante fallo; un default OFF no resuelve ese caso.
- Se difiere OpenAPI por decisiones D-1/D-3/D-4, no por falta de acceso a Jira. Los métodos/rutas en `plan.md` son propuestas, no funcionalidades existentes ni contratos publicados.
- No se ejecutan Docker, PostgreSQL, Unleash, aplicación, integración o E2E. No hay cambios de contrato/código/DB que justifiquen codegen, suites completas o builds globales.
- Verificaciones documentales ejecutadas: `pnpm exec prettier --write` y `--check` limitados a estos tres Markdown, ambos correctos; script Node de enlaces relativos: tres enlaces válidos en tres documentos; `git diff --check` correcto. `commitlint` acepta el mensaje propuesto `docs(specs): definir centro de notificaciones (MAP-286)`.
- No hay diferencias respecto a `origin/main` en contrato, código, herramientas, infraestructura ni documentación previa. Los hooks normales `lint-staged` y `commitlint` se ejecutan al crear el commit; no se omiten. El resultado final del commit y el estado de Git se informan en la entrega, sin insertar su propio hash en estos archivos.
- PR, push y captura remota: pendientes por restricción expresa de esta etapa; ningún criterio funcional se declara validado.

### 2026-11-21 — MAP-292: dominio, puertos y pruebas sin PostgreSQL

- Jira MAP-292 reconsultado: **S6 — Modelo persistente de notificaciones y migración**, estado «Por hacer». Objetivo confirmado: entidad por usuario/tenant/establecimiento, tipo, evento-id idempotente, fechas, paginación, retención y protección de datos. Su migración y QA real siguen pendientes.
- La instrucción del usuario autoriza este incremento de dominio sobre la spec existente; no cierra todas las decisiones de integración D-1–D-5 ni cambia el estado de Jira.
- Implementación en `operations-domain/.../notification/`: `Notification`, `NotificationEvent`, `NotificationRecipient`, `NotificationCategory`, `NotificationType`, `NotificationKey`, `NotificationScope`, `NotificationCursor`, `NotificationPageRequest`, `NotificationPage`, `NotificationRepository` y `package-info.java`.
- Matriz mínima en `spec.md`: reserva creada (`RESERVATIONS`) y llegada (`OPERATIONS`). `SecurityConfig` y `JdbcEstablishmentAccessRepository` son la evidencia de roles candidatos/acceso actual, no una nueva concesión desde el dominio. Solicitudes/aprobación/rechazo esperan MAP-257; cancelación necesita productor real; eventos operativos/seguridad necesitan política. No se conectó ningún productor ni se implementó resolución de destinatarios (MAP-293).
- El evento lleva tenant y solo referencias mínimas; se rechaza combinarlo con destinatario de otro tenant. Categoría derivada del tipo, lectura inmutable/idempotente y ámbito explícito por usuario/tenant/tipo/establecimiento. Las colecciones son copias inmutables; cursor ligado al ámbito completo, límite 1–100 y orden estable.
- Puerto sin consultas globales: `createIfAbsent`, `list`, `countUnread`, `markRead`. La clave de reentrega excluye ID de fila, fecha de entrega y lectura. El contrato prohíbe sobrescritura de eventos incompatibles y exige actualización/creación atómicas en el futuro adaptador.
- Comando ejecutado: `node tools/scripts/gradle.mjs :modules:operations:operations-domain:test --tests "com.mapit.operations.domain.notification.*" :modules:operations:operations-domain:spotlessJavaCheck --console=plain`, con caché Gradle local existente. **BUILD SUCCESSFUL**.
- Resultados XML: `NotificationTest` **31**, `NotificationPaginationTest` **15**, `NotificationRepositoryContractTest` **11**: **57 pruebas, 0 fallos, 0 errores, 0 omitidas**. Incluyen tenant del evento incompatible, otro usuario del mismo tenant, mismo UUID de usuario en otro tenant, permisos vacíos/diferentes por tipo, cursor ajeno, orden UUID en frontera signed, lectura repetida y reentrega sin resetear lectura.
- El doble en memoria vive dentro del test del puerto; no es bean ni fallback de producción. Estas pruebas no demuestran unicidad concurrente en PostgreSQL, RLS, pertenencia real de usuarios/recursos, identidad vigente ni autorización HTTP/STOMP. No hay persistencia simulada expuesta a usuarios.
- Pendiente para continuar MAP-292: cerrar retención/esquema, integrar base compatible con MAP-238 y elegir entonces numeración Flyway libre, migración/DBML, FK compuestas e índices, RLS con `mapit_app`, JDBC transaccional y pruebas SQL de aislamiento/concurrencia. No se reserva ninguna versión; V34–V39 no se tocan.
- Sin cambio de OpenAPI, flags, autenticación, UI o dependencias Gradle; sin codegen, Docker, aplicación, suites completas ni builds globales. Formato de los tres Markdown, diff y hooks se verifican al preparar el commit de este incremento; resultados en la entrega.

### 2026-11-21 — MAP-294: casos de uso sin HTTP

- Git inicialmente limpio en la rama existente, HEAD `6839711`. Se mantiene el incremento MAP-292 y la rama MAP-285 intacta. Sin nueva rama ni integración de otros tickets.
- Jira MAP-294 reconsultado: **S6 — Endpoints de listado y marcado como leído**, estado «Por hacer». Objetivo confirmado: GET paginado y PATCH leída/todas leídas usando identidad de sesión y pruebas de privacidad/cross-tenant. La instrucción actual autoriza solo aplicación y pruebas: los endpoints siguen pendientes y no se marca la subtarea completa.
- Clases nuevas de aplicación: `CurrentNotificationScope`, `ListMyNotifications`, `CountMyUnreadNotifications`, `MarkMyNotificationRead`, `MarkAllMyNotificationsRead`, errores seguros de autenticación/autorización y paquete `@NullMarked`.
- Reutiliza `ActorContext`, `TenantContext`, `NotificationScope`, cursor/página y `NotificationRepository`. El nuevo `NotificationAuthorizationPort` cubre únicamente resolución de concesiones vigentes; su adaptador deberá reutilizar las garantías de MAP-238 y comprobar cuentas/tenants/permisos activos. No se copió autenticación ni se creó revocación propia.
- El listado solo acepta límite/cursor; el contador y marcado masivo no aceptan identidad ni filtros arbitrarios; el marcado individual solo recibe ID de aviso. Todos resuelven identidad y permisos antes del acceso al repositorio. El cursor se invalida si cambia usuario, tenant o concesiones.
- Se añade `markAllRead(scope, readAt)` al puerto existente: un UPDATE real futuro deberá usar ámbito y snapshot, conservar lecturas previas y excluir creaciones posteriores al corte del reloj del servidor. Las pruebas comprueban que la aplicación no itera páginas ni invoca escrituras individuales para marcar todas.
- Los casos de uso llevan `@Transactional` de lectura/escritura, pero no `@Service`: su registro y transacciones efectivas esperan repositorio/autorización reales. Ningún bean simulado ni endpoint se registra en producción. El rollback y la concurrencia PostgreSQL no se validan instanciando estas clases directamente.
- Ejecutado: `node tools/scripts/gradle.mjs :modules:operations:operations-application:test --tests "com.mapit.operations.application.notification.*" :modules:operations:operations-domain:test --tests "com.mapit.operations.domain.notification.NotificationRepositoryContractTest" :modules:operations:operations-application:spotlessJavaCheck :modules:operations:operations-domain:spotlessJavaCheck --console=plain`. **BUILD SUCCESSFUL**; Spotless correcto en ambos módulos.
- Resultados XML: `CurrentNotificationScopeTest` **4**, `NotificationUseCasesTest` **37**, contrato de repositorio afectado **12**: **53 pruebas ejecutadas, 0 fallos, 0 errores, 0 omitidas**. Solo pruebas nuevas/directamente afectadas; no se repitieron las suites completas de dominio/backend/frontend.
- Dobles exclusivos de tests: prueban orquestación, ámbitos y contrato, incluidas llegadas posteriores a una instantánea simulada; no prueban RLS, snapshot/atomicidad SQL, revalidación real de identidad o autorización HTTP/STOMP. Las respuestas incorrectas del adaptador se rechazan sin devolver sus datos, pero esa comprobación no sustituye filtros de escritura/RLS.
- Pendientes: JDBC/Flyway/DBML y RLS de MAP-292, adaptador de autorización vigente con MAP-238, wiring transaccional real, formato de cursor HTTP seguro, contrato OpenAPI y errores/feature gate antes de exponer HTTP. También lectura conjunta consistente de página/contador y pruebas de integración/concurrencia con PostgreSQL. Sin reservar migraciones ni tocar V34–V39.
- Se actualizan solo estas especificaciones y código/pruebas de notificaciones de `operations`; sin cambios a MAP-285, flags, autenticación, frontend, OpenAPI ni dependencias. Prettier se limita a estos tres Markdown y los hooks normales se ejecutan al commit. Sin Docker, aplicación, push ni PR.

### 2026-11-21 — MAP-293: selección y creación internas

- Git inicialmente limpio, rama existente, HEAD `8bf8b7d`; sin modificar `main`, MAP-285 ni los incrementos anteriores.
- Jira reconsultado: **MAP-293 — S6 — Generar eventos de negocio y destinatarios autorizados**, «Por hacer»; requiere solicitud/decisión, reservas/cancelaciones/check-in, destinatarios por rol/tenant/establecimiento y deduplicación. **MAP-257 — HU-1.05 — Solicitud y aprobación de incorporación de negocios** también «Por hacer»; no se encontraron sus productores en esta base. No se crean tipos, productores ni eventos productivos ficticios para cubrirla.
- Se revisaron solo los emisores existentes de `RESERVATION_CREATED` y `reservation.checked_in`, la matriz y los predicados actuales `canReadOperations`/`canCheckIn` de `EstablishmentAuthorizationPort`. No se modifica `CreateReservation`, `CheckInService` ni `PaymentOutboxPublisher`; la reserva pública sigue requiriendo su publicación durable propia.
- Nuevos: puerto de dominio `NotificationRecipientCandidatesPort` y casos de uso `ResolveNotificationRecipients`/`ProcessNotificationEvent`. El primero pide candidatos internos ligados al hecho estable, excluye otro tenant antes de autorizar, deduplica usuarios y exige ámbito coincidente más el predicado existente por tipo. El segundo valida el instante, resuelve todo antes de crear y reutiliza `NotificationRepository.createIfAbsent`, verificando la clave y el evento canónicos devueltos.
- `NotificationAuthorizationPort` se reutiliza para revalidar cuentas/tenants y concesiones de los candidatos internos; esto no les concede actuar como el usuario autenticado ni crea autenticación propia. El rol efectivo se comprueba por el adaptador del permiso existente; no se añade otro enum de roles ni se hereda el acceso financiero o una sala STOMP.
- Sin registro como beans ni listeners, sin parser de payloads externos ni listas de destinatarios en el comando. No hay dependencia/import de flags en estos casos de uso, y no se alteran procesos del negocio. No se ha probado una reserva real con Unleash OFF/ON: ese ensayo sigue pendiente de infraestructura e integración.
- Ejecutado: `node tools/scripts/gradle.mjs :modules:operations:operations-application:test --tests "com.mapit.operations.application.notification.ResolveNotificationRecipientsTest" --tests "com.mapit.operations.application.notification.ProcessNotificationEventTest" :modules:operations:operations-application:spotlessJavaCheck :modules:operations:operations-domain:spotlessJavaCheck --console=plain`. **BUILD SUCCESSFUL**; Spotless correcto en ambos módulos.
- XML: `ResolveNotificationRecipientsTest` **18** y `ProcessNotificationEventTest` **12**: **30 pruebas, 0 fallos, 0 errores, 0 omitidas**. No se repiten suites previas. La matriz se representa con respuestas controladas de los puertos existentes; no acredita SQL/roles reales. También cubre mismo UUID en otro tenant, ámbito ajeno, candidatos duplicados/vacíos, preservación de lectura en reentrega y respuesta de repositorio incompatible.
- Los datos de pruebas y dobles solo viven en `src/test`; no se publican avisos reales ni se exponen implementaciones en memoria. Los casos usan `@Transactional`, pero atomicidad/rollback y unicidad concurrente dependen del futuro wiring/adaptador; no se declaran demostrados por unit tests.
- Pendientes para cerrar MAP-293: fuente durable y snapshot de elegibilidad original por evento para reintentos sin ampliar históricos, selección por lotes, adaptadores reales de candidatos/autorización/persistencia, validación del origen confirmado y pertenencia del recurso, publicación de reserva pública/cancelación real, integración de MAP-257 y pruebas PostgreSQL/RLS/transaccionales. El centro sigue sin recibir eventos de producción.
- Solo se actualizan estas tres specs y código/pruebas nuevos de notificaciones. Prettier y hooks de commit quedan limitados a lo afectado. Sin JDBC, Flyway, HTTP, STOMP, frontend, dependencias nuevas, Docker, push ni PR.

### 2026-11-21 — MAP-299: registro y protección local del flag

- Inicio limpio en la rama existente, HEAD `1249b22`. Jira MAP-299 reconsultado: **S6 — Feature toggle Centro de notificaciones Unleash**; objetivo confirmado OFF por defecto, rollout segmentado, fallback seguro y rollback sin interrumpir eventos. La subtarea no se declara completa sin infraestructura y gates reales.
- Tooling independiente: commit `719d0fb` — `fix(tooling): generar flags de varios segmentos sin corromper enum (MAP-299)`. Cinco pruebas iniciales con fixtures temporales verifican LF/CRLF, nombres anteriores, defaults, `--on`, idempotencia y fallos sin modificación. No se leyó/copió la solución de MAP-285; su rama permanece intacta.
- Registro ejecutado con `pnpm new:flag mapit.s6.notification-center kill_switch`: enum `MAPIT_S6_NOTIFICATION_CENTER`, catálogo TS y bootstrap con `false`. Se sustituyen los TODO. Kill switch permanente como decisión técnica de disponibilidad/rollback, sin retiro de release; no se modifica Unleash remoto ni se ejecuta el seed.
- Componentes backend reutilizados: `FeatureFlagPort` añade sobrecarga con `FeatureFlagContext`; adaptadores Disabled/Unleash y subscriber/configuración existentes. Para esta clave, ninguna evaluación sin contexto completo o con fallback forzado ON la habilita. El SDK recibe tenant/usuario/nonce de sesión, y su salud debe provenir de un fetch correcto de los últimos 30 s. Sin caché local de resultados por identidad; error o falta de frescura devuelven OFF. Las rutas previas de otros flags mantienen comportamiento.
- Componente frontend existente: `FeatureFlagService.setContext`, sin import de auth ni servicio paralelo. Borra valor, aborta petición y cambia revisiones al cambiar identidad o cerrar; sondeo contextual por proxy y timeout de 10 s, con descarte de respuestas tardías aunque ignoren abort. La nueva clave no usa el resultado global; errores, respuesta inválida, duplicados o ausencia de clave → OFF. No se escriben JWT, credenciales ni contexto en storage/logs.
- Aún no hay enlace automático de AuthSession: el shell futuro debe proporcionar contexto validado de presentación y un nonce nuevo por login, actualizarlo al cambiar identidad/tenant y usar `setContext(null)` al salir. Backend deberá derivarlo de autenticación y autorizar antes del gate. No se inventa ruta, campana, controlador o suscripción; no se cambia selección/creación/persistencia de eventos ni el transporte compartido.
- Backend: `node tools/scripts/gradle.mjs :modules:platform:platform-infrastructure:test --tests "com.mapit.platform.infrastructure.flags.*" :modules:platform:platform-infrastructure:spotlessJavaCheck :shared-kernel:spotlessJavaCheck --console=plain`: **BUILD SUCCESSFUL**, Spotless correcto; XML: `NotificationCenterFlagTest` **10**, `DisabledFeatureFlagAdapterTest` **2**, `UnleashLoggingSubscriberTest` **1**; **13 pruebas, cero fallos/errores/omitidas**.
- Frontend: `pnpm exec ng test libs --no-watch --include "**/feature-flags/src/lib/*.spec.ts"` validó catálogo **7**, logging **1** y guard inicial **13**. Tras ampliar validación de contexto/duplicados, se repitió solo `--include "**/feature-flags/src/lib/notification-center-flag.spec.ts"`: **15/15**. Son **23 casos distintos** validados en tres archivos, sin suites globales; advertencia de Angular sobre partial compilation cambia automáticamente a full y no falla el test.
- `pnpm exec tsc -p libs/feature-flags/tsconfig.lib.json --noEmit` y ESLint de los seis archivos TS afectados con `--max-warnings=0`: correctos. Se corrigieron errores iniciales de tipado/lint en la nueva validación/tests; no quedan errores de checks.
- `node --test tools/scripts/new-flag.test.mjs`: **6/6**, incluidas comprobaciones cruzadas del registro real Java/TS/bootstrap. Prettier solo en archivos afectados, `git diff --check` y hooks de commit normales; sin codegen ni builds globales.
- Runbook actualizado en `plan.md` §8: desactivar solo esta clave, verificar contexto/propagación y negocio, no borrar datos ni revertir migraciones, restaurar por segmento y reconciliar al disponer de API. Pendientes Unleash real: registro/estrategias y OFF efectivo, frescura SDK/proxy, upstream caído con proxy 200 cacheado, segmentación, OFF/ON, dos sesiones/tenants y rollback de superficies todavía inexistentes. No se afirma fallo cerrado end-to-end por estos mocks.
- Sin cambios a main, MAP-285, autenticación/JWT, API generada, OpenAPI o eventos de negocio. Sin push, PR, merge, squash, Docker ni arranque de aplicación; MAP-299 permanece parcial por integración real.

### 2026-11-21 — MAP-294: contrato OpenAPI MVP, sin HTTP operativo

- Inicio limpio, rama existente, HEAD `529af57`. Jira MAP-294 reconsultado: **S6 — Endpoints de listado y marcado como leído**; alcance del incremento autorizado: definir/validar contrato que reutiliza los cuatro casos de uso, manteniendo endpoints sin implementar hasta JDBC/RLS y autorización reales.
- Nuevas operaciones bajo servidor `/api/v1`: `GET /me/notifications`, `GET /me/notifications/unread-count`, `PATCH /me/notifications/{notificationId}/read`, `PATCH /me/notifications/read-all`. Las cuatro declaran `x-implementation-status: pending` y descripción explícita. Sin cambios a controladores, casos de uso, datos, STOMP ni frontend.
- Ocho esquemas mínimos de cursor/tipos/categoría derivada/aviso/página/contador/resultados. Solo tipos de dominio existentes. El aviso omite identidad/tenant, PII y event-id interno; el listado acepta limit 1–100/default 20 y cursor opaco 1–2048 caracteres, con orden por creación/UUID descendente y continuación estricta. `hasMore: false` omite nextCursor. Contador separado: cada petición tiene su propia lectura, sin prometer snapshot compartido entre ambas.
- Sin cuerpos de marcado ni usuario/tenant/establecimiento/fecha/corte del cliente. La aplicación futura derivará identidad desde principal y revalidará permisos; el codec deberá autenticar el cursor y su ámbito. OpenAPI describe rechazo de parámetros desconocidos, pero no lo implementa ni prueba HTTP.
- Idempotencia individual conserva primera lectura. Marcado total usa corte único del reloj del servidor y UPDATE por ámbito/snapshot/createdAt; devuelve únicamente updatedCount, conforme al long del caso de uso. Repetir sin nuevas elegibles produce cero; cada ejecución posterior obtiene un corte nuevo.
- Respuestas propias 200/400/401/403/404/500/503 reutilizan Problem y headers RequestId/NoStore, con `Cache-Control: no-store` en todas; errores globales existentes intactos. Mismo 404 para aviso ajeno/inexistente/no visible y gate OFF/no confiable tras autenticación/autorización. No hay stub que responda 503 o éxito ficticio.
- `pnpm api:lint`: correcto; dos advertencias de 4xx en rutas existentes `/health` y `/demo-items`. No se modifica ese alcance. `node --test tools/scripts/notification-contract.test.mjs`: **6/6**, sin fallos/omitidas; el script usa el CLI Redocly instalado para bundlear YAML en un temporal y comprueba solo notificaciones. No añade herramientas ni dependencias globales.
- `pnpm api:gen` y `pnpm api:check`: correctos. Se comprobó físicamente `generated/api/notifications.service.ts`, sus cuatro métodos y `NotificationItem.readAt: string | null`. El cliente es TypeScript; no se generan interfaces Java y no se versionan salidas ignoradas.
- Un chequeo adicional detectó imports no usados de la plantilla del generador y archivos residuales de Mi cuenta provenientes de generaciones de otra rama. El generador no limpia archivos obsoletos. Se preservó el directorio derivado en `dist/map294-generated-backup-c89e806412084000a26395616de3aa31` (ignorado), verificando rutas dentro del workspace, y se regeneró limpio con los comandos existentes. No se editaron generados a mano ni se modificó MAP-285.
- La regeneración limpia eliminó los residuos locales de Mi cuenta; `api:check` volvió a pasar. `pnpm exec tsc -p libs/api-client/tsconfig.lib.json --noEmit --noUnusedLocals false`: correcto. **El chequeo TS estricto sigue pendiente por imports sin uso de la plantilla generada** (TS6133/TS6192); no se declara verde ni se cambia configuración/generador para silenciarlo. Sin suites/builds globales.
- Pendientes para cerrar MAP-294: JDBC/Flyway/RLS, autorización vigente/MAP-238 y gate contextual real, codec y validaciones de entrada, controladores/mapper de errores/no-store, transacciones y pruebas HTTP/SQL/cross-tenant/concurrencia. Preferencias, MAP-257 y tipos aún no definidos quedan fuera del contrato MVP. No hay endpoints operativos ni se marca completa la subtarea.
- Se actualizan solo openapi.yaml, el test relacionado y estas tres specs. Prettier focalizado, diff y hooks normales al commit. Main y MAP-285 conservadas; sin push/PR/merge/squash, Docker ni aplicación.
