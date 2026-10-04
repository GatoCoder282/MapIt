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

- [ ] Definir puertos de personas, recursos, reservas y disponibilidad.
- [ ] Implementar `CreateReservation` como transacción atómica.
- [ ] Validar pertenencia al tenant y establecimiento sin importar otros módulos.
- [ ] Rechazar cualquier solapamiento sin persistencia parcial.

## MAP-212 — Endpoint POST

- [ ] Editar primero el contrato OpenAPI de creación y ejecutar `pnpm api:gen`.
- [ ] Implementar el controlador generado y autorización de roles.
- [ ] Traducir errores a RFC 9457 (`400`, `404`, `409`).
- [ ] Cubrir el controlador y el contrato.

## MAP-213 — Cliente en consola

- [ ] Crear feature `reservations` sin importar otras features.
- [ ] Implementar búsqueda y selección de persona.
- [ ] Implementar alta de persona dentro del flujo.
- [ ] Cubrir el ViewModel con Vitest.

## MAP-214 — Formulario de reserva

- [ ] Implementar selección de intervalo y uno o más elementos.
- [ ] Conectar el store al cliente OpenAPI generado.
- [ ] Manejar loading, éxito y errores `400`, `404` y `409`.
- [ ] Verificar accesibilidad y comportamiento responsive.

## MAP-215 — Integración

- [ ] Probar creación válida y asociaciones múltiples con Testcontainers.
- [ ] Probar intervalo, cliente, establecimiento, elementos y roles inválidos.
- [ ] Probar solapamientos totales, parciales, contenidos y reservas consecutivas.
- [ ] Probar aislamiento entre tenants y ausencia de escritura parcial.

## MAP-216 — Concurrencia

- [ ] Crear una prueba concurrente reproducible sobre el mismo recurso e intervalo.
- [ ] Seleccionar e implementar la garantía transaccional/BD con evidencia técnica.
- [ ] Verificar exactamente un éxito y un conflicto determinista.

## Cierre de HU-5.01

- [ ] Ejecutar `pnpm check` y dejarlo en verde.
- [ ] Marcar todos los criterios de aceptación de `spec.md`.
- [ ] Completar las notas de ejecución de cada MAP.
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
