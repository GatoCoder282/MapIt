# Tareas — HU-5.01 Creación de Reserva Interna

## MAP-208 — Entidad Reservation

- [x] Crear `ReservationId`, `PersonId` y `ReservationTimeRange` como value objects.
- [x] Crear `Reservation` con tenant, establecimiento, persona, elementos, intervalo,
      estado inicial y auditoría de creación.
- [x] Rechazar intervalos inválidos y listas de elementos vacías, nulas o duplicadas.
- [x] Implementar la semántica de solapamiento `[inicio, fin)`.
- [x] Cubrir las invariantes con pruebas unitarias sin Spring.

## MAP-209 — Persistencia

- [x] Crear migración Flyway para reservas y asociaciones.
- [x] Añadir índices, restricciones, FKs y RLS forzada.
- [x] Actualizar `docs/db/mapit.dbml` en el mismo commit.
- [x] Probar migración e aislamiento entre tenants.

## MAP-210 — Clientes

- [x] Verificar nuevamente si `Person` existe al comenzar la subtarea.
- [x] Modelar y persistir `Person` si sigue ausente.
- [x] Editar primero el contrato de búsqueda/alta y regenerar clientes.
- [x] Implementar búsqueda normalizada y registro dentro del tenant.

## MAP-211 — Caso de uso

- [x] Definir puertos de personas, recursos, reservas y disponibilidad.
- [x] Implementar `CreateReservation` como transacción atómica.
- [x] Validar pertenencia al tenant y establecimiento sin importar otros módulos.
- [x] Rechazar cualquier solapamiento sin persistencia parcial.

## MAP-212 — Endpoint POST

- [x] Editar primero el contrato OpenAPI de creación y ejecutar `pnpm api:gen`.
- [x] Implementar el controlador generado y autorización de roles.
- [x] Traducir errores a RFC 9457 (`400`, `404`, `409`).
- [x] Cubrir el controlador y el contrato.

## MAP-213 — Cliente en consola

- [x] Crear feature `reservations` sin importar otras features.
- [x] Implementar búsqueda y selección de persona.
- [x] Implementar alta de persona dentro del flujo.
- [x] Cubrir el ViewModel con Vitest.

## MAP-214 — Formulario de reserva

- [x] Implementar selección de intervalo y uno o más elementos.
- [x] Conectar el store al cliente OpenAPI generado.
- [x] Manejar loading, éxito y errores `400`, `404` y `409`.
- [x] Verificar accesibilidad y comportamiento responsive.

## MAP-215 — Integración

- [x] Probar creación válida y asociaciones múltiples con Testcontainers.
- [x] Probar intervalo, cliente, establecimiento, elementos y roles inválidos.
- [x] Probar solapamientos totales, parciales, contenidos y reservas consecutivas.
- [x] Probar aislamiento entre tenants y ausencia de escritura parcial.

## MAP-216 — Concurrencia

- [x] Crear una prueba concurrente reproducible sobre el mismo recurso e intervalo.
- [x] Seleccionar e implementar la garantía transaccional/BD con evidencia técnica.
- [x] Verificar exactamente un éxito y un conflicto determinista.

## Cierre de HU-5.01

- [x] Ejecutar `pnpm check` y dejarlo en verde.
- [x] Marcar todos los criterios de aceptación de `spec.md`.
- [x] Completar las notas de ejecución de cada MAP.
- [ ] Adjuntar evidencias de backend, frontend y Postman al PR.

## Notas de ejecución

### Preparación

- HU-5.01 corresponde a MAP-192 y se divide en MAP-208 a MAP-216.
- `main` se sincronizó con `origin/main` en `cb417b7`; el commit local divergente
  `dc813bc` quedó protegido en `backup/main-local-dc813bc`.
- MAP-208 comienza en `chris799-hub/map-208-crear-entidad-reservation`.

### MAP-208

- `Reservation` se implementó como record inmutable en `reservations-domain`; no importa
  Spring, JPA ni el módulo `spaces`.
- `ReservationId` y `PersonId` impiden confundir identificadores del propio contexto.
- `ReservationTimeRange` concentra la regla `[inicio, fin)` y permite reservas consecutivas
  sin considerarlas solapadas.
- La fábrica fuerza el estado inicial `CREATED`, exige actor autenticado y rechaza listas de
  elementos vacías, nulas o duplicadas.
- Los UUID de establecimiento y elementos se conservan como referencias externas; su
  pertenencia al tenant se validará por puertos en MAP-211.
- Se ejecutaron 12 pruebas unitarias del dominio sin fallos y ArchitectureTest quedó verde.

### MAP-209

- Rama `chris799-hub/map-209-migracion-flyway-reservation`, basada en MAP-208.
- La migración V15 crea `person`, `reservation` y `reservation_space_element`; la tabla
  `person` se crea aquí porque la FK obligatoria de la reserva debe ser válida desde el
  primer arranque. Su dominio y endpoints se implementan en MAP-210.
- Las referencias a persona, establecimiento, actor y elemento usan FKs compuestas con
  `tenant_id`, de modo que ni SQL directo puede asociar datos entre empresas.
- Las tres tablas tienen RLS forzada, índices por tenant y fallo cerrado sin
  `app.tenant_id`.
- PostgreSQL valida el intervalo `starts_at < ends_at` y evita repetir un elemento dentro
  de la misma reserva.
- Cinco pruebas con PostgreSQL 16 verifican migración, RLS bidireccional, fallo cerrado,
  integridad temporal, duplicados y referencias cruzadas entre tenants.

### MAP-210

- Rama `chris799-hub/map-210-entidad-person-clientes`, basada en MAP-209.
- Se confirmó que solo existía la tabla `person` creada por MAP-209; no había entidad,
  puerto, caso de uso ni API para registrar clientes.
- El contrato OpenAPI define `GET /people` y `POST /people`; el cliente TypeScript se
  regeneró desde el contrato sin editar archivos generados.
- `Person` normaliza el nombre, convierte correo a minúsculas, admite contacto opcional y
  concentra las validaciones sin depender de Spring ni de persistencia.
- `PersonService` obtiene tenant y actor exclusivamente de los contextos autenticados y
  detecta correos duplicados por tenant.
- `JdbcPersonRepository` filtra explícitamente por tenant, activa RLS y limita la búsqueda
  normalizada a 20 coincidencias por nombre, correo o teléfono.
- Los endpoints exigen rol ADMIN, MANAGER o STAFF y traducen datos inválidos a `400` y
  correo duplicado a `409` mediante Problem Details.
- Se añadieron siete pruebas unitarias entre dominio y aplicación. `pnpm check` quedó en
  verde, incluidos contrato, 90 pruebas frontend, backend y ArchUnit.

### MAP-211

- Rama `chris799-hub/map-211-caso-uso-creacion-reserva`, basada en MAP-210.
- `CreateReservation` ejecuta en una sola transacción la validación de persona,
  establecimiento, elementos, disponibilidad y persistencia del agregado completo.
- Los puertos `ReservationResourceRepository`, `ReservationAvailabilityRepository` y
  `ReservationRepository` mantienen el módulo desacoplado de `spaces` y de JDBC.
- La proyección `ReservationResource` permite validar establecimiento, tipo reservable y
  estado operativo sin importar clases de otro módulo. Hasta CU-07, `DECOR` es el único
  tipo expresamente no reservable.
- Los adaptadores JDBC aplican tenant explícito y RLS, comprueban solapamientos con la
  fórmula `[inicio, fin)` e insertan reserva y asociaciones dentro de la misma transacción.
- Las pruebas del caso de uso cubren éxito, referencias ajenas o ausentes, establecimiento
  incorrecto, elemento no reservable o fuera de servicio, duplicados y conflicto sin
  escritura parcial.
- `pnpm check` quedó en verde con formato, contrato, frontend, backend y ArchUnit.

### MAP-212

- Rama `chris799-hub/map-212-endpoint-crear-reserva`, basada en MAP-211.
- El contrato OpenAPI incorpora primero
  `POST /establishments/{establishmentId}/reservations`, sus modelos tipados, límites y
  respuestas `400`, `401`, `403`, `404`, `409` y `500`.
- El cliente TypeScript se regeneró desde el contrato y quedó sin drift.
- `ReservationController` transforma la solicitud en el comando del caso de uso y devuelve
  `201` sin exponer `tenantId` ni aceptar estado o auditoría desde el cliente.
- Los errores de referencias ocultas, datos inválidos y solapamientos se traducen a RFC
  9457; el `409` incluye los identificadores de los elementos en conflicto.
- `SecurityConfig` exige ADMIN, MANAGER o STAFF antes de la regla pública temporal de
  establecimientos, evitando que ese prefijo abra accidentalmente la creación de reservas.
- Cinco pruebas del controlador cubren el mapeo exitoso, validación y respuestas `400`,
  `404` y `409`.
- `pnpm check` quedó en verde con contrato sincronizado, 90 pruebas frontend, backend y
  reglas de arquitectura.

### MAP-213

- Rama `chris799-hub/map-213-cliente-reservas-console`, basada en MAP-212.
- Se creó la feature Angular `reservations` con límites `data`, `model` y `ui`, sin importar
  código de otras features.
- `ReservationsApi` encapsula `PeopleService`, generado desde OpenAPI, para buscar y crear
  clientes con tipos compartidos por contrato.
- `ReservationCustomerStore` controla consulta, resultados, selección, borrador de alta,
  estados de carga y mensajes para errores de red, validación y correo duplicado.
- `ReservationCustomerPicker` permite buscar por nombre, correo o teléfono, seleccionar un
  resultado y registrar un cliente sin abandonar el flujo de reserva.
- Todos los textos visibles se añadieron al catálogo central y el componente incluye
  etiquetas, estados anunciables, foco visible y adaptación para pantallas pequeñas.
- Ocho pruebas Vitest cubren búsqueda, selección, precarga del alta, creación, validaciones
  y errores de API.
- `pnpm check` quedó en verde con 99 pruebas frontend (57 de consola, 1 de public-web y 41 de librerías).

### MAP-214

- Rama `chris799-hub/map-214-formulario-reserva`, basada en MAP-213.
- Se añadió la ruta `/reservations/new` y el acceso Reservas al menú de la consola de staff.
- El formulario carga establecimientos y recorre pisos y sectores para presentar únicamente
  elementos reservables; admite seleccionar uno o varios.
- El ViewModel integra cliente, establecimiento, intervalo y elementos con el cliente OpenAPI,
  convirtiendo la hora local según la zona IANA del establecimiento.
- Los errores `400`, `404` y `409` conservan el formulario y muestran mensajes específicos; el
  éxito cierra el flujo y presenta el identificador de la reserva creada.
- Doce pruebas nuevas cubren validaciones, zona horaria, respuestas HTTP, carga jerárquica,
  filtrado y serialización del cuerpo JSON.
- `pnpm check` quedó en verde con 111 pruebas frontend (69 de consola, 1 de public-web y 41 de
  librerías), builds, contrato, backend y ArchUnit.

### MAP-215

- Rama `chris799-hub/map-215-pruebas-integracion-reservas`, basada en MAP-214.
- `ReservationCreationIntegrationTest` recorre la API HTTP completa con JWT, seguridad,
  aplicación, adaptadores JDBC y PostgreSQL 16 mediante Testcontainers.
- Ocho pruebas verifican la creación válida con varias asociaciones, los roles ADMIN,
  MANAGER y STAFF, y el rechazo de solicitudes anónimas o con rol no autorizado.
- Las referencias inválidas o de otro tenant se ocultan como `404`; intervalos, elementos y
  estados no válidos responden `400` sin persistir reservas ni asociaciones parciales.
- Se cubren los cuatro tipos de solapamiento —total, izquierdo, contenido y derecho— y se
  confirma que dos reservas consecutivas sí están permitidas por la semántica `[inicio, fin)`.
- También se prueba que un conflicto entre varios elementos rechaza toda la operación y que
  los JWT, referencias y datos persistidos permanecen aislados entre tenants.
- La clase focalizada pasó sus 8 pruebas, la suite completa `pnpm be:it` y `pnpm check`
  terminaron en verde.

### MAP-216

- Rama `chris799-hub/map-216-concurrencia-reservas`, basada en MAP-215.
- `ReservationConcurrencyGuard` expresa en el dominio la necesidad de serializar reservas
  que comparten elementos sin acoplar el caso de uso a PostgreSQL.
- `JdbcReservationConcurrencyGuard` bloquea las filas de `space_element` con
  `SELECT ... FOR UPDATE`; ordena primero los UUID para prevenir interbloqueos entre
  solicitudes con varios elementos.
- `CreateReservation` toma los bloqueos dentro de su transacción, después de validar los
  recursos y antes de consultar solapamientos. La segunda solicitud espera el commit de la
  primera y entonces detecta el conflicto existente.
- La prueba mantiene un bloqueo inicial controlado, espera hasta comprobar en PostgreSQL que
  ambas solicitudes HTTP están bloqueadas y luego las libera. El resultado fue exactamente
  un `201`, un `409`, una reserva y una asociación persistidas.
- Las 9 pruebas de `ReservationCreationIntegrationTest` y las pruebas unitarias de aplicación
  terminaron sin fallos.
- `pnpm check` quedó en verde con formato, 111 pruebas frontend, builds, contrato, backend y
  reglas de arquitectura.
