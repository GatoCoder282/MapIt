# Plan — HU-6.02 Autogestión de Reserva

## Enfoque

El contexto `reservations` publicará una creación anónima por slugs de tenant y establecimiento. La infraestructura resolverá el tenant global activo, fijará RLS en la transacción y reutilizará los puertos existentes de personas, recursos, solapamiento y bloqueo de HU-5.01. La única diferencia de dominio es que una reserva pública no tiene actor de staff: `created_by` queda `NULL` y la persona nueva se registra sin auditoría de actor.

El cliente público enviará fecha y horas locales; el backend las convertirá a instantes usando la zona IANA del establecimiento, evitando que el navegador dependa de su propia zona horaria.

## Patrones de diseño aplicados

| Patrón              | Dónde                                                           | Por qué aquí                                                         | Alternativa descartada                               |
| ------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| Ports and Adapters  | Puerto público de establecimiento en `reservations-domain`      | Mantiene `reservations` sin importar `spaces` ni el tenant global    | Consultar tablas `spaces` desde application          |
| Application Service | `CreatePublicReservation`                                       | Coordina resolución de tenant, persona y creación en una transacción | Poner la lógica en el controlador                    |
| Reuse of domain     | `CreateReservation.create(...)` compartido con el flujo interno | Evita duplicar validación de recursos, solapamiento y bloqueo        | Copiar las reglas de HU-5.01 en el flujo público     |
| Idempotent upsert   | `PersonRepository.findOrCreatePublic`                           | Evita carreras por email único sin abortar la transacción            | Insertar y reintentar tras una violación de unicidad |
| Pessimistic lock    | `ReservationConcurrencyGuard` sobre `space_element`             | Serializa reservas concurrentes del mismo recurso                    | Consulta previa sin bloqueo                          |
| Projection / DTO    | `PublicReservation` y `PublicReservationResponse`               | Limita la exposición de datos personales y auditoría                 | Serializar la entidad interna                        |

## Contrato API

- Editar primero `packages/api-contract/openapi.yaml`.
- Añadir `POST /public/tenants/{tenantSlug}/establishments/{establishmentSlug}/reservations` con `security: []`.
- Cuerpo: `date`, `startTime`, `endTime`, `spaceElementIds` y `customer { fullName, email, phone }`.
- Respuesta `201`: `PublicReservation` con identificador, establecimiento, elementos, fecha/horas locales, instantes, zona horaria, estado y fecha de creación.
- Errores `400`, `404`, `409` y `500` con Problem Details.
- Ejecutar `pnpm api:lint`, `pnpm api:gen` y `pnpm api:check`.

## Base de datos

- Migración nueva `V19__permitir_reserva_publica_sin_actor.sql`:
  - `ALTER TABLE reservation ALTER COLUMN created_by DROP NOT NULL;`
  - Comentario que documenta `NULL` para reservas públicas anónimas.
- Actualizar `docs/db/mapit.dbml` en el mismo commit.
- No se añaden tablas, índices ni políticas RLS.

## Backend

### Dominio

- `Reservation.createdBy` y `Person.createdBy/updatedBy` pasan a `@Nullable`.
- `Reservation.create(...)` y `Person.register(...)` aceptan actor nullable.
- Añadir `PublicEstablishment` y `PublicReservationRepository.findActiveEstablishment(...)`.

### Aplicación

- Extraer en `CreateReservation` el método compartido de creación para tenant/actor explícitos.
- `Execute` interno conserva `TenantContext` y `ActorContext`.
- `CreatePublicReservation`:
  1. Resuelve tenant y establecimiento activo por slugs.
  2. Convierte fecha y horas locales a instantes con la zona del establecimiento.
  3. Crea o reutiliza la persona por email.
  4. Llama a la creación compartida con actor `null` y validación de estado `AVAILABLE`.
- `PersonRepository` expone `findOrCreatePublic`.

### Infraestructura

- `JdbcPublicReservationRepository` resuelve tenant activo y establecimiento vivo, fijando RLS.
- Reutilizar `JdbcPersonRepository`, `JdbcReservationResourceRepository`, `JdbcReservationAvailabilityRepository`, `JdbcReservationConcurrencyGuard` y `JdbcReservationRepository`.
- `PublicReservationController` bajo `/api/v1/public/**`.
- Errores:
  - `400`: fecha/horas/email inválidos, lista vacía o duplicada, elemento no reservable.
  - `404`: tenant/establecimiento/elemento no visible.
  - `409`: solapamiento, elemento no `AVAILABLE` o conflicto concurrente.
- Añadir tipos RFC 9457 específicos en `ReservationsProblemTypes`.

## Frontend

- Añadir acción “Reservar” a cada elemento de la pantalla de disponibilidad.
- Ruta `/reservar/:tenantSlug/:establishmentSlug/:elementId?date=YYYY-MM-DD`.
- Feature `booking` con `data/`, `model/` y `ui/`.
- Formulario: fecha, hora inicio, hora fin, nombre, email y teléfono.
- Confirmación con ID, fecha, horario y elemento.
- Errores diferenciados: `409` volver a disponibilidad, `400` validación, `404` recurso no disponible, red con reintento.
- Usar cliente generado, Signals, `inject()`, `@if`/`@for` y `STRINGS`.

## Testing

| Nivel        | Qué se prueba                                                                 |
| ------------ | ----------------------------------------------------------------------------- |
| Dominio      | Actor nullable, invariantes de reserva/persona y normalización.               |
| Aplicación   | Resolución pública, zona horaria, reutilización de persona y errores.         |
| Integración  | HTTP anónimo, persistencia, RLS, 400/404/409 y ausencia de escritura parcial. |
| Concurrencia | Dos solicitudes simultáneas producen un `201` y un `409`.                     |
| Frontend     | Store y componente: éxito, validaciones, `400/404/409` y red.                 |
| E2E          | Flujo público desktop/móvil con endpoints mockeados.                          |

## Verificación

- `pnpm fmt`
- `pnpm api:lint && pnpm api:gen && pnpm api:check`
- Tests focalizados de dominio, aplicación, integración y public-web.
- `pnpm check`
- `pnpm be:it` si el entorno lo permite.
- E2E público específico.
- Antes del PR, rebasar sobre `main` y adjuntar evidencia de checks verdes.

## Riesgos

| Riesgo                                               | Mitigación                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| Carrera al crear persona por email                   | `INSERT ... ON CONFLICT DO NOTHING` + select dentro de la transacción       |
| Doble reserva concurrente                            | Bloqueo pesimista ordenado y consulta de solapamiento dentro de la misma tx |
| Fuga de datos entre tenants                          | Resolución por slug, tenant explícito, RLS y pruebas con dos tenants        |
| Conversión horaria incorrecta                        | Fecha/horas locales + zona IANA del establecimiento en el backend           |
| Reserva pública con datos personales en la respuesta | Proyección pública sin `createdBy` ni datos del cliente                     |
