# Plan — HU-7.06 Centro de notificaciones operativas y preferencias

> **Base auditada:** `origin/main` en `983dee7887ce6e47cfcdebc69dffd33d9ed64886` · **Fecha:** 2026-11-21.
> MAP-292/MAP-293/MAP-294: incrementos de dominio y aplicación autorizados por el usuario; persistencia e integración sujetas a D-1–D-5 de [spec.md](spec.md).

## 1. Inventario reutilizable y carencias

Rutas relativas a la raíz del repositorio. Las rutas bajo `modules/` se refieren a `apps/backend/modules/`.

| Área                       | Existe y se reutilizará                                                                                                                                                                | Falta / precaución                                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eventos operativos         | `shared-kernel/.../realtime/RealtimeEvent.java`, `operations-application/.../state/UpdateSpaceElementState.java`                                                                       | `RealtimeEvent` solo admite cambios de elementos espaciales; no introducir eventos de notificaciones fingiendo que son estados del mapa                                               |
| Outbox                     | `operations-infrastructure/.../realtime/JdbcRealtimeEventPublisher.java`, `RealtimeOutboxDispatcher.java`, migración V11 y ampliaciones posteriores                                    | El dispatcher marca `published_at` para broker, no consumo por destinatario. Retención de publicados: siete días por defecto. Falta consumidor durable independiente                  |
| Reservas                   | `reservations-application/.../reservation/CreateReservation.java`, `CreatePublicReservation.java`; auditoría `RESERVATION_CREATED`                                                     | El actor público es nulo y no genera esa auditoría staff; el alta pública también debe emitir el hecho notificable. No se localizó productor real de cancelación                      |
| Pagos y llegada            | `bootstrap/.../config/PaymentOutboxPublisher.java`, `CheckInService.java`; eventos `payment.status.changed` y `reservation.checked_in`                                                 | Un pago cancelado no equivale a reserva cancelada. No reenviar los payloads de pagos completos a la nueva bandeja                                                                     |
| Identidad y permisos       | `identity-domain/.../AuthenticatedPrincipal.java`, `shared-kernel/.../security/ActorContext.java`, `TenantContext`, `EstablishmentAuthorizationPort`, adaptadores existentes de acceso | La base no incluye `CurrentStaffIdentity` ni corte de tokens de MAP-238; no crear una implementación paralela                                                                         |
| STOMP                      | `bootstrap/.../config/RealtimeWebSocketConfig.java`, `RealtimeStompInterceptor.java`, `shared-kernel/.../realtime/RealtimeDestination.java`, `docs/api/realtime.md`                    | Broker `/topic`; parser y autorización de salas y canal público de pagos. No hay destino de bandeja personal; hoy un destino nuevo se rechazaría también en outbound                  |
| Cliente realtime           | `libs/realtime/src/realtime.ts`, `RealtimeClient` con conexión, reconexión y suscripciones compartidas por sala                                                                        | Falta suscripción personal y señal de invalidación de bandeja; ampliar API pública sin romper streams espaciales/pagos ni detener su socket al apagar solo el centro                  |
| Consola                    | Campanas en `apps/console/src/app/layout/{staff,admin}-shell.{ts,html,scss}`, `AuthSession`, `EstablishmentContext`, guards y `@mapit/ui-kit`                                          | Campanas/puntos decorativos, sin inbox ni contador real. No copiar la feature Mi cuenta de la rama MAP-285                                                                            |
| Contrato                   | `packages/api-contract/openapi.yaml`: servidores `/api/v1`, bearer, `Problem`, `Unauthorized`, `Forbidden`, `NotFound`, páginas existentes                                             | Sin endpoints de notificaciones; STOMP se documenta aparte. `api:gen` real genera TypeScript, no interfaces Java pese al texto histórico del contrato                                 |
| Flags                      | `FeatureFlagPort.isEnabledFor`, enum Java, catálogo TS, `infra/docker/unleash/flags.json`, proxy y `tools/scripts/new-flag.mjs`                                                        | La clave nueva no está registrada. El generador admite exactamente dos segmentos. El servicio TS no envía contexto y conserva estado previo al fallar; no garantiza OFF después de ON |
| Solicitudes y preferencias | Registro de tenant y emails transaccionales existentes en `platform`; i18n `es`, `en`, `ja-JP`                                                                                         | No se encontró flujo de solicitudes/decisiones de MAP-257. Mi cuenta pertenece a MAP-285, aún no integrada en esta base                                                               |

La auditoría no ejecutó la aplicación ni verificó entrega real, permisos con PostgreSQL o estado de Unleash. El código fuente evidencia posibilidades de reutilización, no pruebas de integración aprobadas.

## 2. Límites hexagonales propuestos

- `operations-domain/.../notification/`: `Notification`, tipo/categoría, preferencia, repositorios y puertos de destinatarios/acceso. Java puro; tipos explícitos, sin importar dominio de identidad, reservas o plataforma.
- `operations-application/.../notification/`: procesar un hecho confirmado, listar bandeja propia, contar, marcar una/todas y consultar/modificar preferencias. Transacciones delimitadas y validación completa antes de mutar.
- `operations-infrastructure/.../notification/`: repositorios JDBC, controlador y Problem Details, adaptador de entrega y consumidor durable. Tenant fijado dentro de la misma transacción que cada query.
- `shared-kernel/.../notification/`: solo el contrato mínimo de publicación de hechos realmente compartido entre contextos, si resulta necesario; no un bus genérico ni un DTO de UI compartido.
- `bootstrap/.../config/`: cableado de acceso a identidad y orquestación entre contextos; adaptar las garantías de MAP-238 una vez integradas, sin imports entre módulos. Los controladores pueden usar el `ActorContext` existente y un puerto de alcance propio.
- `apps/console/src/app/features/notifications/{data,model,ui}/`: feature MVVM con Signals. Si shell y Mi cuenta necesitan estado compartido, contrato/store de la app en `core/`; nunca imports entre features ni dependencias de negocio en `ui-kit`.

No se propone un nuevo módulo Gradle ni una segunda conexión WebSocket para este MVP. Si el acuerdo de D-2 cambia el propietario del contexto, corregir este plan antes de implementar.

### Contratos de dominio del incremento MAP-292

- Paquete `com.mapit.operations.domain.notification`, Java puro, `@NullMarked`, sin dependencias nuevas. Dos tipos basados en hechos existentes y categorías derivadas del tipo, según la matriz mínima de la spec; no implementar preferencias ni destinatarios todavía.
- `NotificationRecipient`: tenant y UUID de usuario obligatorios. `NotificationScope`: destinatario y concesiones inmutables por tipo/establecimiento; ninguna concesión implícita ni bypass de rol. Todas las operaciones de lectura/contador/marcado requieren ese ámbito.
- `NotificationEvent`: ID estable, tenant, tipo, instante del hecho y solo UUID de establecimiento/reserva. El tenant del evento debe coincidir con el del destinatario. Sin texto libre, PII, URL o mapa arbitrario. `NotificationKey`: destinatario + evento estable + tipo; no depende del ID generado para la fila, fecha de entrega ni estado leído.
- `Notification`: inmutable; creación no anterior al hecho; `readAt` ausente significa no leída, y si existe no puede preceder a la creación. Marcar requiere ámbito autorizado, conserva la primera lectura y no modifica el original. No visible y no existente comparten resultado vacío en el puerto.
- `NotificationRepository`: creación idempotente, listado paginado, contador no leídas y marcado individual. No hay búsqueda global por ID, listado solo por tenant ni actualización genérica. Una reentrega compatible devuelve la fila original sin resetear lectura; un mismo ID de evento con datos incompatibles se rechaza sin sobrescribirla. La unicidad atómica real queda para el adaptador/constraint PostgreSQL.
- Paginación de dominio por cursor `(createdAt, id)` descendente, límite 1–100; desempate UUID por su representación canónica, compatible con orden unsigned de UUID en PostgreSQL. El cursor está ligado al ámbito completo, incluidos permisos por tipo, y se invalida al cambiarlo. La página valida límites, orden, pertenencia y duplicados y copia su colección. El cursor interno no se exporta por HTTP: §5 define su representación pública opaca y el codec sigue pendiente.
- Pruebas del modelo/ámbito/página y un contrato de repositorio ejercitado con doble en memoria **solo en test**; no se registra un bean ni se afirma persistencia real. Repetir ese contrato y pruebas SQL/RLS cuando exista JDBC. No se garantiza autorización de producción mediante una interfaz o un doble de test.

## 3. Persistencia y consumo durable — MAP-292 / MAP-293

Modelo conceptual propuesto:

| Registro                      | Campos y restricciones propuestas                                                                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evento notificable durable    | `id` estable del hecho, `tenant_id`, tipo/versionado, instante, recurso y establecimiento cuando corresponda, datos mínimos permitidos y estado propio de procesamiento                              |
| Notificación por destinatario | `id`, `tenant_id`, `recipient_user_id`, `source_event_id`, tipo/categoría, `establishment_id` según ámbito, referencia mínima, `created_at`, `read_at`; unicidad por tenant/destinatario/evento/tipo |
| Preferencia                   | `id`, `tenant_id`, `user_id`, categoría optativa, habilitada, fecha; unicidad tenant/usuario/categoría y catálogo cerrado                                                                            |

RLS, FK compuestas e índices según §9 de la spec. `created_at DESC, id DESC` ofrece orden estable; índices por tenant/destinatario/fecha y parciales de no leídas. Cerrar retención y límites de página antes de DDL. No guardar textos traducidos ni JSON arbitrario de productores/clientes.

Reutilizar identificadores de hechos existentes y sus transacciones. No consumir solo filas `published_at IS NULL` del outbox de tiempo real: otra entrega puede haberlas marcado antes. Tampoco convertir la bitácora append-only en cola ni asumir que emite todos los hechos públicos. Propuesta a validar: registro durable específico para el consumo de notificaciones, enlazado al mismo hecho y escrito en su transacción mediante un puerto; estado de consumo independiente del envío STOMP actual. Conservar las garantías de los productores existentes.

Resolver el fanout en worker por tenant, en lotes y con claim/reintentos seguros, después del commit del hecho. No hacer llamadas al broker ni expandir todos los destinatarios en la petición de negocio. Ante caída de UI/Unleash/broker, el hecho permanece recuperable. La atomicidad de persistencia no debe sustituirse por capturar errores y perder avisos silenciosamente.

Una reentrega usa el mismo `source_event_id`; inserción idempotente con restricción única. Un duplicado incompatible no sobrescribe una notificación ni su `read_at`: se rechaza y registra solo metadatos seguros. Persistir bandeja antes de emitir la señal personal. Un fallo de entrega no revierte una bandeja confirmada; recuperación por API y reintento.

La migración se generará solo sobre la base integrada y numeración libre entonces: sin reservar V34–V39 ni prometer que la siguiente será V40. Actualizar DBML en ese mismo incremento. Para primeros tests de dominio no hace falta PostgreSQL ni migración.

## 4. Matriz de destinatarios — decisión previa al contrato

1. Para cada tipo, cerrar fuente real, recurso, permiso de lectura, establecimiento, categoría, criticidad y roles candidatos. `ADMIN`/`MANAGER`/`STAFF` son candidatos, no listas autorizadas por nombre.
2. Reutilizar permisos efectivos de MAP-238. Para bandeja no basta con `RealtimeRoomAccessPort`: un acceso al mapa no concede acceso a toda decisión/pago/solicitud.
3. Filtrar destinatarios activos antes de insertar y revalidar identidad y permisos al consultar, contar, marcar y entregar. No remitir automáticamente al actor si su regla no lo incluye. No recalcular destinatarios históricos hacia usuarios nuevos sin regla expresa.
4. Para plataforma, resolver una identidad de plataforma autorizada y un evento con ámbito definido. No poner una FK de usuario `platform` en una fila del tenant del negocio. MAP-257 debe aportar el vínculo verificable entre solicitud y destinatario de su decisión.
5. Si un tipo no tiene productor o política cerrados, dejarlo pendiente con prueba de no emisión; no crear avisos simulados ni declarar la historia completa.

### Incremento interno MAP-293

- Añadir `NotificationRecipientCandidatesPort.findCandidates(event)` al dominio: candidatos internos del hecho confirmado, nunca destinatarios deserializados de un payload externo. La futura fuente debe mantener la elegibilidad original del evento para reintentos; no ampliar históricos a usuarios nuevos por recalcular indiscriminadamente la membresía actual. Falta implementar ese snapshot/fuente durable y su paginación por lotes.
- `ResolveNotificationRecipients` descarta candidatos cross-tenant antes de consultar permisos, elimina candidatos repetidos y reutiliza `NotificationAuthorizationPort` para identidad/tenant activos y concesiones por tipo. Un ámbito para otro destinatario se rechaza, no se reutiliza. Para cada elegido también exige `EstablishmentAuthorizationPort.canReadOperations` en reserva creada o `canCheckIn` en llegada. Son los predicados existentes, con sus reglas actuales de roles; no añadir un catálogo paralelo de roles ni consultar `canManagePayments`.
- `ProcessNotificationEvent` procesa solo un `NotificationEvent` interno, usa un único instante de `Clock`, resuelve todos los destinatarios antes de escribir y crea candidatos inmutables con UUID de fila y el mismo evento estable. Reutiliza `NotificationRepository.createIfAbsent`; devuelve los avisos canónicos, incluidos los ya existentes, sin afirmar que todos son filas nuevas. La reentrega conserva ID, creación y primera lectura originales; una respuesta de repositorio con otra clave/evento falla sin devolver esos datos.
- No hay dependencia de feature flags en selección/creación ni cambios a productores. El futuro consumidor debe correr fuera de la petición de negocio y dentro de una transacción real, con tenant, reintentos, unicidad y estado durable; no se prueba ese comportamiento con un doble en memoria. No registrar beans antes de tener adaptadores, como en MAP-294.
- Pruebas nuevas: matriz de permisos de roles representada mediante dobles de los puertos existentes, otra empresa con mismo UUID de usuario, establecimiento/tipo no concedidos, ámbito ajeno, candidatos duplicados/vacíos, eventos repetidos con lectura previa, respuesta incompatible y fallo de autorización antes de persistir. No es QA de los adaptadores reales ni integración de MAP-257.

## 5. Contrato API MVP — MAP-294 (implementación HTTP pendiente)

### Incremento de aplicación sin HTTP autorizado por el usuario

- Añadir `ListMyNotifications`, `CountMyUnreadNotifications`, `MarkMyNotificationRead` y `MarkAllMyNotificationsRead` en `operations-application/.../notification/`, con transacciones de lectura/escritura como los casos de uso existentes y `Clock` inyectado en escrituras.
- `CurrentNotificationScope` reutiliza `ActorContext` y `TenantContext`: exige ambos en cada llamada y pide al nuevo puerto de dominio `NotificationAuthorizationPort` un ámbito vigente para esa identidad. Un resultado denegado o con otro tenant/usuario falla cerrado antes de acceder al repositorio; no se acepta un ámbito desde la API ni se cachea entre llamadas. El puerto nuevo solo cubre concesiones por tipo/establecimiento, no implementa autenticación ni revocación alternativas.
- Extender `NotificationRepository` con `markAllRead(scope, readAt)`, sin otra interfaz de persistencia. Exigir una actualización atómica de no leídas del ámbito, visibles en su instantánea y con `createdAt <= readAt`; conservar lecturas previas y devolver cantidad modificada. No recorrer páginas ni hacer `count` seguido de actualizaciones individuales. El corte es una decisión técnica interna del incremento, no un parámetro de cliente.
- Reusar límites, orden y validación de cursor del dominio. La aplicación verifica que la página devuelta corresponda a la petición; el marcado individual mantiene vacío para inexistente/ajena y valida identidad/ID de su resultado. Las cantidades negativas son un fallo del adaptador, no un contador válido. Las escrituras siguen exigiendo filtros correctos en el adaptador; una validación del resultado no sustituye el WHERE ni RLS.
- No registrar `@Service` ni wiring ficticio hasta disponer de repositorio/autorización reales: clases construibles y testeables, con `@Transactional` preparado para el futuro registro como beans. Las transacciones efectivas y su rollback no se demuestran con instanciación directa en unit tests.
- Pruebas focalizadas de contexto ausente, ámbito incorrecto/denegado, cursor de otro usuario/tenant/permisos, orden/límites, contador, primera lectura y marcado masivo sin cambios ajenos. El contrato del puerto y las pruebas en memoria no acreditan snapshot SQL, RLS o revocación de MAP-238.

Contrato en `packages/api-contract/openapi.yaml`, relativo al servidor `/api/v1`. Las cuatro operaciones llevan `x-implementation-status: pending` y descripción de dependencias; generar cliente no habilita controladores ni añade servicios operativos.

| Método/ruta                                     | Caso de uso existente y respuesta prevista                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET /me/notifications`                         | `ListMyNotifications` → `{content, hasMore, nextCursor?}`; sin contador ni filtros de no leídas todavía    |
| `GET /me/notifications/unread-count`            | `CountMyUnreadNotifications` → `{unreadCount}`                                                             |
| `PATCH /me/notifications/{notificationId}/read` | `MarkMyNotificationRead` → `{id, readAt}`; vacío se traduce al mismo 404 para inexistente/ajeno/no visible |
| `PATCH /me/notifications/read-all`              | `MarkAllMyNotificationsRead` → `{updatedCount}`; no expone un corte que el caso de uso no devuelve         |

Esquemas mínimos: `NotificationItem` proyecta id, tipo/categoría del dominio, establecimiento/reserva, ocurrencia/creación y `readAt` nullable. No expone tenant, destinatario, evento de origen, datos de cliente/pago, roles ni texto libre. La categoría deriva de los dos tipos existentes; no hay API de catálogo/preferencias ni tipos de solicitudes de MAP-257. Modelos de página/contador/marcado cerrados (`additionalProperties: false`).

Solo el listado admite queries funcionales: `limit` entero 1–100/default 20 y `cursor` opaco URL-safe 1–2048 caracteres; primera página sin cursor. El futuro codec debe autenticarlo, vincularlo a tenant/usuario/ámbito vigente y tratar manipulación/caducidad/otro ámbito como 400 seguro. No serializar el `NotificationScope` interno en claro. Orden por `(createdAt, UUID canónico)` descendente, continuación estricta sin offset; `nextCursor` omitido con `hasMore: false`. Cada petición tiene su propia lectura autorizada; no se promete snapshot compartido entre listado y contador.

Los marcados no admiten body ni fechas/cursor/filtros del cliente. El individual conserva la primera lectura; el masivo usa un único corte de Clock y una instantánea de UPDATE con identidad/ámbito y `createdAt <= corte`. Repetir sin nuevas elegibles devuelve cero; una ejecución posterior puede incluir nuevas llegadas con su nuevo corte. El adaptador debe rechazar cuerpos/queries desconocidas y mapear principal/autorización antes del gate; OpenAPI no implementa esas comprobaciones.

Se reutilizan `bearerAuth`, `Problem`, `RequestId` y `NoStore`. Respuestas propias de notificaciones garantizan `no-store` en 200/400/401/403/404/500/503 sin modificar errores globales. El gate OFF/no confiable responde 404 después de autenticar/autorizar. Quedan pendientes JDBC/RLS, autorización vigente, codec, wiring transaccional y controladores reales; D-1/D-4 siguen abiertos para eventos/preferencias fuera de este MVP. Flujo ejecutado: YAML → `api:lint` → `api:gen` → `api:check`, con verificación de los cuatro métodos generados; salidas ignoradas y sin edición manual.

## 6. STOMP y reconciliación — MAP-295

- Extender el transporte existente con destino personal. `/user/queue/notifications` es una opción a validar; hoy broker/parser solo soportan las salas `/topic` existentes. No se habilita un comodín ni una sala de tenant para datos personales.
- La asociación sesión/tenant/usuario la crea el servidor desde identidad validada. `Principal.getName()` deberá ser estable y no ambiguo entre tenants; el cliente no decide el destinatario.
- Revalidar CONNECT, SUBSCRIBE y entrega outbound con las garantías de MAP-238, expiración/corte de token, cuenta activa y permiso actual. Rechazar acceso anónimo de reserva, SEND del cliente y suscripciones a otros usuarios.
- Emitir solo invalidación mínima o identificador de aviso/versionado; recuperar el contenido por API. La UI deduplica señales, no hace `contador++` como fuente de verdad.
- Suscribir y reconciliar con API sin ventana de pérdida: acumular invalidaciones durante el fetch inicial y volver a consultar si hubo cambios; repetir tras reconectar. Un evento tardío no sobrescribe una respuesta más reciente.
- Cambiar sesión/tenant cancela solicitudes, vacía bandeja/contador/cursor y desuscribe el canal anterior; una generación local de sesión invalida respuestas tardías incluso si el usuario vuelve a iniciar con el mismo ID. No se añade información sensible a storage.
- OFF desuscribe solo el centro. No llamar `RealtimeClient.disconnect()` sobre un transporte compartido por operación y pagos. Con `realtime.websocket` OFF, mantener recuperación por API y fallback documentado del centro.
- Actualizar `docs/api/realtime.md`, tipos y API pública de `libs/realtime/src/index.ts` junto al canal, no dentro de OpenAPI.

## 7. UI y preferencias — MAP-296 / MAP-297

Reutilizar componentes, tokens y catálogos de consola, `I18nService` y cliente generado. Estados explícitos de carga/error/vacío; contador real, acciones idempotentes con bloqueo de peticiones duplicadas, detalle sin HTML libre y enlaces internos permitidos. Campana accesible con nombre/contador, teclado, foco restaurado, anuncios moderados y layout móvil. OFF oculta el acceso nuevo y cualquier punto decorativo asociado que sugiera no leídas inexistentes.

La bandeja se presenta como panel no modal en la cabecera autenticada, sin nueva ruta ni dependencia de `EstablishmentContext`. Los shells staff/SUPER_ADMIN componen el mismo `NotificationCenter` (excepción local documentada a la regla de imports, que también alcanza a layout). El selector modal operativo existente conserva su prioridad y comportamiento. No se crean enlaces a recursos cuya navegación autorizada no está definida: el detalle muestra solo las referencias del contrato. Esto no inventa eventos de plataforma ni permisos para SUPER_ADMIN; el backend futuro debe resolver los destinatarios y el ámbito vigentes.

`features/notifications/{data,model,ui}` usa `NotificationsService` vía API pública, HTTP sin transfer cache, Signals y suscripciones cancelables. El contador desconocido permanece desconocido; un 404/503 es error, nunca lista vacía. El listado conserva orden/cursor del servidor y elimina IDs repetidos; las escrituras bloquean duplicados y solo aplican ACK válido. Marcar todas envía PATCH sin corte del cliente y vuelve a consultar lista/contador, sin inventar fechas de lectura. No hay mocks ni fallback de producción, STOMP ni cambios en reservas. El generador organiza imports con el servicio semántico de TypeScript, conserva imports necesarios y elimina sus directivas generales `@ts-ignore`, sin relajar las opciones del compilador.

MAP-285 se integra posteriormente para alojar preferencias. No importar su feature desde notificaciones, copiar archivos ni trasladar commits. Cerrar primero el contrato de categorías/defaults y enforcement backend. Una preferencia local de idioma no equivale a una preferencia de notificaciones persistida. Seguridad obligatoria conserva su canal efectivo aunque el centro o sus preferencias estén desactivados.

## 8. Flag y rollback — MAP-299

La clave exacta `mapit.s6.notification-center` está registrada OFF en Java, TS y bootstrap mediante `pnpm new:flag ... kill_switch`. Se elige un **kill switch permanente** para disponibilidad/rollback del centro, sustituyendo la propuesta inicial de release toggle. No requiere fecha de retiro de release; responsable de este incremento: Rodrigo. No se ha creado/activado la flag en un servidor real ni ejecutado seed/setup.

El commit `719d0fb` corrige de forma independiente el generador para dos o más segmentos y el cierre del enum Java (booleano final, LF/CRLF); conserva claves previas, defaults, `--on` e idempotencia. No se copió código ni commits de MAP-285. Los tres registros y su default OFF tienen comprobación cruzada automatizada.

Protección local preparada, restringida a esta clave:

- Backend: `FeatureFlagContext` identifica tenant/usuario y un nonce opaco de sesión, nunca JWT. La sobrecarga contextual de `FeatureFlagPort` falla OFF si un adaptador no la soporta. `UnleashFeatureFlagAdapter` envía las tres dimensiones al SDK y no cachea resultados por usuario. Las evaluaciones globales/solo-tenant del centro devuelven OFF, incluso con fallback explícito `true`; `DisabledFeatureFlagAdapter` tampoco permite ese override. Otros flags conservan las rutas anteriores.
- El subscriber existente observa disponibilidad del proveedor: inicio sin fetch correcto, error, UNAVAILABLE, reloj regresivo o más de **30 segundos** sin fetch correcto cierran solo la evaluación contextual nueva. También se vuelve a comprobar salud después de evaluar el SDK. Las cachés/fallbacks de otros flags y sus logs de transición se mantienen.
- Frontend: `FeatureFlagService.setContext({tenantId,userId,sessionId})` copia/valida contexto y borra el ON anterior. `setContext(null)` elimina contexto/valor y aborta evaluación al salir; el teardown también lo hace. Revisiones de contexto/petición y abort descartan respuestas/errores tardíos, incluso A → B → A. No se conservan valores por tenant ni se persiste contexto en storage.
- La nueva clave ignora la respuesta global del proxy: solo una evaluación contextual válida puede dar ON. Ausencia/error/HTTP no exitoso/JSON inválido/clave duplicada o ausente → OFF. Se consulta por el mismo proxy con clave pública, `credentials: omit` y `cache: no-store`, sin enviar JWT. El sondeo reutiliza el intervalo configurado (15 s por defecto); cada evaluación contextual tiene timeout de **10 s**, con descarte de respuestas que ignoren abort. Ante un fallo detectable, OFF llega en el siguiente sondeo/timeout; estos plazos locales no garantizan la propagación real completa.
- Integración frontend: `NotificationSessionContext` observa `AuthSession.user` y genera un UUID en memoria por cada inicio de sesión, incluso con los mismos IDs. No lee el JWT ni persiste el nonce. `isEnabledForContext` exige coincidencia de tenant/usuario/sesión, ocultando ON anterior antes de ejecutarse el efecto de actualización. El store también comprueba propietario/generación/versión antes de aplicar una respuesta; logout/cambio de identidad/OFF vacían datos y cancelan solicitudes. El panel se cierra al cambiar contexto o flag. La librería no importa `@mapit/auth` y AuthSession no se modifica. Pendiente backend: construir contexto desde autenticación validada y comprobar autorización antes del gate; aún no hay controlador ni canal personal.
- La selección/creación/persistencia de hechos no importa flags ni se cambia con este incremento. No se añade el gate a `ProcessNotificationEvent` ni se corta el transporte compartido de mapas/pagos.

Runbook objetivo:

1. Registrar contexto y estado previo; desactivar únicamente `mapit.s6.notification-center` en el entorno/segmentos afectados.
2. Comprobar evaluación contextual OFF en backend y frontend: la campana desaparece, el panel se cierra y se descartan datos/respuestas anteriores. No hay URL nueva del centro. API y entrega personal siguen pendientes de implementación y validación; no activar hasta completar sus gates y autorización. Medir propagación SDK/proxy y distinguirla de los límites locales de frescura/timeout; autenticación/autorización preceden al gate.
3. Ejecutar reserva/check-in/aprobación disponibles y verificar que negocio, auditoría y registro durable siguen igual; no apagar `realtime.websocket` para revertir solo el centro.
4. No revertir migraciones ni borrar bandeja, preferencias o eventos. Revisar backlog y capacidad del worker con métricas sin PII.
5. Restaurar ON solo en segmento de prueba, reconciliar por API y verificar lectura/contador/deduplicación/dos sesiones; después ampliar según validación.

Pendiente con infraestructura real: crear/verificar registro y OFF efectivo, estrategias/propiedades de contexto, segmentación, propagación SDK/proxy, fallo tras ON y restauración con dos tenants/sesiones. Un proxy puede responder 200 con valores cacheados aunque el servidor upstream esté caído: el guard local frontend no puede detectar esa condición sin evidencia de frescura del proxy; el guard backend debe seguir siendo obligatorio al integrar HTTP. No se declara probado el fallo cerrado end-to-end ni se ejecuta seed/servidores en esta etapa. El procedimiento no revierte migraciones ni borra datos.

## 9. Patrones de diseño aplicados

| Patrón                                        | Dónde                                              | Por qué aquí                                                            | Alternativa descartada                                                                             |
| --------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Puertos y adaptadores                         | Dominio/aplicación/JDBC/STOMP, puente en bootstrap | Conserva límites hexagonales y permite probar políticas sin PostgreSQL  | Imports entre módulos o lógica de destinatarios en controlador/shell                               |
| Outbox transaccional y consumidor idempotente | Hecho durable y bandeja por destinatario           | Tolera caídas/reentrega sin perder el vínculo con el negocio confirmado | Solo listener en memoria después del commit o consumo del estado de publicación de otro consumidor |
| MVVM con Signals                              | Feature de consola y estado compartido acotado     | Aísla presentación, estado de sesión y reconciliación testeable         | Llamadas HTTP y contador mutable duplicados en cada campana                                        |

No se requiere un bus nuevo, CQRS global ni una infraestructura externa de mensajería para este alcance.

## 10. Orden y verificación por incremento

1. Cerrar D-1–D-4 y revalidar base/MAP-238. MAP-292: tipos, invariantes y repositorios con pruebas de dominio sin DB; después migración/DBML numerados sobre base integrada y RLS.
2. MAP-299: clave generada y política OFF/contexto/frescura verificadas; mantener OFF. Puede avanzar en paralelo lógico al modelo una vez resuelto el tooling compartido, sin traer MAP-285.
3. MAP-293: un productor real y destinatarios de reserva primero; probar transacción/reentrega. Añadir llegada y cancelación real; solicitudes esperan contratos de MAP-257.
4. MAP-294: casos de uso internos sin HTTP, autorizados como incremento independiente; después contrato OpenAPI validado/generado antes de añadir API propia sobre persistencia real y autorización vigente. Probar identidad/permisos, listado/contador y mutaciones atómicas reales.
5. MAP-295: canal personal, validación inbound/outbound y recuperación; regresión de mapas/pagos y canales públicos.
6. MAP-296: campana/centro, i18n y pruebas focalizadas, sin condicionarlo a Mi cuenta.
7. MAP-297: preferencias persistidas e integración con MAP-285 cuando esté disponible; mensajes obligatorios no silenciables.
8. MAP-298: PostgreSQL/RLS runtime, dos sesiones, deduplicación, carreras de lectura/reconexión, revocación HTTP/STOMP, ON/OFF y móvil; evidencia del PR futuro.

Commits futuros propuestos por incremento real: `feat(operations): modelar notificaciones propias (MAP-292)`, `feat(operations): persistir bandeja aislada por tenant (MAP-292)`, `feat(contract): definir bandeja personal (MAP-294)`, `feat(operations): generar avisos autorizados (MAP-293)`, `feat(realtime): entregar avisos personales (MAP-295)`, `feat(console): agregar centro de notificaciones (MAP-296)`, `feat(operations): aplicar preferencias optativas (MAP-297)` y commits de flag/pruebas cuando proceda. Cada commit incluye las pruebas directamente afectadas; no crear commits vacíos ni una rama nueva sin autorización.

La preparación documental se verificó con Prettier sobre los tres Markdown, enlaces locales, `git diff --check`, lint-staged y commitlint. El incremento de dominio ejecuta solo `:modules:operations:operations-domain:test --tests "com.mapit.operations.domain.notification.*"` y `:modules:operations:operations-domain:spotlessJavaCheck` mediante el wrapper Node existente, además de formato documental y hooks. Sin suites globales, API codegen, migraciones ni servicios. Las pruebas funcionales de SQL/RLS, autorización vigente, HTTP/STOMP y UI siguen pendientes; no se informa un resultado de integración por ejercitar un doble en memoria.
