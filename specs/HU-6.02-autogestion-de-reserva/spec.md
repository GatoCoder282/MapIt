# HU-6.02 — Autogestión de Reserva

> **Estado:** Implementada, pendiente de PR · **Ticket:** HU-6.02 (MAP por confirmar) · **Epic:** E06 — Portal Público

## Enunciado

Como cliente final, quiero reservar un espacio disponible desde la vista pública ingresando mis datos, para asegurar mi lugar sin contactar al establecimiento.

## Contexto

HU-6.01 entregó la consulta anónima de disponibilidad por tenant, establecimiento y fecha. Esta historia completa el primer flujo público de reserva: el cliente elige un elemento disponible, indica fecha y horario local y registra sus datos. El backend resuelve el tenant por el slug público, valida las reglas de reserva de HU-5.01 y persiste la reserva sin exigir autenticación de staff.

## Alcance

- Endpoint anónimo `POST /public/tenants/{tenantSlug}/establishments/{establishmentSlug}/reservations`.
- Pantalla pública de reserva enlazada desde la disponibilidad.
- Reutilización de las reglas de creación, solapamiento, bloqueo y aislamiento de HU-5.01.
- Registro o reutilización del cliente por email dentro del tenant.
- Confirmación pública con identificador, fecha, horario y elemento reservado.
- Representación explícita de una reserva anónima: `reservation.created_by = NULL`.

Fuera de alcance: pagos/QR (CU-17), historial del cliente (CU-18), cancelación o cambio de estado, notificaciones por correo y búsqueda de disponibilidad por intervalo.

## Criterios de aceptación

- [x] **CA-1:** Dado un tenant y establecimiento activos, un elemento `AVAILABLE` y datos válidos, cuando un cliente anónimo envía una reserva, entonces la API responde `201`, persiste la reserva en estado `CREATED` y no exige JWT.
- [x] **CA-2:** Dada la misma solicitud, cuando se inspecciona la fila persistida, entonces `reservation.created_by` es `NULL` y la persona nueva también tiene auditoría de creación nula.
- [x] **CA-3:** Dado un email ya registrado en el tenant, cuando se crea la reserva pública, entonces se reutiliza la persona viva existente sin crear duplicados ni sobrescribir sus datos.
- [x] **CA-4:** Dado un elemento con una reserva vigente que se solapa con el intervalo solicitado, cuando se intenta reservar, entonces responde `409` y no se persiste ninguna reserva, asociación ni persona nueva.
- [x] **CA-5:** Dado un elemento que ya no está `AVAILABLE`, cuando se intenta reservar, entonces responde `409` sin escribir datos.
- [x] **CA-6:** Dado un tenant, establecimiento o elemento inexistente, suspendido, eliminado o ajeno, cuando se intenta reservar, entonces responde `404` sin revelar la existencia en otro tenant.
- [x] **CA-7:** Dada una fecha, hora, email o lista de elementos inválida, cuando se envía la solicitud, entonces responde `400` con Problem Details y no ejecuta una escritura parcial.
- [x] **CA-8:** Dadas dos solicitudes concurrentes para el mismo elemento e intervalo, cuando se procesan, entonces solo una responde `201` y la otra `409`.
- [x] **CA-9:** Dado el formulario público, cuando la API acepta la reserva, entonces se muestra la confirmación; ante `400`, `404`, `409` o error de red se conservan los datos útiles y se ofrece la acción adecuada.
- [x] **CA-10:** Dada la confirmación, entonces solo se muestran datos de la reserva y del elemento, sin información operativa interna ni datos de otros clientes.

## Notas de seguridad y datos

- La URL aporta `tenantSlug` y `establishmentSlug`; el cuerpo nunca acepta `tenantId`, `status`, `createdBy` ni auditoría.
- El adaptador resuelve el tenant global activo por slug y fija RLS dentro de la misma transacción.
- La respuesta no incluye `createdBy` ni datos personales del cliente.
- Los elementos se validan contra el tenant y establecimiento resueltos por el servidor.
- El endpoint queda bajo `/api/v1/public/**`, ya permitido por `SecurityConfig`.
- `TenantContext` no se usa en el flujo público porque su implementación actual cae al tenant `demo` cuando no hay JWT.

## Supuestos de producto

- `fullName` y `email` son obligatorios; `phone` es opcional.
- Si el email ya existe entre las personas vivas del tenant, se reutiliza esa persona.
- La reserva pública usa una fecha y un horario local del establecimiento; el backend convierte a instantes con la zona IANA configurada.
- El intervalo debe iniciar y terminar el mismo día y cumplir `inicio < fin`.
- HU-6.01 filtra por día completo; un elemento con otra reserva ese día no aparece, aunque el horario elegido esté libre. El backend igualmente valida el intervalo exacto.

## Impacto multi-tenant

- No se crean tablas nuevas.
- La migración V19 permite `reservation.created_by = NULL` para reservas públicas anónimas; no altera FKs, RLS ni índices.
- Todas las consultas y escrituras filtran explícitamente por `tenant_id` y activan RLS.
- Las pruebas cubren aislamiento entre dos tenants y fallo cerrado sin `app.tenant_id`.
