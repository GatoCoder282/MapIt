# HU-7.06 — Centro de notificaciones operativas y preferencias

> **Estado:** Contrato MVP MAP-294, UI MAP-296 y preparación MAP-295 de invalidaciones/reconciliación HTTP. Flag OFF; canal privado sin habilitar. HTTP, JDBC/RLS y autorización real pendientes; no disponible todavía para usuarios finales.
> **Ticket:** [MAP-286](https://matiasmv2005.atlassian.net/browse/MAP-286) · **Fecha:** 2026-11-21 · **Responsable:** Rodrigo Villarroel Ayala.

## Enunciado

Como usuario autorizado de MapIt, quiero recibir, consultar y gestionar notificaciones relevantes para mi actividad para no perder solicitudes, reservas ni cambios operativos.

## 1. Por qué (contexto y fuentes)

Requisitos funcionales confirmados mediante consulta de MAP-286 y MAP-292–299 en Jira el 2026-11-21. El alcance general de roles y tenants se apoya en [use_cases.md](../../docs/roadmap/use_cases.md). Las decisiones identificadas como propuestas en esta carpeta no son criterios confirmados por Jira.

La consola partía de una campana decorativa, sustituida en MAP-296 por el componente protegido y oculto con OFF. El transporte STOMP y el outbox permiten avisos de cambios espaciales, pagos y llegada, pero no representan una bandeja durable por destinatario. La nueva bandeja debe recuperar avisos tras recarga y reconexión, sin sustituir eventos de negocio ni correos transaccionales existentes.

## 2. Actores y precondiciones

- Personal autenticado: `ADMIN`, `MANAGER`, `STAFF`; solo notificaciones propias y recursos actualmente autorizados.
- `SUPER_ADMIN`: notificaciones de plataforma autorizadas; su rol no concede lectura de bandejas ajenas ni bypass de RLS.
- Sistema: registra hechos confirmados, resuelve destinatarios y entrega avisos de forma idempotente.
- La identidad y el tenant provienen del principal validado en backend. La selección de establecimiento del navegador no concede permisos.
- La revalidación de identidad, cambios de rol, desactivación y corte de tokens debe reutilizar MAP-238 cuando se integre. No se copia ni sustituye su implementación.

## 3. Alcance confirmado en Jira

- Campana de consola, contador de no leídas, listado paginado por recientes, detalle, marcar una leída y marcar todas leídas; persistencia de esas acciones.
- Nueva solicitud de negocio y decisión, reserva nueva y cancelación, llegada/check-in y eventos operativos relevantes cuando correspondan. Destinatarios por rol, tenant y establecimiento.
- Entrega mediante WebSocket/STOMP existente y recuperación por API después de reconectar o recargar; sin duplicados por reentrega.
- Persistencia por usuario/tenant/establecimiento, tipo, identificador estable del evento, fechas de creación y lectura; retención y datos mínimos.
- Preferencias por categoría optativa en Mi cuenta cuando esté disponible, con enforcement backend; mensajes críticos de seguridad no silenciables.
- `mapit.s6.notification-center` OFF por defecto, rollout segmentado, fallback OFF seguro y rollback sin interrumpir negocio.
- Pruebas de aislamiento, roles, dos sesiones, reentrega, reconexión, errores, carga y móvil; accesibilidad e i18n existentes.

Fuera de alcance: SMS, push externo o del navegador, proveedores de mensajería masiva, reemplazar emails transaccionales, cambiar autenticación/JWT, administrar usuarios o implementar MAP-285 dentro de esta rama.

## 4. Flujo principal

1. Un caso de uso autorizado confirma un hecho de negocio y su registro durable, sin consultar el flag del centro para decidir si el negocio ocurre.
2. Un consumidor resuelve destinatarios autorizados e inserta una notificación por destinatario. El reintento del mismo evento no crea otra fila ni reinicia su lectura.
3. Una vez persistida, se emite una señal personal por STOMP a las sesiones autorizadas. STOMP no es la fuente de verdad del contador ni garantía de entrega durable.
4. Con el flag activo, la consola solicita la bandeja y el contador reales y muestra estados de carga, vacío o error.
5. El usuario consulta el detalle o marca leída una/todas; el backend aplica identidad, autorización y ámbito antes de escribir.
6. Las sesiones vuelven a consultar el estado tras eventos, lectura o reconexión, descartando respuestas correspondientes a una identidad anterior.

## 5. Eventos y destinatarios: inventario y límites

| Hecho requerido                 | Evidencia en la base auditada                                                                                                     | Pendiente antes de habilitar                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Reserva creada                  | `CreateReservation` registra `RESERVATION_CREATED` en auditoría para actor staff; `CreatePublicReservation` delega con actor nulo | Publicación durable que cubra ambos caminos; matriz de destinatarios con permisos efectivos de consulta                            |
| Reserva cancelada               | Existe el tipo de auditoría `RESERVATION_STATUS_CHANGED`, sin emisor de cancelación localizado en los casos de uso de esta base   | Identificar/integrar el productor real; no deducir cancelación de pago cancelado                                                   |
| Llegada/check-in                | `CheckInService` llama a `PaymentOutboxPublisher.publishArrival`, evento `reservation.checked_in`                                 | Resolver destinatarios por establecimiento y permiso; conservar el productor existente                                             |
| Cambio operativo relevante      | `UpdateSpaceElementState` publica `space-element.state.changed.v1`                                                                | Acordar qué transiciones merecen aviso; no convertir cada cambio del mapa en una notificación                                      |
| Solicitud de negocio / decisión | No se localizó flujo de solicitudes en `platform`; depende de MAP-257                                                             | Identidad del solicitante, eventos estables y destinatarios de plataforma/tenant; no crear una bandeja para un solicitante anónimo |
| Seguridad obligatoria           | Jira exige que no pueda silenciarse; no define aquí un catálogo de eventos                                                        | Acordar productores y canal efectivo independiente del centro; no afirmar que ya existen avisos de seguridad                       |

**Propuesta de autorización:** para hechos operativos, seleccionar usuarios activos del tenant con acceso vigente al establecimiento y al recurso del evento. Un permiso de sala o un nombre de rol, por sí solo, no bastan. Revalidar al listar, contar, leer detalle, marcar y entregar STOMP. Un usuario que perdió acceso deja de ver y recibir los avisos afectados. Sin política de destinatarios definida para un tipo, no se habilita ese tipo.

**Dependencia corregida:** comentario de Jira del 2026-11-20: MAP-260 ahora corresponde al despliegue real de Unleash; no garantiza funcionalidades de Staff/check-in. El check-in localizado en código debe probarse por su propio flujo.

### Matriz mínima para el dominio MAP-292

La instrucción del usuario del 2026-11-21 autoriza este incremento de modelo, puertos y pruebas sin PostgreSQL. Se adopta la siguiente clasificación técnica interna; los nombres de categorías no se atribuyen a Jira ni publican todavía un contrato HTTP. No se implementan productores o resolución de destinatarios en MAP-292.

| Tipo interno / hecho existente                          | Categoría interna | Destinatarios candidatos y autorización mínima                                                                                                                                                                            | Estado                                                                                         |
| ------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `RESERVATION_CREATED` / auditoría `RESERVATION_CREATED` | `RESERVATIONS`    | Usuario activo del tenant; candidato `ADMIN`, `MANAGER` o `STAFF` conforme al GET de reservas actual, más acceso efectivo al establecimiento/recurso. Sin privilegios heredados de una sala STOMP                         | Resolución/procesado internos; falta publicación que incluya alta pública y adaptadores reales |
| `RESERVATION_CHECKED_IN` / `reservation.checked_in`     | `OPERATIONS`      | Usuario activo del tenant y permiso efectivo de check-in del establecimiento; regla conservadora actual `ADMIN` o `STAFF` con concesión `can_check_in`. No otorgar esta capacidad a `MANAGER` por tener acceso a reservas | Resolución/procesado internos; productor ya existe, aún sin conexión al centro                 |
| `space-element.state.changed.v1`                        | Pendiente         | Sin selección de transiciones y destinatarios aprobada, no convertir todo cambio del mapa en aviso                                                                                                                        | Hecho existente, fuera del catálogo implementado                                               |
| Cancelación de reserva                                  | Pendiente         | Requiere productor real y política; pago cancelado no basta                                                                                                                                                               | Fuera del catálogo implementado                                                                |
| Solicitud / aprobación / rechazo de negocio             | Pendiente         | Requiere identidad y ámbito de plataforma/solicitante de MAP-257; ningún rol se añade por suposición                                                                                                                      | Dependiente de MAP-257; sin tipos inventados                                                   |
| Seguridad obligatoria                                   | Pendiente         | Catálogo y canal independiente pendientes; no hay preferencia editable ni evento simulado                                                                                                                                 | Fuera del catálogo implementado                                                                |

Cada operación de bandeja exige tenant, destinatario y un mapa explícito de establecimientos autorizados **por tipo**. Un mapa vacío deniega todo; el acceso a un tipo no concede acceso a otro. Este valor deberá construirse en aplicación desde el principal y permisos vigentes, nunca deserializarse de un body del cliente. No prueba identidad, pertenencia real a BD ni revocación por sí solo; esas garantías esperan adaptadores y MAP-238.

La instrucción actual autoriza en MAP-293 la resolución y creación internas, sin conectar productores. Se aceptan solo referencias `NotificationEvent` de hechos confirmados, procedentes de un consumidor interno futuro; no hay lista de destinatarios, rol ni datos personales en ese comando. Los candidatos salen de un puerto interno asociado al evento estable, se excluyen los de otro tenant y se revalida cada candidato con `NotificationAuthorizationPort` y el permiso existente del establecimiento según tipo. Un ámbito devuelto para otra identidad falla cerrado antes de crear avisos. Este código no verifica por sí solo que un evento llegó a commit; el origen durable y su consumidor siguen pendientes.

## 6. Reglas de negocio y seguridad

- **RN-1:** La API opera sobre el destinatario autenticado. No acepta `userId`, `tenantId`, roles, privilegios, destinatarios ni payloads de eventos controlados por el cliente.
- **RN-2:** Otra persona del mismo tenant tampoco puede consultar, contar o marcar los avisos ajenos. Un identificador no visible responde como inexistente, sin revelar pertenencia.
- **RN-3:** Un evento fallido o revertido no produce notificaciones. La entrega puede repetirse; la persistencia y las mutaciones son idempotentes.
- **RN-4:** Listado y contador aplican los mismos filtros de destinatario y autorización vigente. Las consultas son limitadas y el orden es determinista.
- **RN-5:** Marcar leída conserva el primer `readAt`; marcar todas afecta solo las filas no leídas, visibles y autorizadas en la instantánea de la escritura, con creación no posterior al corte obtenido del reloj del servidor al iniciar la acción. Una llegada posterior al corte o a la instantánea sigue no leída. El cliente no aporta fechas ni IDs de destinatarios para ese marcado.
- **RN-6:** No hay HTML arbitrario, secretos, JWT, datos de pago, contacto del cliente ni cuerpos de petición en avisos/logs. El detalle usa claves de mensaje y referencias mínimas permitidas; cualquier enlace se vuelve a autorizar al abrirlo.
- **RN-7:** Las preferencias solo pueden modificar categorías optativas propias. Intentar silenciar seguridad o enviar categorías/campos desconocidos se rechaza íntegramente antes de escribir.
- **RN-8:** Apagar el centro no cambia autenticación, aprobaciones, reservas, pagos, auditoría ni la generación de hechos. La UI o el broker caídos no deben convertirse en requisitos síncronos para confirmar negocio.
- **RN-9:** OFF, contexto sin evaluar, flag inexistente o evaluación no confiable impiden acceso nuevo al centro y eliminan su estado visible. No se reutiliza un ON de otra sesión/tenant ni se presenta como cero un contador cuyo fetch falló.
- **RN-10:** La autorización backend se aplica aunque el flag esté ON. El canal anónimo de reservas/pagos nunca puede acceder a notificaciones de personal.

## 7. Errores y recuperación esperados

El contrato MVP en `packages/api-contract/openapi.yaml` reutiliza `Problem` RFC 9457 y headers `RequestId`/`NoStore`. Las respuestas específicas de notificaciones añaden `Cache-Control: no-store` a éxitos y errores sin modificar respuestas globales de otros módulos. Define `401` sin identidad válida, `403` por falta de autorización de la funcionalidad, `404` indistinguible para aviso inexistente/ajeno/no visible y para gate OFF/no confiable después de autenticar/autorizar, `400` por entradas inválidas, `503` por dependencia necesaria no disponible y `500` seguro. Las cuatro operaciones tienen `x-implementation-status: pending`; no describen comportamiento HTTP ya operativo.

El MVP incluye solo `GET /me/notifications`, `GET /me/notifications/unread-count`, `PATCH /me/notifications/{notificationId}/read` y `PATCH /me/notifications/read-all`, bajo `/api/v1`. El listado acepta `limit` (1–100, default técnico 20) y cursor opaco URL-safe de 1–2048 caracteres, vinculado a tenant/usuario/concesiones y autenticado por el servidor futuro. Orden estable `createdAt DESC, id DESC`; `nextCursor` se omite al terminar. Listado y contador separados reflejan lecturas independientes. Los marcados no admiten cuerpo, filtros ni corte temporal del cliente; el masivo devuelve solo `updatedCount`, que es lo que permite el caso de uso existente.

Ante pérdida de STOMP, recuperar por API paginada. Ante error de API, mostrar error/reintento sin mezclar datos de sesiones anteriores. No marcar avisos leídos de manera optimista sin confirmación o reconciliación. Reintentos no duplican filas ni suman dos veces al contador.

## 8. Criterios de aceptación

- [ ] **CA-1:** Dadas dos personas del mismo tenant y otra de un tenant diferente, cuando listan, cuentan, consultan detalle o marcan avisos, entonces cada una solo opera sobre sus avisos autorizados.
- [ ] **CA-2:** Dado un evento de negocio confirmado de un tipo habilitado, cuando se procesa y reentrega, entonces se persiste una sola notificación por destinatario autorizado y se ofrece entrega in-app sin recarga.
- [ ] **CA-3:** Dada una bandeja con varias páginas, cuando se consulta y marca una/todas leídas, entonces el orden, contador y `readAt` persisten sin duplicados ni pérdida de avisos concurrentes.
- [ ] **CA-4:** Dadas dos sesiones o una reconexión, cuando se recupera el estado por API, entonces ambas convergen al estado persistido sin duplicación.
- [ ] **CA-5:** Dado un cambio de sesión, tenant, rol, estado o acceso al establecimiento, cuando llega una respuesta o entrega anterior, entonces no expone información fuera del ámbito vigente.
- [ ] **CA-6:** Dadas preferencias optativas deshabilitadas, cuando se procesa una categoría afectada, entonces se aplica la preferencia en backend y ningún mensaje de seguridad obligatorio puede silenciarse.
- [ ] **CA-7:** Dado OFF o fallo del proveedor después de un ON, cuando se intenta acceso por UI, URL, HTTP o STOMP, entonces el centro falla cerrado y el negocio y sus eventos siguen funcionando.
- [ ] **CA-8:** Dado un rollback OFF seguido de ON, cuando se vuelve a consultar la bandeja, entonces se recuperan los datos retenidos y estados de lectura sin revertir migraciones ni reiniciar procesos de negocio.
- [ ] **CA-9:** Dado escritorio/móvil y español/inglés/japonés, cuando se usa la campana y el centro con teclado, entonces contador, foco, estados y detalle son comprensibles y accesibles, sin desbordamiento horizontal.
- [ ] **CA-10:** Dadas las verificaciones unitarias, PostgreSQL/RLS, integración y E2E aplicables, cuando se ejecutan, entonces se registran resultados reales, incluida regresión de reservas con flag OFF/ON.

## 9. Datos, tenant y privacidad

Diseño propuesto, todavía sin tablas ni migración: registro de evento durable, notificación por destinatario y preferencias por categoría. Toda tabla de negocio llevará `tenant_id NOT NULL`, índice `(tenant_id, id)`, RLS mediante `enable_tenant_isolation` y consultas explícitas por tenant. Notificaciones y preferencias además filtrarán por el usuario autenticado; RLS de tenant no protege entre dos usuarios del mismo tenant.

Proponer FK compuesta `(tenant_id, recipient_user_id)` a `app_user(tenant_id,id)` y, para avisos de establecimiento, `(tenant_id, establishment_id)` al establecimiento del mismo tenant. La ausencia de establecimiento se limita a tipos de plataforma/tenant expresamente definidos; nunca actúa como comodín. El diseño de avisos de solicitudes entre plataforma y negocio queda pendiente de MAP-257: no crear filas con un destinatario de otro tenant ni suplantar el tenant de su sesión.

Proponer unicidad por `(tenant_id, recipient_user_id, source_event_id, type)`, índice de bandeja por destinatario/fecha/id e índice para no leídas. Retención de bandeja y eventos, valores por defecto y tratamiento de categorías obligatorias requieren acuerdo; no heredar automáticamente los siete días del outbox de tiempo real.

Runtime con `mapit_app`, nunca owner para evitar RLS. `TenantScope.SET_LOCAL_SQL` debe fijarse dentro de cada transacción, también en workers. Las futuras migraciones actualizarán `docs/db/mapit.dbml` y tendrán tests RLS con runtime real y ausencia de contexto. No se crea ni reserva numeración Flyway; V34–V39 pertenecen al PR #69 pendiente.

## 10. Decisiones pendientes y límite de esta entrega

| ID  | Propuesta técnica que debe validarse                                                                                                | Condición para avanzar                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| D-1 | Matriz por evento: permiso efectivo, ámbito, destinatario y categoría; solicitudes de plataforma separadas de operaciones de tenant | Acordar con MAP-238/MAP-257; no asumir que todos los roles reciben todo                                          |
| D-2 | Inbox en `operations`, puente de identidad en `bootstrap`; canal personal del transporte STOMP existente                            | Confirmar límites sin imports entre módulos y política vigente de identidad                                      |
| D-3 | MVP: cursor opaco, límite 1–100/default 20, contador separado y marcado idempotente con corte del servidor                          | Forma pública definida; codec seguro, controladores y concurrencia SQL pendientes                                |
| D-4 | Catálogo de categorías, defaults de preferencias, retención y canal de seguridad independiente                                      | Acordar reglas y productores; no prometer eventos inexistentes                                                   |
| D-5 | Kill switch permanente OFF con evaluación por tenant/usuario/sesión y fallo cerrado local; no condiciona negocio                    | Registro/protección local y sesión frontend conectados; faltan gates backend/STOMP y validación SDK/proxy reales |

MAP-292 aporta dominio y puertos; MAP-293/MAP-294, procesamiento y casos de uso internos. El contrato MVP de cuatro operaciones de bandeja está definido y el cliente TS se regenera localmente, sin versionar `generated/`. MAP-296 incorpora campana/panel compartido en los shells de staff y administración, transporte generado real, contador, cursor, referencias mínimas y marcado confirmado por servidor. La entrada permanece oculta con `mapit.s6.notification-center` OFF. No activar en un entorno de usuarios hasta disponer de HTTP/persistencia/autorización: un ON prematuro muestra errores reales, sin datos ficticios ni éxito simulado. El alcance de MAP-257, cancelaciones sin productor y preferencias/categorías optativas sigue pendiente y no añade endpoints. MAP-295 prepara publicación/recepción de invalidaciones en el transporte compartido y reconciliación HTTP. No hay persistencia, controladores, migraciones ni canal STOMP privado operativo; ninguna subtarea se declara completa por esta preparación.
