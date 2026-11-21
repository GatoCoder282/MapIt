# Tareas — HU-7.06 Centro de notificaciones operativas y preferencias

> **Historia:** [MAP-286](https://matiasmv2005.atlassian.net/browse/MAP-286) — HU-7.06 — Centro de notificaciones operativas y preferencias.
> **Estado:** MAP-292 y MAP-294 parciales: dominio y casos de uso validados sin PostgreSQL; persistencia/RLS, autorización real y HTTP pendientes.

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
- [ ] Tras cerrar D-1/D-3/D-4, publicar contrato OpenAPI, reutilizando seguridad y Problem Details.
- [ ] Ejecutar `pnpm api:lint`, `pnpm api:gen`, comprobar generación TS y no versionar `generated/`.
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

- [ ] Resolver tooling multisegmento sin copiar MAP-285 ni cambiar flags ajenos.
- [ ] Registrar `mapit.s6.notification-center` idéntico en Java/TS/Unleash, OFF; cerrar tipo, responsable y retiro si es release.
- [ ] Añadir evaluación por tenant/sesión y fallo cerrado también después de un ON; invalidar caché/respuestas anteriores.
- [ ] Probar OFF/ON, flag ausente, proveedor con error, cambio de contexto y evaluación tardía en frontend/backend.
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
