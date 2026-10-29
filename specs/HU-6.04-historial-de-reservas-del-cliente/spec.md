# HU-6.04 — Historial de Reservas del Cliente

> **Estado:** implementada y verificada (T01–T09); decisiones funcionales aprobadas por el responsable funcional del proyecto · **Prioridad:** Medium · **Sprint propuesto:** 6 · **Alcance:** CU-18 (`docs/roadmap/use_cases.md`). Ticket Jira confirmado por el responsable: MAP-240; no se modifica Jira.

## Enunciado y contexto

Como cliente final, quiero consultar mis reservas próximas y pasadas desde «Mis reservas» en el portal público, para conocer sus fechas y estados sin disponer de una cuenta de staff. Actor: la persona (`person`) asociada a una reserva de un tenant; el acceso al correo registrado acredita su identidad durante una sesión breve.

**HU-6.02 ya está implementada:** `CreatePublicReservation` y `PublicReservationController` permiten reservar anónimamente; `JdbcPersonRepository.findOrCreatePublic` reutiliza la persona viva por correo normalizado dentro del tenant y la reserva guarda `reservation.person_id`. V19 hace `created_by` nullable; la respuesta pública no crea sesión. `PublicReservationIntegrationTest` verifica el vínculo. El listado `GET /api/v1/reservations` es de staff y no filtra por persona (`ListReservations`, `SecurityConfig`). Ninguna de estas funcionalidades se cambia en esta HU. HU-6.03 puede avanzar en paralelo sin depender de un webhook de pago.

## Alcance y precondiciones

- Existe una `person` viva con correo registrado en el tenant activo; el cliente controla **esa** bandeja de correo. No se crea cuenta, contraseña ni perfil público. Una persona sin correo no puede autoacceder al historial con este mecanismo; la búsqueda por nombre o teléfono no sustituye la verificación.
- El cliente solicita desde `/mis-reservas/:tenantSlug` un **enlace temporal de un solo uso** enviado a ese correo. La respuesta de solicitud no revela si el correo, persona o tenant existe. Al abrirlo, el portal intercambia el secreto por una credencial opaca de lectura, limitada a esa persona y tenant y con expiración corta. El secreto del enlace queda invalidado en ese intercambio.
- Solo con credencial vigente se consultan las reservas de la persona, tanto las creadas por HU-6.02 como las registradas por staff para ella. El historial se divide en «Próximas» y «Pasadas», muestra estados reales y ofrece páginas sucesivas, vacío, carga, error y reintento.
- Postcondición: lectura sin modificar reservas ni su estado; al expirar o revocarse la credencial se elimina la vista anterior y se solicita otra verificación del correo. «Salir» revoca la credencial en el servidor.

## Flujo principal

1. El cliente abre «Mis reservas» con el slug público del tenant, escribe su correo y solicita acceso. La respuesta es neutra incluso si no existe persona asociada.
2. Si el tenant está activo y existe `person` viva con ese correo, se envía **a ese correo** un enlace de corta duración. El cliente abre el enlace; el portal elimina inmediatamente el secreto de la URL y lo intercambia una vez por una credencial temporal de historial.
3. El portal solicita las páginas de «Próximas» y «Pasadas» con la credencial. El backend resuelve el tenant por slug y verifica que la credencial corresponda a ese tenant y a una persona viva. No toma identidad del correo ni de un identificador enviado en la consulta.
4. Se muestran reservas en ambos periodos, su estado persistido, establecimiento, elementos y horario en la zona del establecimiento. Cada sección admite «Cargar más» sin mezclar resultados.

## Reglas de negocio

- **Propiedad:** la reserva pertenece a `reservation.person_id`, no a `created_by` (que en HU-6.02 es nulo y en reservas internas identifica al staff). Un mismo correo puede existir en dos tenants: la verificación en A jamás autoriza las reservas de B.
- **Periodo (aprobado por el responsable funcional del proyecto):** `starts_at`/`ends_at` son instantes UTC; el intervalo es semiabierto `[starts_at, ends_at)` (V17, `ReservationTimeRange`). «Próximas» si `ends_at > asOf`; «Pasadas» si `ends_at <= asOf`. `asOf` lo fija el servidor en la primera carga y se conserva en las páginas de esa carga; al actualizar se obtiene uno nuevo. Una reserva en curso sigue en «Próximas»; igualdad exacta pertenece a «Pasadas». Ni navegador ni estado de reserva deciden la sección.
- **Estados (aprobado por el responsable funcional del proyecto):** mostrar siempre el valor almacenado con etiqueta clara. `ReservationStatus`/V17 admiten `CREATED`, `CONFIRMED`, `ACTIVE`, `RELEASED`, `CANCELLED`; hoy `Reservation.create` solo crea `CREATED` y no se ha encontrado una transición de reserva implementada. Una `CANCELLED` futura permanece en «Próximas» por el instante de fin y muestra claramente «Cancelada»; clasificación temporal y estado son independientes.
- **Horario (aprobado por el responsable funcional del proyecto):** presentar los instantes en la zona IANA **actual** de `establishment.timezone`, incluida una reserva que cruce medianoche local o cambie de horario de verano. No se añade snapshot de zona en esta HU: si el establecimiento cambia de zona tras la reserva, puede cambiar su representación local. Limitación conocida aceptada para esta historia.

## Alternativas y excepciones

| Situación                                                                                  | Resultado esperado                                                                                                                           |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Correo, persona o tenant desconocido/inactivo                                              | Misma confirmación neutra de solicitud válida; no se entrega enlace ni historial. Formato inválido puede dar `400` sin consultar existencia. |
| Enlace inválido, consumido, de otro tenant o caducado                                      | Intercambio rechazado sin datos; se permite solicitar otro enlace.                                                                           |
| Falta credencial, caducó, fue revocada, pertenece a otro tenant o se presenta JWT de staff | Consulta rechazada sin información ajena; se vuelve al paso de acceso cuando proceda.                                                        |
| Cliente sin reservas en una sección                                                        | `200` con lista vacía y mensaje contextual, distinto de error.                                                                               |
| Fallo SMTP                                                                                 | Solicitud respondida con confirmación neutra; si no llega el correo, el cliente puede solicitar otro enlace. No se revela si existe cuenta.  |
| Fallo HTTP o de red                                                                        | La vista informa de indisponibilidad de forma recuperable y permite reintentar sin exponer secretos.                                         |
| «Salir» o cambio de tenant                                                                 | Revocar la sesión vigente en el servidor y borrar credencial/resultados del navegador; una credencial para A no funciona en B.               |

## Seguridad y aislamiento

- El enlace acredita posesión del correo; saber el email, un UUID de reserva o el slug no autoriza. Se generan secretos opacos impredecibles; solo se guardan sus hashes y no se registran en logs. El secreto del enlace no aparece en respuestas públicas; el de sesión se entrega **solo** al canjearlo. El enlace se consume atómicamente una vez y la credencial de lectura es **distinta**, limitada, caduca y revocable del lado del servidor; no equivale a una cuenta o JWT de cliente. El enlace consumido nunca sirve como credencial de lectura.
- Para cada GET, el servidor exige la cabecera de sesión antes de leer reservas. El slug sirve **solo como pista de búsqueda**: se resuelve contra `tenant.slug` y fija RLS para localizar la fila de sesión, pero no acredita identidad. Tras validar hash, caducidad, no revocación y tenant/persona activos, se obtienen `tenantId` y `personId` **exclusivamente de la fila validada**. Solo entonces se consulta `WHERE reservation.tenant_id = ? AND reservation.person_id = ?`, en la misma transacción con `SET LOCAL app.tenant_id`; RLS de V1/V17 falla cerrada sin tenant. Sin sesión válida no se ejecuta SELECT de reservas.
- El GET no acepta `customerId`, `personId`, `tenantId` ni email arbitrario como autoridad. No expone `personId`, correo, teléfono, `createdBy` o datos de staff. La credencial de cliente no habilita ningún endpoint de staff.
- Peticiones de enlace limitadas por origen y por tenant/correo, sin revelar existencia de persona en el cuerpo o estado de una solicitud válida; los tiempos del envío SMTP requieren mitigación. Como política **aprobada por el responsable funcional del proyecto, centralizada y configurable**: enlace 15 min, sesión 30 min, hasta 3 solicitudes por persona/tenant y 10 por IP cada 15 min. El límite por IP responde `429` independientemente de la existencia del correo. `public-web` conserva la credencial solo en memoria, sin `localStorage` ni `@mapit/auth`; se envía únicamente al GET del historial y a la revocación explícita, nunca a rutas de staff. Se borra al expirar o salir/cambiar de tenant; si falla la revocación remota, se borra localmente y el servidor la invalida al vencer. El secreto del enlace se transmite al servidor solo en el cuerpo del intercambio, nunca como parámetro de API. Ni enlace ni sesión aparecen en URLs de consulta, cabeceras de logging o mensajes de error.

## Criterios de aceptación verificables

- [x] **CA-1:** Dado un cliente que verificó el correo de `person` A, cuando consulta «Mis reservas», entonces ve solo las reservas de A en su tenant, incluidas las creadas por HU-6.02 y las registradas por staff para A.
- [x] **CA-2:** Dadas dos personas del mismo tenant, cuando la primera envía identificadores ajenos o intenta leer el historial de la segunda, entonces no recibe sus reservas y no puede elegir propietario en la API.
- [x] **CA-3:** Dado el mismo correo en tenants A y B, cuando se verifica en A, entonces no se ven reservas de B; sin contexto de tenant en PostgreSQL la consulta devuelve cero filas.
- [x] **CA-4:** Dado acceso anónimo, enlace caducado/usado, credencial inválida/expirada/revocada/de otro tenant o JWT de staff, cuando se intenta leer el historial, entonces se rechaza sin datos; un enlace válido solo se intercambia una vez y «Salir» invalida la sesión en el servidor.
- [x] **CA-5:** Dadas reservas que finalizan antes, exactamente en y después de `asOf`, cuando se muestran, entonces solo la última está en «Próximas», incluso si una reserva sigue en curso o está cancelada.
- [x] **CA-6:** Dadas reservas con cada uno de los cinco valores persistibles de `ReservationStatus`, cuando se muestra el historial, entonces se presenta el estado verdadero con su etiqueta, sin presuponer transiciones implementadas.
- [x] **CA-7:** Dado un cliente sin reservas, cuando consulta ambas secciones, entonces ve estados vacíos, no errores; si hay páginas adicionales, «Cargar más» conserva y ordena los resultados sin mezclarlos.
- [x] **CA-8:** Dada una reserva de `America/La_Paz` vista desde un dispositivo en otra zona, cuando se muestra su horario, entonces usa la zona del establecimiento y refleja ambos días si atraviesa medianoche.
- [x] **CA-9:** Dado fallo de consulta o credencial vencida, cuando se carga el historial, entonces se muestra error recuperable o el acceso por correo, respectivamente, sin dejar datos de otra sesión visibles.
- [x] **CA-10:** Dado el flujo completo, cuando se ejecutan tests de integración con PostgreSQL/RLS, unitarios/Vitest y un E2E público, entonces quedan cubiertos verificación temporal, cliente/tenant, estados, fechas, vacíos y errores.

## Exclusiones y aprobación funcional

- Sin cuenta de cliente, contraseña, login de staff, pagos/webhook, cancelación, cambio de estado ni modificaciones al POST o reglas de HU-6.02. La verificación de correo para lectura forma parte de **esta** HU, no es una dependencia pendiente de HU-6.02.
- **Aprobadas por el responsable funcional del proyecto (T01):** `CANCELLED` futura en «Próximas» cuando `ends_at > asOf`, con etiqueta «Cancelada»; clasificación temporal independiente del estado; zona IANA actual de `establishment.timezone` sin snapshot histórico (limitación conocida: un cambio posterior altera la representación local); Magic Link de un uso y credencial opaca diferente, sin cuentas, contraseñas, JWT, roles ni filtros nuevos; caducidades 15/30 minutos; límites configurables de 3 solicitudes por persona/tenant y 10 por IP cada 15 minutos; solicitud válida con respuesta `202` neutra aun si el correo no existe o SMTP falla. Los fallos operativos se registran sin secretos ni PII innecesaria. Esta aprobación no se atribuye al equipo ni a Jira.
