# Comprobante y check-in: preparación independiente

## Entrega actual

`ReceiptToken` genera 32 bytes de `SecureRandom`, codifica base64url canónico sin padding y permite persistir únicamente SHA-256. `toString()` oculta el valor. La comparación usa `MessageDigest.isEqual` sobre hashes de tamaño fijo. La validación estricta evita variantes no canónicas, padding y entradas enormes.

`ReceiptCredential` asocia hash, tenant, reserva, emisión, expiración y revocación irreversible. La ventana de validez es `[issuedAt, expiresAt)`. La comprobación de tenant/reserva no sustituye la consulta autorizada al backend ni la política de pago. No se ha creado tabla, endpoint, comprobante pagado, QR bancario ni segunda máquina de estados.

## Integración requerida antes de emitir

1. La composición de bootstrap debe consultar una reserva actual mediante un puerto de Reservations y verificar `CONFIRMED` y la política de anticipo satisfecha con Payments. No unir módulos directamente ni actualizar tablas de otro contexto desde Payments.
2. Solo después generar la credencial y persistir su hash en una transacción con `tenant_id NOT NULL`, FK compuesta, índice `(tenant_id,id)`, unicidad del hash y RLS. El token aparece una sola vez en un enlace HTTPS de origen configurado; no se escribe en logs, auditoría ni métricas. Deben redactarse también URL/query y request bodies en los logs HTTP.
3. Una consulta pública debe devolver información mínima y resolver siempre datos actuales. Aplicar rate limiting y errores uniformes para token inválido, revocado o expirado. Nunca incluir datos personales, cuentas ni JWT en el QR.
4. La reemisión rota el token revocando la credencial anterior de forma atómica. La fecha de expiración depende del ciclo de reserva y de la ventana temporal aún no definida por vertical. No se inventa un TTL fijo para hoteles o turnos.

## Orquestación futura de llegada

El endpoint de check-in será autenticado. El scanner solo presenta token; el backend exige permiso de operación para tenant **y establecimiento**. Un UUID visible no sustituye la credencial. Se requiere canal de entrada manual accesible, permisos de cámara, HTTPS y biblioteca de escaneo mantenida cuya licencia se evalúe al implementar la pantalla.

La aplicación de Reservations debe bloquear la reserva y todos sus elementos en orden estable, con el guard existente o un puerto equivalente; recargar estados tras adquirir bloqueos; excluir la propia reserva en la comprobación de no-superposición; verificar política de pago, cancelación, asignación y ventana de llegada. Para hotel, preservar el rango de estadía y no tratarlo como un turno de restaurante. Las reservas multi-elemento deben validar todo antes de mutar nada.

La transición a `ACTIVE` y los cambios operativos a `OCCUPIED` deben ejecutarse consistentemente mediante los casos de uso/puertos existentes y wiring de bootstrap. Reusar la máquina operativa; no añadir `CLAIMED`. El repositorio operacional actual carece de bloqueo/comparación del estado anterior: debe corregirse antes de reutilizarlo para concurrencia de llegada. Si no se puede compartir la transacción, definir compensación/outbox antes de habilitar la acción, sin permitir ocupaciones parciales.

Un identificador idempotente y la restricción única del check-in por reserva permiten que dos operadores obtengan el mismo resultado sin duplicar ocupación. Persistir actor, instante, establecimiento y lista de elementos. Registrar `CHECKED_IN` en auditoría y los eventos de reserva/elementos en la outbox existente dentro de la transacción; publicar después del commit. El segundo escaneo consulta el estado actual.

## Bloqueos verificables

- HU-6.02: no existen creación pública ni credencial de autogestión.
- HU-5.02: enum disponible, pero no transición persistente de reserva.
- Política de precios, anticipo, moneda y ventana de llegada sin contrato.
- Permisos por establecimiento incompletos; compartir tenant no basta.
- Realtime actual es de staff y solo representa eventos de elementos; no abrirlo al público.

## Pruebas preparadas

`ReceiptTokenTest`: 32 bytes, sintaxis, unicidad de una muestra, hash consistente, redacción de `toString`, manipulación, otra credencial, padding, whitespace, sintaxis y bits de relleno no canónicos, hash corrupto.

`ReceiptCredentialTest`: instante de emisión, límite exclusivo de expiración, fecha previa a emisión, tenant/reserva incorrectos, UUID sin token, revocación idempotente y metadatos inválidos.

Comando para el coordinador: `node tools/scripts/gradle.mjs :modules:payments:payments-domain:test --tests "com.mapit.payments.domain.receipt.*"`. No se ejecutó Gradle en paralelo con otros agentes. Estas pruebas no son evidencia de emisión, comprobante pagado o check-in integrados.
