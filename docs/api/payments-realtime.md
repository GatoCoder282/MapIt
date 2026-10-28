# Pagos y llegada sobre STOMP

Se reutilizan `/ws`, el simple broker y `realtime_event_outbox`. Cada cambio se inserta en la transacción de negocio; el dispatcher publica después del commit y conserva los reintentos existentes. No se utiliza un transporte adicional.

## Público

CONNECT requiere `X-Reservation-Access`, `tenantSlug`, `establishmentSlug` y `reservationId`. Esta credencial es independiente del JWT del personal y del token del comprobante. El backend comprueba los slugs, el hash de la credencial, su alcance, revocación y caducidad.

Solo se permite SUBSCRIBE a `/topic/reservations/{reservationId}/payments` de esa reserva. SEND y las salas operativas están prohibidos. La autorización se repite antes de entregar cada MESSAGE, incluso para suscripciones ya abiertas. La identidad retenida por sesión se elimina al desconectar; nunca se registra la credencial.

Los eventos `payment.status.changed` y `reservation.checked_in` contienen `eventId`, `eventType`, `schemaVersion: 1`, `occurredAt`, `reservationId`, `paymentId`, `establishmentId` y `status` del pago. No contienen PII, credenciales, QR bancarios ni referencias del comercio. El consumidor vuelve a consultar HTTP; el evento no autoriza ni confirma un pago.

Estados de pago admitidos: `PENDING`, `PENDING_MANUAL_VERIFICATION`, `CONFIRMED`, `FAILED`, `EXPIRED`, `CANCELLED` y `RECONCILIATION_REQUIRED`. `CANCELLED` termina únicamente el intento: no confirma, cancela ni ocupa la reserva. No equivale a `EXPIRED`; una confirmación posterior requiere conciliación. El reintento depende del checkout HTTP y conserva la ventana cotizada.

Public Web respeta `realtime.websocket`, desconecta al salir y reconsulta al reconectar. El comprobante se actualiza en vivo cuando el navegador conserva la capability de checkout; otro navegador con solo el comprobante puede consultar su estado por HTTP.

## Console

Se mantiene CONNECT con JWT y la autorización existente por establecimiento. Los eventos de pago/llegada se publican también en la sala del establecimiento. `RealtimeClient.subscribeEstablishmentPayments()` los expone separados del stream espacial existente. Las actualizaciones de ocupación siguen usando el envelope espacial y la bitácora originales.

La entrega es al menos una vez: los consumidores deben tolerar duplicados. La fuente autoritativa es siempre la consulta HTTP del estado persistido.
