# Integración de HU-6.02 con pagos QR — informe

Actualización de arranque local: V21 se conserva con su checksum original y V22 completa el esquema incrementalmente. Ver [diagnóstico y verificación](startup-fix.md).

Fecha: 2026-10-25. `origin/main` actualizado a `a0f0c03` e integrado mediante merge en la rama de MAP-229. Los cambios locales se restauraron sin conflictos y se conserva el stash de respaldo. `AGENTS.md` del usuario no se sobrescribió.

## Funcionalidad conectada

- Portal `/reservas` con catálogo y búsqueda de establecimientos reales, sin disponibilidad, reseñas ni puntuaciones inventadas.
- HU-6.02 conserva su creación anónima y reglas de disponibilidad; añade capability opaca de 256 bits en el 201, hash persistido, alcance y expiración. Se corrigieron reutilización de ruta/fecha, respuestas obsoletas y edición durante envío. La reserva enlaza al checkout sin usar el UUID como contraseña.
- Console administra métodos y política explícita por establecimiento: moneda, anticipo, total opcional y ventana de pago. No existen precios de fixture como valores reales predeterminados. Las cuentas, monedas y QR ya utilizados se conservan; para cambiarlos se crea otro método.
- Checkout, intentos y referencias persistidos con RLS. Inicio idempotente por requestId, importe fijado por el servidor, eventos autenticados y deduplicados, control de pagos tardíos/dobles y conciliación. Una reserva en conciliación bloquea nuevos cobros.
- QR bancario estático suministrado por comercio/banco y verificación manual exclusiva ADMIN. Una captura no confirma automáticamente un ingreso.
- Comprobante digital sin valor fiscal: token independiente, hash, caducidad y consulta actual de establecimiento, ubicación, reserva, anticipo y saldo cuando hay total. Generación QR diferida con qrcode.
- Recepción ADMIN/STAFF con ZXing diferido, cámara explícita y entrada manual. El servidor revalida tenant, establecimiento, pago, reserva y horario. Check-in y ocupación comparten transacción: CONFIRMED → ACTIVE y elementos → OCCUPIED, con auditoría e idempotencia concurrente.
- STOMP/outbox existentes para pagos, llegada y ocupación. La sala pública requiere capability y solo entrega eventos de esa reserva, revalidando incluso después de revocación.

## Qué es simulado

MOCK_GATEWAY simula exclusivamente al proveedor de dinero. Requiere opt-in del backend y perfiles únicamente dev/test. Obtiene los datos del intento persistido y entrega una notificación HTTP HMAC al webhook real con Spring RestClient. API, transacciones, RLS, reserva, comprobante, check-in y outbox sí se ejecutan contra la base de datos del entorno.

Los adaptadores frontend de demostración siguen separados: paymentPreviewEnabled=false por defecto; solo funcionan con opt-in, development/test e isDevMode. Nunca se activan tras un fallo HTTP y sus cambios no salen de los fixtures.

## Verificación

- Contrato: api:lint, api:gen y api:check aprobados; avisos preexistentes de /health y /demo-items sin respuesta 4XX.
- Backend: build y unit/ArchUnit aprobados. La ejecución amplia de integración verificó 127/128 casos y detectó el bloqueo de lectura del historial; se separó lockAliveById de findAliveById y se aprobaron de nuevo los casos afectados de Operations y los flujos de Payments.
- Pruebas HTTP/PostgreSQL específicas incluyen creación pública, snapshot, repetición de requestId/webhook, dos check-ins concurrentes, auditoría, OCCUPIED, permisos, RLS, horario, catálogo y conciliación después de suspender el comercio.
- Frontend: Console 257, Public Web 40 y librerías 64 pruebas aprobadas; tipos y lint verificados. El test de transporte público cubre kill switch, sala propia, reconexión y liberación; backend cubre denegación de salas ajenas y revocación durante entrega.
- Builds: Console ~705 kB iniciales y Public Web ~279 kB, por debajo de los límites de error de 1 MB/800 kB. Persisten avisos de umbral recomendado y CommonJS. QR/lector y rutas se cargan de forma diferida.
- Playwright conectado: 1/1 aprobado, reserva desde Public Web → checkout → webhook mock HTTP → comprobante → llegada desde Console; PostgreSQL y backend temporales, con rol runtime mapit_app. Se comprueba ACTIVE/OCCUPIED por la API y actualización del comprobante abierto mediante STOMP, sin JWT público. El setup elimina únicamente su contenedor etiquetado.
- Playwright visual: 9/9 aprobados en la comparación final sin actualizar referencias, escritorio/tablet/móvil, cámara virtual ZXing, teclado, movimiento reducido y comprobante a 320 px. Las tres referencias de configuración se renovaron por las nuevas secciones de política y verificación manual; las demás conservaron su comparación.

Capturas del recorrido conectado: `apps/e2e/test-results/payment-live/checkout-real.png`, `receipt-real.png`, `check-in-real.png`. Baselines: `apps/e2e/tests/payment-preview/snapshots/`.

## Reproducción

1. Configurar métodos y política desde Console como ADMIN. Un establecimiento sin política habilitada muestra cobro no disponible.
2. Para mock backend, habilitar explícitamente `MAPIT_PAYMENTS_MOCK_ENABLED=true` y `SPRING_PROFILES_ACTIVE=dev` o `test`. Un perfil productivo adicional deshabilita el mock. El secreto HMAC de desarrollo puede venir de `MAPIT_PAYMENTS_MOCK_WEBHOOK_SECRET`; sin él se genera uno efímero en backend.
3. Public Web y Console leen apiBaseUrl/wsUrl en assets/config.json. Console requiere paymentPublicOrigin del origen público desplegado para validar enlaces escaneados. HTTPS es necesario para cámara fuera de localhost.
4. E2E conectado: `node tools/scripts/gradle.mjs :bootstrap:bootJar`, después `pnpm --filter @mapit/e2e exec playwright test --config playwright.payment-live.config.ts` (Docker/JDK/navegador Playwright disponibles).
5. Visual/demo: `pnpm --filter @mapit/e2e exec playwright test --config playwright.payments.config.ts`.

## Pendiente y límites

No se conectaron Stripe Connect, Adyen, Mercado Pago ni bancos reales. Faltan credenciales autorizadas, sandbox, contrato/adaptador del proveedor, custodia de secretos y conciliación periódica contra una API de estado autoritativa. No se añadió un scheduler que confunda sesiones mock en memoria con evidencia bancaria.

La expiración del pago no cancela automáticamente la reserva CREATED; esa política requiere una regla de liberación de reservas. Se mantiene el alcance HU-6.02 de horarios en un mismo día; no se inventaron tarifas ni estadías hoteleras. Los espacios sin nombre público presentan su identificador real y ubicación; una etiqueta amigable es una mejora posterior de datos/presentación.

No se realizó despliegue, push ni modificación de Jira. La página oficial aquí es apps/public-web del repositorio; la publicación en un dominio productivo no forma parte de esta ejecución. Los Checks remotos y su captura obligatoria de ticket-delivery quedan abiertos hasta contar con PR y CI.

## Revisión de diseño y movimiento

Aplicadas las skills del proyecto: impeccable, pick-ui-library, find-animation-opportunities, animate, review-animations y web-design-guidelines. Se conserva azul #2563EB, tipografía/tokens/componentes existentes, sin dependencias de animación.

| Hallazgo                                                                                  | Estado                                                                             |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Movimiento reducido, foco de teclado, cámara/QR/importes estables, hover restringido      | Verificado en código y recorrido visual                                            |
| Pulsación 120 ms / escala .98; detalles 180 ms / 4 px; feedback breve con curva existente | Conservado; sin barridos, rebotes ni animaciones de lecturas frecuentes            |
| Configuración ahora más larga por política y verificación manual                          | Baselines nuevas tras inspección; sin desbordamiento horizontal                    |
| Identificadores UUID visibles cuando no hay etiqueta pública                              | Informado como mejora adicional; no se inventaron nombres ni se aplicó otro diseño |

Las guías web se consultaron en su fuente oficial: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md.
