# Tareas — HU-6.02 Autogestión de Reserva

## Preparación

- [x] Crear rama `feat/HU-6.02-autogestion-de-reserva` desde HU-6.01.
- [x] Rebasear la base sobre `main`, que ya contiene HU-6.01.
- [x] Crear `spec.md`, `plan.md` y `tasks.md` en orden (el template de `pnpm new:spec` no existe).

## Contrato y base de datos

- [x] Añadir operación POST pública de reserva al OpenAPI.
- [x] Validar y generar el cliente TypeScript desde el contrato.
- [x] Crear migración V19 para permitir `reservation.created_by = NULL`.
- [x] Actualizar `docs/db/mapit.dbml`.

## Backend

- [x] Permitir actor nullable en `Reservation` y `Person`.
- [x] Añadir puerto/proyección de establecimiento público.
- [x] Extraer la creación compartida en `CreateReservation`.
- [x] Implementar `CreatePublicReservation` con conversión de zona horaria.
- [x] Implementar creación idempotente de persona por email.
- [x] Implementar adaptador JDBC de resolución de tenant/establecimiento.
- [x] Implementar controlador público y Problem Details.
- [x] Cubrir con tests de dominio, aplicación e integración.

## Frontend

- [x] Añadir acción “Reservar” en disponibilidad y nueva ruta.
- [x] Crear feature `booking` con API, store y formulario.
- [x] Mostrar confirmación y errores recuperables.
- [x] Añadir cadenas visibles a `STRINGS`.
- [x] Cubrir store/componente con Vitest y flujo E2E.

## Cierre

- [x] Ejecutar `pnpm fmt`, `pnpm api:lint`, `pnpm api:gen`, `pnpm api:check`.
- [x] Ejecutar tests focalizados y `pnpm check`.
- [x] Revisar diff, hacer commit convencional y push a la rama.
- [x] Registrar notas de ejecución y evidencia para el equipo.

## Notas de ejecución

### Preparación

- `main` avanzó a `f087824` e incorporó HU-6.01; la rama de trabajo se rebasó sobre ese estado antes de empezar.
- El ticket Jira exacto de HU-6.02 no estaba disponible en el checkout; queda pendiente enlazarlo cuando se confirme.

### Contrato y datos

- El contrato añade `POST /public/tenants/{tenantSlug}/establishments/{establishmentSlug}/reservations` con `PublicReservationCreateRequest`, `PublicCustomer` y `PublicReservation`.
- La fecha y las horas viajan como valores locales (`YYYY-MM-DD` y `HH:mm`); el backend las convierte con la zona IANA del establecimiento.
- La respuesta pública no incluye `createdBy`, auditoría, datos del cliente ni información operativa interna.
- V19 elimina únicamente el `NOT NULL` de `reservation.created_by`; no toca RLS, índices ni claves foráneas.
- `docs/db/mapit.dbml` refleja la nulabilidad del actor.

### Backend

- `CreateReservation` expone una creación compartida con actor nullable y un flag para exigir estado operativo `AVAILABLE`; el flujo interno conserva su comportamiento y el público responde `409` cuando el elemento ya no está disponible.
- El bloqueo de elementos se hace antes de validar recursos para serializar creación y solapamiento.
- `JdbcPersonRepository.findOrCreatePublic` usa `INSERT ... ON CONFLICT (tenant_id, email)` y recupera la persona viva existente sin sobrescribir sus datos.
- `JdbcPublicReservationRepository` resuelve tenant activo y establecimiento vigente por slug y fija RLS en la misma transacción; el flujo público no depende de `TenantContext`.
- Los Problem Details nuevos son `public-establishment-not-found` y `reservation-unavailable`.

### Frontend

- La disponibilidad enlaza a `/reservar/:tenantSlug/:establishmentSlug/:elementId?date=...`.
- `BookingStore` valida fecha, horario, nombre, email y teléfono; conserva los datos ante errores y permite reintentar.
- `BookingApi` convierte el `Set` que genera OpenAPI para `uniqueItems` en un arreglo real antes de serializar; sin esto el JSON enviaba `spaceElementIds: {}`.
- La confirmación muestra código de reserva, fecha, horario, zona horaria y espacio.

### Verificación

- Tests backend: `pnpm be:test` en verde; integración pública en verde, incluyendo reserva anónima, reutilización de persona, solapamiento, estado no disponible, establecimiento/tenant inválido, payload inválido y concurrencia (un `201`, un `409`, una sola reserva y una sola persona).
- Frontend: `booking-store.spec.ts` cubre envío, validación, `400`, `404`, `409`, error de red y limpieza de errores.
- E2E: `booking.spec.ts` y `availability.spec.ts` en verde para `public-web` y `public-web-mobile` (8 pruebas) contra el dev server local y API mockeada por Playwright.
- Contrato: `pnpm api:gen` y `pnpm api:check` en verde; `pnpm api:lint` válido con las dos advertencias preexistentes del contrato.

### Entorno

- La máquina tenía Node `v25.9.0`, mientras `.nvmrc` exige Node 24. En Node 25 las pruebas de `libs` fallan por `localStorage.clear` no disponible; se ejecutó `pnpm check` con `NODE_OPTIONS=--no-experimental-webstorage` para validar el cambio sin alterar el entorno del repositorio.
- Playwright no tenía navegadores instalados; se instaló Chromium con `pnpm --filter @mapit/e2e exec playwright install chromium` para correr el E2E focalizado.
