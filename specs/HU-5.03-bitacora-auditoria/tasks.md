# Tareas — HU-5.03 Bitácora de Auditoría

## MAP-222 — Crear entidad AuditLog inmutable

- [x] Crear el modelo `AuditLog` y tipos cerrados de recurso/evento.
- [x] Definir el puerto transversal de registro y el repositorio de consulta.
- [x] Crear migración Flyway generalizando el histórico de HU-3.01 sin perder datos.
- [x] Añadir índices, RLS y protección contra `UPDATE`/`DELETE` del rol runtime.
- [x] Implementar el adaptador JDBC con filtro explícito por tenant.
- [x] Actualizar `docs/db/mapit.dbml`.
- [x] Cubrir invariantes, persistencia e inmutabilidad con pruebas.

## MAP-223 — Registrar eventos de Reservation y SpaceElement

- [x] Registrar `RESERVATION_CREATED` en la transacción de creación.
- [x] Registrar `SPACE_ELEMENT_STATE_CHANGED` reutilizando el flujo de HU-3.01.
- [x] Integrar `RESERVATION_STATUS_CHANGED` si HU-5.02 ya existe en la rama base.
- [x] Garantizar rollback conjunto cuando falle la auditoría.
- [x] Verificar que no se registren secretos ni datos personales innecesarios.

## MAP-224 — Implementar endpoint de histórico

- [x] Editar primero el contrato OpenAPI y ejecutar `pnpm api:gen`.
- [x] Definir respuesta paginada y filtros tipados.
- [x] Implementar caso de uso y controlador `GET /api/v1/audit-logs`.
- [x] Autorizar exclusivamente a `ADMIN` del tenant.
- [x] Cubrir respuesta, filtros, paginación, `400`, `401` y `403`.

## MAP-225 — Implementar vista de auditoría para Administrador

- [x] Crear feature Angular `audit` sin importar otras features.
- [x] Añadir capa de datos sobre el cliente OpenAPI generado.
- [x] Implementar store de filtros, paginación y estados de carga.
- [x] Crear vista responsive y accesible con textos del catálogo.
- [x] Añadir ruta y navegación visibles solo para `ADMIN`.
- [x] Cubrir el ViewModel con Vitest.

## MAP-226 — Tests de integración de auditoría

- [x] Probar eventos de reserva y `SpaceElement` de extremo a extremo.
- [x] Probar atomicidad y ausencia de eventos huérfanos.
- [x] Probar migración del histórico de HU-3.01.
- [x] Probar aislamiento RLS y filtros explícitos entre dos tenants.
- [x] Probar autorización y ausencia de secretos.
- [x] Probar que el rol runtime no pueda actualizar ni eliminar registros.

## Cierre de HU-5.03

- [x] Ejecutar `pnpm check` y dejarlo en verde.
- [x] Ejecutar `pnpm be:it` y dejarlo en verde.
- [x] Marcar todos los criterios de aceptación de `spec.md`.
- [x] Completar las notas de ejecución de cada MAP.
- [ ] Adjuntar evidencias de backend, frontend y API al PR.

## Notas de ejecución

### Preparación

- Jira define HU-5.03 en MAP-194 y las subtareas MAP-222 a MAP-226.
- HU-5.01 ya está integrada en `origin/main` mediante el PR #36.
- HU-3.01 ya aporta `space_element_state_change`; la historia generalizará esa bitácora en
  lugar de mantener dos fuentes de trazabilidad para el mismo evento.
- La primera rama es
  `feat/christian799-hub/MAP-222-crear-entidad-auditlog-inmutable`, basada en `origin/main`.

### MAP-222

- La especificación fue aprobada por el responsable el 2026-10-22.
- Se creó `audit_log` en V19 porque `origin/main` ya usa V18 para la geometría de plantas y
  sectores.
- La migración conserva el histórico de `space_element_state_change`; la tabla anterior sigue
  disponible hasta que MAP-223 cambie su escritor.
- El modelo admite únicamente combinaciones cerradas de recurso, evento y detalles mínimos. El
  adaptador JDBC exige una transacción activa y fija el tenant para RLS en cada operación.
- Cinco pruebas de integración con PostgreSQL verifican persistencia, aislamiento, actor del mismo
  tenant, uso transaccional y rechazo de `UPDATE`/`DELETE` por el rol runtime.
- `pnpm check` quedó completamente en verde. Antes fue necesario ejecutar `pnpm api:gen` porque el
  cliente generado local estaba desactualizado respecto al contrato ya integrado en `main`; el
  código generado está ignorado y no forma parte del commit.

### MAP-223

- `CreateReservation` registra exactamente un `RESERVATION_CREATED` en su misma transacción con
  estado inicial y establecimiento; no persiste datos del cliente, credenciales ni cuerpos HTTP.
- `UpdateSpaceElementState` registra `SPACE_ELEMENT_STATE_CHANGED` con estado anterior, estado
  nuevo y sector. Los cambios inválidos y las solicitudes sin cambio no generan eventos.
- El histórico de HU-3.01 ahora se consulta desde `audit_log`. V20 realiza una copia final
  idempotente y retira `space_element_state_change`, de modo que queda una sola fuente de
  trazabilidad.
- HU-5.02 todavía no está integrada en la rama base, por lo que no existe un caso de uso donde
  conectar `RESERVATION_STATUS_CHANGED`; el tipo cerrado permanece preparado para esa historia.
- Las pruebas unitarias de reservas, operaciones e infraestructura quedaron en verde. Las suites
  de integración `ReservationCreationIntegrationTest` y `SpaceElementStateIntegrationTest`
  verifican los eventos, la ausencia de escrituras ante errores y el rollback conjunto si falla
  el registro de auditoría.

### MAP-224

- El contrato OpenAPI se editó antes de la implementación y generó `AuditService`, los tipos de
  evento/recurso y la respuesta paginada para el cliente Angular.
- `GET /api/v1/audit-logs` acepta filtros opcionales por recurso, evento, identificador e
  intervalo inclusivo, además de paginación entre 1 y 100 elementos.
- El caso de uso obtiene el tenant exclusivamente del contexto autenticado; el adaptador JDBC
  repite el filtro explícito por `tenant_id` y ordena por `occurred_at DESC, id DESC`.
- `SecurityConfig` autoriza únicamente a `ADMIN`; usuarios anónimos reciben `401` y los roles
  `MANAGER`, `STAFF` y `SUPER_ADMIN` reciben `403`.
- Seis pruebas de integración verifican respuesta y orden, combinación de filtros, paginación,
  aislamiento entre tenants, parámetros inválidos y autorización completa.

### MAP-225

- Se añadió la feature Angular `audit` con separación `data/model/ui`; consume exclusivamente el
  `AuditService` generado desde OpenAPI y no importa otras features.
- El store conserva los filtros por recurso, evento, identificador y fechas al paginar o
  reintentar, y expone estados de carga, vacío, error y autorización denegada.
- La tabla se transforma en tarjetas etiquetadas en pantallas pequeñas, mantiene encabezados
  semánticos y ofrece controles de filtros y paginación accesibles.
- La ruta `/audit`, el acceso del menú y el endpoint quedan reservados a usuarios `ADMIN`; otros
  roles no ven la navegación y el guard evita el acceso directo.
- Se añadieron seis pruebas Vitest del ViewModel para carga, filtros, error, autorización,
  limpieza y paginación. La suite completa compiló la pantalla y dejó frontend, contrato y
  backend en verde después de corregir la advertencia de lint detectada en la primera pasada.

### MAP-226

- Se añadió una prueba de migración real desde V18 que conserva identificador, tenant, actor,
  instante, recurso, estados y sector del histórico de HU-3.01, evita duplicados y confirma la
  eliminación de la tabla anterior.
- La integración de cambio de estado ahora fuerza un fallo controlado al registrar auditoría y
  demuestra que se revierten tanto la operación como el evento, sin escrituras parciales.
- La API se prueba con un identificador real de otro tenant y devuelve una página vacía; también
  se inspecciona la respuesta para confirmar que no expone contraseñas, hashes, JWT, tokens,
  credenciales ni correo del actor.
- Las suites existentes de reservas y `SpaceElement` cubren la creación de eventos desde los
  casos de uso reales. Las pruebas de persistencia cubren RLS y el rechazo de `UPDATE` y `DELETE`
  para el rol runtime.
- Las tres suites específicas quedaron en verde y `pnpm be:it` completó toda la integración del
  backend correctamente en 10 min 22 s.
- `pnpm check` terminó completamente en verde: formato, lint, tipos, pruebas y build de frontend,
  contrato API y backend con ArchUnit.
