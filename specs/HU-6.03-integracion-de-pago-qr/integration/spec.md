# Integración real HU-6.02 / HU-6.03

Solicitud vigente: integrar main (a0f0c03, HU-6.02) preservando trabajo y completar faltantes para conectar portal público real. Se autoriza backend necesario; no despliegue, push ni proveedor bancario real.

## Criterios

- Reserva pública real reutiliza reglas/no-superposición y devuelve credencial opaca256bits una vez, hash persistido, vinculada a tenant/local/reserva y caducidad.
- Cambiar ámbito o reiniciar formulario cancela/ignora respuestas obsoletas y no duplica submit.
- Catálogo público real solo expone establecimientos activos sin ratings/cupos inventados; búsqueda funcional.
- Checkout real con slugs+X-Reservation-Access, nunca UUID como credencial ni fallbacktenantdemo. Cabeceras no-store/no-referrer.
- ADMIN configura política monetaria fija por establecimiento: anticipo positivo, moneda, total opcional >=anticipo. Sin política habilitada no se cobra ni inventa monto.
- Intentos congelan importes backend, requestId idempotente y snapshot entre reintentos. Webhook válido confirma una sola vez; segundo cobro o ingreso tardío/cancelado a conciliación.
- Mock solo dev/test opt-in; simulación deriva datos persistidos y llama HTTP webhook firmado; cliente no proporciona importe/comercio.
- Reserva solo se confirma mediante transición propia válida, nunca SQL desde Payments. Check-in separado de pago.
- Recibo con token independiente hash, solo pago y reserva confirmados; resolución tenant por slug público, datos actuales sin PII; escaneo staff autenticado valida tenant/local/ventana/pago y ocupa todos los elementos atómicamente con auditoría/outbox existentes.
- Realtime conserva infraestructura STOMP/outbox; acceso público limitado a su reserva, sin salas staff abiertas.
- Mocks frontend siguen opt-in explícito; modo normal usa APIs reales y errores reales.

## Política documentada

Anticipo fijo por reserva configurado ADMIN (sin valor monetario predeterminado). Total opcional: no mostrar saldo/total cuando desconocidos. Configuración de ventana de pago por política, predeterminada30min solo después de habilitar política. Reservas públicas sin cobro no se confirman automáticamente. No ampliar HU602 a tarifas por elemento/estadías mientras no exista política de vertical.

## Aislamiento

Nuevas tablas con tenant_id NOT NULL, índice(tenant_id,id), RLS FORCE, FK compuestas. Slugs resueltos en servidor; hashes credenciales nunca buscados omitiendo RLS. Recibo público requiere tenantSlug y establishmentSlug de URL; no son secretos.
