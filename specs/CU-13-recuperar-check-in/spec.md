# Corrección de cobro y check-in — CU-13 / CU-17

Autorizada por el pedido de auditar e implementar la corrección del 2026-10-28.

## Problema y evidencia

La reserva de la captura está CONFIRMED, su pago está CONFIRMED, el espacio está
AVAILABLE y no hay reservas activas solapadas. La base local aplicó pagos como
V20–V28; tras integrar main esos mismos scripts están en V23–V31, con checksums
idénticos. Faltan las migraciones actuales V20–V22, incluida audit_log. Flyway
rechaza el arranque. Los frontends del log tampoco arrancan por puertos ocupados.
El adaptador de recepción clasifica cualquier HTTP no reconocido, incluidos
500 y fallos de conexión, como conflicto de llegada.

## Criterios de aceptación

- Errores de red/servidor no se presentan como incumplimiento de la reserva.
- Un 409 conserva su significado de conflicto de negocio.
- La recuperación local verifica cada script/checksum antes de modificar el historial,
  crea un respaldo completo y deja que Flyway aplique las migraciones pendientes.
- Se preservan pagos, reservas, credenciales y bitácora previa; no se vuelve a cobrar
  ni se registra la llegada real del cliente como parte del diagnóstico.
- Una prueba HTTP/PostgreSQL confirma pago, check-in idempotente, ocupación y auditoría.

Sin cambios de contrato, reglas de horario, autorización o aislamiento tenant.
