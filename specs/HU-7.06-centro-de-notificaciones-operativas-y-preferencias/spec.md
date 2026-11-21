# HU-7.06 — Centro de notificaciones operativas y preferencias

> **Estado:** Especificación inicial; decisiones de integración pendientes; sin implementación.
> **Ticket:** [MAP-286](https://matiasmv2005.atlassian.net/browse/MAP-286) · **Fecha:** 2026-11-21 · **Responsable:** Rodrigo Villarroel Ayala.

## Enunciado

Como usuario autorizado de MapIt, quiero recibir, consultar y gestionar notificaciones relevantes para mi actividad para no perder solicitudes, reservas ni cambios operativos.

## 1. Por qué (contexto y fuentes)

Requisitos funcionales confirmados mediante consulta de MAP-286 y MAP-292–299 en Jira el 2026-11-21. El alcance general de roles y tenants se apoya en [use_cases.md](../../docs/roadmap/use_cases.md). Las decisiones identificadas como propuestas en esta carpeta no son criterios confirmados por Jira.

La consola ya tiene una campana decorativa. El transporte STOMP y el outbox permiten avisos de cambios espaciales, pagos y llegada, pero no representan una bandeja durable por destinatario. La nueva bandeja debe recuperar avisos tras recarga y reconexión, sin sustituir eventos de negocio ni correos transaccionales existentes.

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

## 6. Reglas de negocio y seguridad

- **RN-1:** La API opera sobre el destinatario autenticado. No acepta `userId`, `tenantId`, roles, privilegios, destinatarios ni payloads de eventos controlados por el cliente.
- **RN-2:** Otra persona del mismo tenant tampoco puede consultar, contar o marcar los avisos ajenos. Un identificador no visible responde como inexistente, sin revelar pertenencia.
- **RN-3:** Un evento fallido o revertido no produce notificaciones. La entrega puede repetirse; la persistencia y las mutaciones son idempotentes.
- **RN-4:** Listado y contador aplican los mismos filtros de destinatario y autorización vigente. Las consultas son limitadas y el orden es determinista.
- **RN-5:** Marcar leída conserva el primer `readAt`; marcar todas afecta solo las filas visibles y autorizadas en la instantánea de la escritura. Una llegada concurrente posterior sigue no leída.
- **RN-6:** No hay HTML arbitrario, secretos, JWT, datos de pago, contacto del cliente ni cuerpos de petición en avisos/logs. El detalle usa claves de mensaje y referencias mínimas permitidas; cualquier enlace se vuelve a autorizar al abrirlo.
- **RN-7:** Las preferencias solo pueden modificar categorías optativas propias. Intentar silenciar seguridad o enviar categorías/campos desconocidos se rechaza íntegramente antes de escribir.
- **RN-8:** Apagar el centro no cambia autenticación, aprobaciones, reservas, pagos, auditoría ni la generación de hechos. La UI o el broker caídos no deben convertirse en requisitos síncronos para confirmar negocio.
- **RN-9:** OFF, contexto sin evaluar, flag inexistente o evaluación no confiable impiden acceso nuevo al centro y eliminan su estado visible. No se reutiliza un ON de otra sesión/tenant ni se presenta como cero un contador cuyo fetch falló.
- **RN-10:** La autorización backend se aplica aunque el flag esté ON. El canal anónimo de reservas/pagos nunca puede acceder a notificaciones de personal.

## 7. Errores y recuperación esperados

El contrato definitivo reutilizará `Problem` RFC 9457 y respuestas compartidas del OpenAPI. Se requieren `401` sin autenticación, `403` por permisos insuficientes, `404` indistinguible para identificadores no visibles y `400` por entradas inválidas. El código de respuesta del gate OFF y de dependencia no disponible se cerrará antes de publicar el contrato; no se anuncian endpoints operativos en esta etapa.

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

| ID  | Propuesta técnica que debe validarse                                                                                                | Condición para avanzar                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| D-1 | Matriz por evento: permiso efectivo, ámbito, destinatario y categoría; solicitudes de plataforma separadas de operaciones de tenant | Acordar con MAP-238/MAP-257; no asumir que todos los roles reciben todo           |
| D-2 | Inbox en `operations`, puente de identidad en `bootstrap`; canal personal del transporte STOMP existente                            | Confirmar límites sin imports entre módulos y política vigente de identidad       |
| D-3 | Paginación por cursor, contador autorizado, lectura idempotente y snapshot para marcar todas                                        | Cerrar forma pública, límites, errores y pruebas de concurrencia antes de OpenAPI |
| D-4 | Catálogo de categorías, defaults de preferencias, retención y canal de seguridad independiente                                      | Acordar reglas y productores; no prometer eventos inexistentes                    |
| D-5 | Flag release OFF con evaluación por tenant/sesión, fallo cerrado y política de frescura                                             | Compatibilizar generador y adaptadores sin copiar MAP-285 ni cambiar otros flags  |

Esta entrega crea solo la documentación inicial. El contrato OpenAPI del MVP se aplaza de forma explícita: D-1, D-3 y D-4 afectan su semántica y todavía no están cerradas. [plan.md](plan.md) contiene una propuesta de operaciones, no endpoints implementados. No se añaden código, flags, migraciones ni cliente generado y no se declara completada ninguna subtarea funcional.
