# Corrección del arranque local — 2026-10-25

El log de pnpm dev mostraba FlywayValidateException. La validación directa identificó V21: checksum aplicado 2144903075, archivo modificado -536502515. La base conservaba la primera versión del esquema de acceso a reservas, mientras el archivo había recibido cambios posteriores durante la integración.

Se restauró V21 exactamente al checksum aplicado y se trasladaron los cambios a V22, creada con el generador del repositorio. No se utilizó flywayRepair, no se desactivó la validación y no se borraron tablas ni volúmenes.

V22 completa el esquema de forma incremental, conserva los campos legados y copia sus datos operativos a reservation. Añade el ámbito del establecimiento, auditoría, restricciones e idempotencia, y la referencia de reserva en el outbox. El modelo DBML documenta los campos legados.

Validaciones: migración y validación de la base local, prueba de actualización con registros preexistentes desde V21 y recorrido HTTP de pagos/check-in sobre una base nueva. Se verifica además el arranque real con pnpm dev y respuesta de API, Console y Public Web.

No deben modificarse V21 ni V22 después de aplicarlas. Cualquier cambio siguiente requiere otra migración.
