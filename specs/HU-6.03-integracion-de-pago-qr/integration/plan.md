# Plan de integración

## Contratos consolidados

Response PublicReservation añade accessToken/accessExpiresAt. Header público X-Reservation-Access.

- GET /public/establishments?query=: catálogo de id,name,type,address,tenantSlug,establishmentSlug,timezone. Lista acotada50.
- GET/PUT /establishments/{establishmentId}/payment-policy (ADMIN): enabled,currency,depositAmount,totalAmount(nullable),paymentWindowMinutes(5..120). Sin configurada GET404.
- GET /public/tenants/{tenantSlug}/establishments/{establishmentSlug}/reservations/{reservationId}/checkout headerX-Reservation-Access.
- POST mismo /payments: methodId,requestId UUID (sin importe).
- POST mismo /payments/{paymentId}/simulate: outcome(CONFIRMED|FAILED|EXPIRED),eventId opcional; solo mock dev/test.
- POST /public/payments/mock/webhook: bytesJSON firmados, X-Mock-Timestamp y X-Mock-Signature.
- POST /payments/{paymentId}/verify (ADMIN): bankReference.
- POST mismo checkout-reserva /receipt: genera credencial nueva sin revocar enlaces anteriores, requiere pagoCONFIRMED y reservaCONFIRMED/ACTIVE.
- GET /public/tenants/{tenantSlug}/establishments/{establishmentSlug}/receipts/{token}: recibo mínimo actual.
- POST /establishments/{establishmentId}/check-ins/lookup y /check-ins (ADMIN/STAFF): token; llegada valida ventana desde30min antes hasta endsAt, idempotente, sin override implícito.

## DTO de pago compartidos

PublicCheckout: reservation(ReservationCheckout), available:boolean, unavailableReason:nullable string, currency:nullable string, amount:nullable decimal-string,totalAmount:nullable decimal-string,paidAmount:decimal-string,balanceAmount:nullable decimal-string,methods:PublicPaymentMethod[],payment:PaymentAttempt|null.
ReservationCheckout: id,establishmentId,establishmentName,tenantSlug,establishmentSlug,startsAt,endsAt,timezone,status,spaces:[{id,name,floor,sector,state}]. Sin persona/email.
PublicPaymentMethod: id,displayName,provider,verification,staticQrImage nullable.
PaymentAttempt: id,status,provider,amount,currency,totalAmount nullable,paidAmount,expiresAt,externalReference (no secretos).
PaymentPolicy: enabled,currency,depositAmount,totalAmount(nullable),paymentWindowMinutes.
PaymentReceipt: token (solo emisión),url (solo emisión),reservation,payment,paidAmount,currency,totalAmount nullable,balanceAmount nullable,checkIn(NOT_CHECKED_IN|CHECKED_IN),expiresAt.
CheckInDetails: receipt(PaymentReceipt sin emitir token nuevo),audit nullable {actorId,occurredAt,establishmentId,spaceIds[]}.
Todos importes JSON son strings decimales exactos; backend es fuente de verdad.

## Propiedad

A: exclusivamente modules/reservations y modules/operations (consulta/transición/capabilities/catálogo/concurrencia/auditoría); no controladores de pago/check-in (bootstrap principal orquesta check-in).
B: exclusivamente modules/payments (políticas,intentos,recibos,webhook/simulador,servicios/puertos/JDBC). Main OpenAPI/migraciones/bootstrap/seguridad/shared realtime/libs realtime/E2E.
C: ambas apps frontend excepto paquetes y generado; arreglarHU602 y adaptar pantallas a API real, preservar preview y diseño. Principal generará TS antes de capaHTTP.

## Puertos

Reservations expone servicio PublicReservationAccess: issue(reserva ya creada),authorize(slugs,id,token),read(TenantId,reservationId),confirm(TenantId,id,paymentId),checkIn/transition internos. Proyección propia con slugs/ubicación actuales; bootstrap mapea a puerto propio de Payments. Operations conserva UpdateSpaceElementState+outbox; bloquear sus elementos en orden dentro transacción de check-in.
PaymentService.start overload con tenant explícito, motor original preservado. Confirmación vinculada paymentId único en reserva. Política por establecimiento se lee en Payments, snapshot persistido por reserva/intentos, nunca quote desde browser.

## Patrones de diseño aplicados

| Patrón                  | Por qué aquí                                     | Alternativa descartada     |
| ----------------------- | ------------------------------------------------ | -------------------------- |
| Capability con hash     | Anónimo con acceso restringido                   | UUID/email como contraseña |
| Puertos y bootstrap     | Mantener límites entre módulos                   | Imports cross-context      |
| Snapshot y unicidad     | Importe backend y reintento consistente          | Montos cliente             |
| Bloqueo ordenado/outbox | Atomicidad, idempotencia, eventos después commit | Estado paralelo en Angular |

## Migraciones

Renumerar V19 local Payments a V20; V19 oficial intacta. Main crea V21 para acceso/capabilities,política,snapshot,recibos,auditoría de reservas y soporte pago/outbox según columnas acordadas con workers.
