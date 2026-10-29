# Tasks — MAP-229

## Seguimiento E2E de reserva pública (2026-10-28)

- [x] Revisar el log CI: cuatro timeouts (dos casos por escritorio/móvil) esperando
      `Nombre completo` antes de confirmar el espacio; 36 pruebas restantes aprobadas.
- [x] Contrastar spec/plan y UI actual: horario completo → resolver mesa → confirmar
      espacio → datos → crear reserva → resumen propio. La creación no confirma el pago.
- [x] Actualizar los dos casos existentes, sus fixtures de disponibilidad/checkout y
      credencial anónima; verificar conservación de datos al volver a confirmar tras 409.
- [x] Ejecutar Playwright en escritorio/móvil y documentar alcance, resultados y límites.

Corrección limitada a regresiones E2E; sin cambios de producto, contrato ni reglas de pago.

Resultado: se reprodujo el timeout original en `Nombre completo`; se actualizaron
horario de URL, confirmación del espacio, fixtures de mapa/checkout, capability y
textos actuales (Crear reserva / Reserva registrada). Se comprueba recarga del resumen
y conservación de datos tras 409, sin JWT staff en las peticiones públicas del caso.

- Cuatro casos de booking en escritorio/móvil: 4/4 aprobados en puerto aislado :4502.
- La primera ampliación pública en :4502 tuvo 14/16 aprobados: los dos fallos de
  activación eran CORS por ese origen de prueba, no regresión de booking. Se repitió
  la suite completa usando los orígenes habituales permitidos, sin debilitar CORS.
- `pnpm --filter @mapit/e2e exec playwright test --workers=1 --reporter=list`, con
  PUBLIC_WEB_URL=:4300 y CONSOLE_URL=:4200: exit 0, **40/40 aprobados**, 2.7 minutos.
  Evidencia local ignorada: `.tmp-e2e-all-final.log`.
- `pnpm --filter @mapit/e2e run typecheck`, ESLint focal y Prettier: exit 0.
- El servidor de prueba :4502 se detuvo y el puerto quedó libre. El stack del usuario
  permanece activo. No se modificaron snapshots, timeouts de la suite, retries ni CI.
- Resultado local; no se afirma reejecución remota de GitHub Actions. Sin commit/push.

## Integración con main (2026-10-28)

- Se integran auditoría e historial de reservas de `origin/main` (`d4731c2`) conservando pagos QR. Las versiones V20–V22 de main se mantienen; las migraciones de esta rama pasan de V20–V28 a V23–V31, con sus pruebas de upgrade actualizadas.
- Si una BD local ya aplicó las versiones anteriores de pagos, su historial Flyway no coincide con esta numeración. No ejecutar `repair`, borrar datos ni reiniciar volúmenes automáticamente: requiere una estrategia explícita según los datos que deban conservarse.
- Verificación focal en PostgreSQL efímero: `PaymentMigrationUpgradeIntegrationTest`, `MockPaymentProjectionMigrationIntegrationTest`, `SpaceElementMetadataMigrationIntegrationTest` y `AuditLogMigrationIntegrationTest` pasaron mediante `:bootstrap:integrationTest`.

## Diagnóstico de errores solicitado el 2026-10-28

- `pnpm check` reprodujo fallos de Prettier y ESLint; tipos, tests frontend, builds, contrato API y backend pasaron en la primera ejecución.
- Se corrigieron formato, import de tipo `ElementRef`, callback tipado del mapa, payload E2E tratado como `unknown`, matcher del test de metadata y comparación estricta de capacidad. El test del reporter E2E necesitaba importar `Buffer` desde `node:buffer`; su ejecución con `pnpm exec node --test apps/e2e/tests/payment-live/redacted-reporter.check.mjs` pasó (1/1).
- `pnpm be:test --rerun-tasks`: exit 0, 87 tareas ejecutadas; recompilación completa sin errores en `PaymentsWiring` ni servicios de pagos. Los XML de pagos registran 70 tests sin fallos y ArchUnit 12 sin fallos. No se alteraron las clases Java para ocultar diagnósticos del editor.
- Segunda ejecución de `pnpm check`: formato, tipos, tests frontend (275 Console, 107 Public Web y 67 libs), builds, contrato y backend pasaron. Su único fallo fue el import de `Buffer`, corregido durante esa ejecución; `pnpm fe:lint` posterior terminó con exit 0. Estos resultados no acreditan ejecución de integración Docker ni E2E completo en esta revisión.
- Ejecución final de `pnpm check`: exit 0 en todas las etapas. Evidencia local: `.tmp-payment-check-final.log` (ignorado por Git). Sin commits ni push.
- Seguimiento de capturas del editor: Kiro mostraba 66 errores con un modelo Java desactualizado. Su configuración local `java.import.gradle.java.home` apuntaba a `jre-1.8`; se corrigió al JDK 25 instalado, se recargaron/reconstruyeron los 21 proyectos y se reinició la ventana. Importación y build del servidor Java completados, estado Ready, sin errores en el panel al revisar `PaymentsWiring`, `MockQrConfigurationService` y `CreateSpaceElementUseCase`; permanecen advertencias de análisis estático. Caso documentado en `TROUBLESHOOTING.md`.

Spec aprobada por usuario el 2026-10-27 mediante «Aprobar especificación». Plan confirmado después mediante «Confirmar y ejecutar». **Lanes B/F/Q finalizadas con pruebas focales; historia NO terminada mientras falte cierre global.** Las notas de 2026-10-24 al final son antecedentes, no resultados actuales. No se pide nuevamente aprobación.

## 1. Gate y propietarios actuales

- [x] **Owner:** leer spec → plan → tasks; self-review del plan contra CA-01…CA-12 / CN-01…CN-11; solicitar confirmación del plan antes de producto/contrato. Usuario confirmó el plan.
- [x] **Owner:** registrar baseline del workspace sin revertir cambios ni crear/cambiar rama; no commits/push. Scopes B/F/Q respetados según sus reportes; baseline abajo.
- [x] **Owner/B:** registrar Node v24.19.0, pnpm 11.9.0, Temurin 25.0.4.1 y Docker 29.8.2 disponibles. `pnpm doctor` invocó diagnóstico nativo; `pnpm run doctor` de MapIt se ejecutó con exit 1 por `.env` incompleto/puertos ocupados. No publicar ni modificar `.env` ni declarar doctor aprobado.

**B (fixer):** contrato, todo backend y sus tests, migración nueva/DBML, compatibilidad en `libs/api-client/src/lib/payment-preview.ts`, `payment-presentation.ts` y tests adyacentes, `libs/realtime/src/realtime.ts`/`realtime.spec.ts`, `docs/api/payments-realtime.md` y etiqueta de pago en `apps/console/src/app/core/strings.ts`. Sin cambios de métodos tradicionales.

**F (designer):** exclusivamente `apps/public-web/`, incluida UI, stores, STRINGS y sus tests. No consume enum nuevo antes del handoff B.

**Q (fixer QA):** exclusivamente `apps/e2e/tests/payment-live/` y `apps/e2e/playwright.payment-live.config.ts`. Sin tests backend, contrato ni producto. **Owner:** estos tres documentos y consolidación de evidencia. Ningún writer edita scope ajeno en paralelo.

## 2. B — contrato primero y estabilización backend

- [x] Actualizar primero `packages/api-contract/openapi.yaml`: `CANCELLED` en `PaymentAttempt.status`, `ManagedPayment.status`, query `GET /payments.status` y `SimulatePaymentRequest.outcome`; documentar cancelación sin cancelar reserva y 413 `Problem` en webhook. Mantener rutas/operationId/headers existentes.
- [x] Ejecutar en orden `pnpm api:lint` → `pnpm api:gen`; comprobar modelo/servicio generado sin editar ni versionar `generated/`. No avanzar a implementación con generación fallida.
- [x] **Rojo:** añadir casos a `PaymentTest` y `PaymentServicesTest` para cancelación terminal, reserva sin cambios, duplicado/contradictorio, timeout sin degradar cancelado/confirmado, confirmación tardía a conciliación y reintento dentro de la misma ventana. Registrar fallo por requisito, no por entorno.
- [x] **Verde:** actualizar `Payment.Status/Outcome/apply`; `PaymentService`, `PublicCheckoutService` y `PaymentViews` se inspeccionaron y reutilizaron sin modificación porque sus ramas existentes ya preservan static/manual, snapshot y locks. Cancelar no confirma/cancela reserva ni ocupa. Replay recupera su intento original, aunque terminal.
- [x] Generar V27 mediante `pnpm db:new "permitir_cancelacion_de_intento_de_pago"` y actualizar DBML; ampliar solo CHECK de `payment.status`, sin editar V20–V26 ni reinterpretar `EXPIRED`. La skill `new-migration` se intentó y fue denegada por permisos; no se eludió ni se declara ejecutada. Generador exit 0. `payment_webhook_event.outcome` no requiere otro CHECK.
- [x] **Rojo → verde:** `PaymentMigrationUpgradeIntegrationTest` demuestra upgrade de datos existentes y persistencia de CANCELLED; `PublicPaymentFlowIntegrationTest` demuestra evento/idempotencia y consulta posterior, sin cambio de reserva/recursos ni pérdida de historial.
- [x] Crear `MockPaymentWebhookControllerTest`: rojo inicial **de compilación**, no fallo runtime 413, por firma servlet/PayloadTooLarge ausentes y un builder corregido. Verde posterior demuestra 413 con/sin longitud, longitud mentirosa y stream 1 MB consumido solo hasta 16385 bytes, sin procesar pago.
- [x] **Verde:** `MockPaymentWebhookController` lee como máximo 16385 bytes del servlet y rechaza >16384 antes de `Notification`/parseo; `PaymentsProblemHandler` responde 413 RFC 9457. No `@RequestBody byte[]` ilimitado ni `readAllBytes`; HMAC/timestamp sobre bytes originales antes de interpretar tenant.
- [x] Revisar `MockPaymentSimulator`, `PublicCheckoutController`, `MockWebhookCodec`, `JdbcPaymentRepository`: enum, serialización, `name/valueOf`, evento duplicado/contradictorio y pending solo pendiente; sin nueva API/tabla de intentos.
- [x] Actualizar union/parser de `libs/realtime/src/realtime.ts` y regresión `realtime.spec.ts`, tipo `PreviewPaymentStatus` y compatibilidad de presentación, etiqueta mínima de pago en Console; no alterar métodos tradicionales. Documentar valor STOMP en `docs/api/payments-realtime.md`.
- [x] Negativos backend §6: tenant/sede cruzados en pago/simulación/recibo/STOMP, token inválido/revocado/vencido, monto/moneda/comercio alterados, firma/replay, concurrencia, tardíos y producción/perfiles mixtos bloqueados; regresión static/manual existente.
- [x] Ejecutar comandos B focalizados de plan §5: dominio, aplicación, infraestructura, integración/upgrade, STOMP y consumidores compartidos. Registrar rojo/verde y bloqueos Docker/Java sin falsear éxito.
- [x] **Handoff B → F/Q:** contrato generado y backend persistiendo/devolviendo `CANCELLED` estables, nueva restricción aplicada en pruebas, enums de consumidores reconciliados y resultados conocidos. F solo entonces consume `SimulatePaymentRequest.OutcomeEnum.CANCELLED`.

## 3. F — público (después de contrato estable)

- [x] **Rojo:** tests adyacentes de `payment-store`, `receipt-store`, `simulation-page`, `public-payment-api` cubren cancelar distinto de expirar, recarga terminal, refresco HTTP con STOMP reconectando/deshabilitado y emisión diferida/error/reintento del recibo.
- [x] **Verde:** stores/STRINGS/consumidores exhaustivos aceptan `CANCELLED`; cancelar envía ese outcome; reintento limpia clave local al cerrar intento y depende de disponibilidad/policy servidor, sin renovar ventana.
- [x] Simulador reconsulta y muestra terminal del mismo intento tras reload sin acciones mutantes; no exige `historicalMethod`/`PAYMENT_PENDING` para renderizar un terminal. ID distinto falla cerrado; abrir QR no emite eventos.
- [x] QR de intento visible fuera de compartir checkout, enlace seguro y resumen completo; sin fallback o QR bancario genérico. Mejoras QR/resumen independientes pueden avanzar tras el handoff de contrato sin esperar toda validación backend.
- [x] Actualización manual HTTP usable durante desconexión/reconnecting; evitar solo solicitudes simultáneas HTTP, no bloquear por estado STOMP. Recarga conserva intento y acceso válido, no inicia sesión nueva.
- [x] Comprobante con loading/error/not-found reales; emisión en curso no muestra enlace/QR inválido ni duplica solicitudes. Recibo confirmado muestra establecimiento/reserva/fecha/horario/espacios/anticipo/moneda y «simulado — sin dinero real» para MOCK, también sin preview. Consulta/escaneo no hace check-in.
- [x] Ejecutar `pnpm exec ng test public-web --no-watch --include "**/payment-store.spec.ts" --include "**/receipt-store.spec.ts" --include "**/simulation-page.spec.ts" --include "**/public-payment-api.spec.ts"`; registrar resultados y handoff UI a Q.

## 4. Q — recorrido Playwright real

- [x] Ajustar `tests/payment-live/flow.spec.ts` (cancelar=`CANCELLED`, no `EXPIRED`), reutilizando `setup.ts` y `mock-qr.spec.ts`; no añadir un E2E por regla de negocio ni simular respuestas de pago.
- [x] Extender flujo existente empresa/local → disponibilidad → fecha/horario/espacio/datos → reserva persistida → método local → QR/enlace propio → cancelar → recarga terminal → reintento permitido → confirmar por webhook → STOMP/HTTP → comprobante QR y recarga; comprobar reserva CONFIRMED, sin ACTIVE/ocupación y sin JWT staff en peticiones públicas.
- [x] Verificar recuperación HTTP con websocket no disponible, ausencia de evento al abrir simulador y etiqueta simulado fuera de preview; preview deshabilitado. Registrar datos persistidos, no solo texto UI. Expiración y fallo siguen distintos; reglas aisladas se cubren en backend.
- [x] Mantener selectores rol/testid, esperas de Playwright, datos aislados y artefactos sin tokens. No `waitForTimeout` ni `route.fulfill` de pagos/reservas/recibos; runtime config puede apuntar al backend real aislado.
- [x] Ejecutar `node tools/scripts/gradle.mjs :bootstrap:bootJar` y `pnpm --filter @mapit/e2e exec playwright test --config playwright.payment-live.config.ts`. Registrar reporte/trazas y disponibilidad del Docker/Java usados por setup. El preview no reemplaza este comando.

## 5. Owner — integración y cierre verificable

- [ ] Cerrar self-review integral frente a spec y suites globales, sin sobrescribir writers. Oracle re-review: recibo tardío **ADDRESSED**, sin hallazgo de seguridad bloqueante comunicado; no sustituye cierre owner. Auditoría UI separada abajo.
- [x] Owner comprobó logs anteriores al reinicio: `pnpm api:lint` válido con dos warnings; `pnpm api:check` sincronizado; `pnpm be:lint` y `pnpm be:test` con **BUILD SUCCESSFUL**. No se inventa conteo ni exit code no comunicado de esos logs.
- [x] `pnpm be:it`: reanudación exit 0, BUILD SUCCESSFUL en 12m 38s; XML de integración: 29 suites, 143 tests, 0 fallos/errores/omitidos. Log `mapit-qr-resumed-be-it.log`.
- [x] `pnpm check`: última ejecución exit 0 después de `pnpm api:gen`; formato, lint, tipos, tests/build frontend, contrato y backend build/tests/ArchUnit aprobados. Log `mapit-qr-last-check.log`. No sustituye integración/Spotless/E2E.
- [ ] Ejecutar `pnpm e2e` con stack completo además del E2E real focal de Q. Si hay bloqueo de entorno, consignar comandos omitidos y causa; no marcar historia completa con checks obligatorios sin ejecutar.
- [x] Registrar evidencia focal por CA/CN, archivos propios de lanes, comandos, resultados y límites en la entrega siguiente; ningún criterio se acredita solamente por su checkbox.
- [ ] Completar estas notas con resultados finales de `be:it`, `check` y E2E genérico cuando existan. No commits/push/cambio de rama; documentación aprobada y focal verde no son cierre global.

## Notas de ejecución — iteración actual (2026-10-27)

- Baseline: rama existente `feat/matiasmv05/MAP-229-hu-6-03-integracion-de-pago-qr`, HEAD `d5b528ab154c796adf701a478ad94ace292d01d7`, con cambios previos extensos. Se trabaja aquí por el plan aprobado; no se trasladan ni revierten cambios.
- Entorno observado: Node v24.19.0, pnpm 11.9.0, Temurin 25.0.4.1 y Docker 29.8.2 disponibles. `pnpm doctor` ejecutó el diagnóstico nativo de pnpm; usar `pnpm run doctor` para el script de MapIt.
- Preflight interfaces: B produce CANCELLED HTTP/SQL/dominio/STOMP y F/Q lo consumen; F y Q no escriben backend ni librerías. B/F/Q conservan métodos tradicionales y capacidades públicas. No se detectó contradicción de alcance; cada escritor ejecuta sus tests y owner consolida verificación integrada.
- Documentación elaborada en orden spec aprobada → plan confirmado → tasks. Esta consolidación escribe solo estos tres documentos; B/F/Q ya entregaron sus scopes de producto.
- Contraste por lectura: rutas/interfaces de controllers/services, enums de OpenAPI/dominio/UI, CHECK SQL V20 y V20–V26, union y parser STOMP, suites existentes y scripts de package.json/Gradle/codegen/Playwright.
- Baseline antes de B/F/Q: CHECK SQL excluía cancelación; simulador enviaba EXPIRED y validaba solo pendientes; refresh bloqueado al reconnect; QR dentro de details; webhook asignaba byte[] antes del límite. **Corregidos por lanes** según evidencia siguiente; conservar este diagnóstico no implica que sigan abiertos.
- Operación: ningún commit/push/cambio de rama ni reversión de cambios previos comunicado. Usuario vetó cambios backend después de B y se cumplió; corrección posterior de recibo fue solo F/store+test. Jira sin acceso remoto en esta iteración: no se actualizan estados ni se inventa contenido remoto.

## Entrega focal consolidada — archivos propios, evidencia y límites

Fuentes leídas: `C:\Users\matia\AppData\Local\Temp\opencode\mapit-qr-backend-report.md`, `mapit-qr-frontend-report.md`, `mapit-qr-qa-report.md` y `mapit-qr-ui-review.md` en esa misma carpeta. Listas siguientes identifican escrituras **propias de cada lane**, no todo el diff contra HEAD del workspace sucio. Reportes/logs temporales no son archivos de producto entregados.

### B — contrato/backend/SQL/consumidores (20 archivos)

- `packages/api-contract/openapi.yaml`.
- `apps/backend/modules/payments/payments-domain/src/main/java/com/mapit/payments/domain/Payment.java`.
- `apps/backend/modules/payments/payments-domain/src/test/java/com/mapit/payments/domain/PaymentTest.java`.
- `apps/backend/modules/payments/payments-application/src/test/java/com/mapit/payments/application/PaymentServicesTest.java`.
- `apps/backend/modules/payments/payments-infrastructure/src/main/java/com/mapit/payments/infrastructure/MockPaymentWebhookController.java`.
- `apps/backend/modules/payments/payments-infrastructure/src/main/java/com/mapit/payments/infrastructure/PaymentsProblemHandler.java`.
- `apps/backend/modules/payments/payments-infrastructure/src/test/java/com/mapit/payments/infrastructure/MockPaymentWebhookControllerTest.java` (nuevo).
- `apps/backend/modules/payments/payments-infrastructure/src/test/java/com/mapit/payments/infrastructure/MockPaymentSettingsTest.java`.
- `apps/backend/modules/payments/payments-infrastructure/src/test/java/com/mapit/payments/infrastructure/PublicPaymentServicesTest.java`.
- `apps/backend/bootstrap/src/main/resources/db/migration/V27__permitir_cancelacion_de_intento_de_pago.sql` (nueva).
- `docs/db/mapit.dbml`.
- `apps/backend/bootstrap/src/test/java/com/mapit/payments/PaymentMigrationUpgradeIntegrationTest.java`.
- `apps/backend/bootstrap/src/test/java/com/mapit/payments/PublicPaymentFlowIntegrationTest.java`.
- `apps/backend/bootstrap/src/test/java/com/mapit/config/PublicPaymentStompTest.java`.
- `libs/api-client/src/lib/payment-preview.ts` y `libs/api-client/src/lib/payment-preview.spec.ts`.
- `libs/realtime/src/realtime.ts` y `libs/realtime/src/realtime.spec.ts`.
- `docs/api/payments-realtime.md`.
- `apps/console/src/app/core/strings.ts` (solo etiqueta de estado de pago CANCELLED).

**Contrato entregado:** CANCELLED en `PaymentAttempt.status`, `ManagedPayment.status`, filtro ledger y `SimulatePaymentRequest.outcome`, `Payment.Status/Outcome`, unión/parser STOMP y tipo de presentación. Sin ruta nueva ni estado nuevo de reserva. V27 sustituye únicamente `payment_status_check`; conserva datos, RLS, índices, FK y EXPIRED histórico. Webhook admite como máximo 16 KiB, lectura limitada a 16385 bytes antes de copias/parseo, exceso 413 Problem. Opt-in/perfiles y HMAC se conservan. Métodos tradicionales no alterados.

**Reutilizados sin escribir:** PaymentService, PublicCheckoutService, PaymentViews, PublicCheckoutController, MockPaymentSimulator, MockWebhookCodec, JdbcPaymentRepository y `payment-presentation.ts`. No atribuirles cambios de B por aparecer en el mapa del plan.

**Pruebas B:** rojo dominio 4/1 fallo y aplicación 15/1 fallo por outcome ausente; webhook rojo de compilación. Primer fallo de integración fue fixture con expires_at == created_at y se corrigió solo el fixture. Upgrade demuestra V26 rechaza CANCELLED y V27 lo permite dentro del mismo test, no mediante retirada/reaplicación externa.

| Comando focal B                                                                                                                                                                                                                                                                                       | Resultado final / log temporal                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `node tools/scripts/gradle.mjs :modules:payments:payments-domain:test --tests "com.mapit.payments.domain.PaymentTest"`                                                                                                                                                                                | exit 0, 4 tests; `mapit-b-domain-final2.log`             |
| `node tools/scripts/gradle.mjs :modules:payments:payments-application:test --tests "com.mapit.payments.application.PaymentServicesTest"`                                                                                                                                                              | exit 0, 16 tests; `mapit-b-application-final.log`        |
| `node tools/scripts/gradle.mjs :modules:payments:payments-infrastructure:test --tests "com.mapit.payments.infrastructure.PublicPaymentServicesTest" --tests "com.mapit.payments.infrastructure.MockPaymentSettingsTest" --tests "com.mapit.payments.infrastructure.MockPaymentWebhookControllerTest"` | exit 0, 18 tests; `mapit-b-infrastructure-final2.log`    |
| `node tools/scripts/gradle.mjs :modules:payments:payments-infrastructure:test --tests "com.mapit.payments.infrastructure.MockGatewayTest"`                                                                                                                                                            | exit 0, 4 tests; `mapit-b-authenticator-final.log`       |
| `node tools/scripts/gradle.mjs :bootstrap:integrationTest --tests "com.mapit.payments.PublicPaymentFlowIntegrationTest" --tests "com.mapit.payments.PaymentMigrationUpgradeIntegrationTest"`                                                                                                          | exit 0, 11 tests; `mapit-b-integration-final.log`        |
| `node tools/scripts/gradle.mjs :bootstrap:test --tests "com.mapit.config.PublicPaymentStompTest"`                                                                                                                                                                                                     | exit 0, 6 tests; `mapit-b-stomp-final2.log`              |
| `pnpm exec ng test libs --no-watch --include "**/realtime.spec.ts" --include "**/payment-preview.spec.ts"`                                                                                                                                                                                            | exit 0, 8 tests / 2 archivos; `mapit-b-shared-green.log` |

Total focal: **59 backend + 8 compartidos**, sin fallos/errores/skips finales. `api:lint` → `api:gen` antes de implementar y `api:check`: exit 0, logs `mapit-b-api-{lint,gen,check}.log`. Solo TS generado por tooling, no editado ni versionado. `pnpm fe:typecheck` de B falló con exit 2 por STRINGS CANCELLED aún pendientes en F; no declararlo verde retrospectivamente por compilar unitarios posteriores. `pnpm run doctor`: exit 1 por APP_ENV/LOG_LEVEL/MAPIT_LOG_LEVEL ausentes y puertos ocupados; Java/Node/Docker sí disponibles. Skill new-migration denegada por permisos, generador obligatorio utilizado sin eludir permiso.

### F — público (13 archivos; corrección posterior en dos de ellos)

- `apps/public-web/src/app/core/strings.ts`.
- `apps/public-web/src/app/features/payment/data/payment-format.ts`.
- `apps/public-web/src/app/features/payment/data/public-payment-api.spec.ts`.
- `apps/public-web/src/app/features/payment/model/payment-store.ts` y `apps/public-web/src/app/features/payment/model/payment-store.spec.ts`.
- `apps/public-web/src/app/features/payment/model/receipt-store.spec.ts`.
- `apps/public-web/src/app/features/payment/ui/payment-page.html`.
- `apps/public-web/src/app/features/payment/ui/checkout-page.scss`.
- `apps/public-web/src/app/features/payment/ui/receipt-page.html`.
- `apps/public-web/src/app/features/payment/ui/simulation-page.ts`, `simulation-page.html`, `simulation-page.scss` y `simulation-page.spec.ts` en esa misma carpeta UI.

QR del intento fuera de details, compartir checkout separado, resumen/plazo/zona/moneda visibles; CANCELLED reintentable solo con available servidor. Simulador recupera terminal por GET y no fabrica éxito desde POST. HTTP manual funciona sin STOMP; emisión de recibo loading/error/reintento, deduplicación y descarte de respuestas antiguas. Aviso MOCK fuera de preview y pago separado de llegada. No dependencias, backend, contrato, libs, Console ni métodos tradicionales modificados por F.

**Pruebas F:** comando focal de §3 en rojo de comportamiento **10 fallos/32 aprobados de 42**, luego verde final **47/47, 4 archivos** (API 4, ReceiptStore 6, PaymentStore 18, SimulationPage 19), exit 0; `mapit-qr-frontend-{red,green}.log`. Corrección posterior solicitada por oracle solo en `payment-store.ts`/`.spec.ts`: recibo/error tardío no reaparece si GET invalida la reserva manteniendo pago CONFIRMED. `pnpm exec ng test public-web --no-watch --include "**/payment-store.spec.ts"`: rojo **2 fallos/18 aprobados**, verde **20/20**, exit 0; `mapit-qr-receipt-stale-{red,green}.log`. Oracle re-review lo comunicó **ADDRESSED**. **No hubo ejecución conjunta posterior de 49 tests: no se reclama 49/49.**

Visual F: Chromium con datos HTTP sintéticos explícitos y preview=false, 320/390/768/1440 sin overflow, QR visible con details cerrado, terminal CANCELLED y recibo simulado; cero pageerror. Script `mapit-qr-frontend-visual.cjs`, resultados `mapit-qr-frontend-visual-results.json` y 12 capturas `mapit-qr-{checkout,simulation,receipt}-{320,390,768,1440}.png`, en la carpeta temporal. No son E2E financiero, build de producción ni pruebas de dispositivo/lector de pantalla. Servidor aislado :4600 detenido sin tocar QA. Formato focal de los 13 archivos reportado exit 0.

### Q — navegador/backend/PostgreSQL/STOMP reales (4 archivos)

- `apps/e2e/tests/payment-live/setup.ts`.
- `apps/e2e/tests/payment-live/flow.spec.ts`.
- `apps/e2e/tests/payment-live/mock-qr.spec.ts`.
- `apps/e2e/playwright.payment-live.config.ts`.

`node tools/scripts/gradle.mjs :bootstrap:bootJar`: exit 0, BUILD SUCCESSFUL, 51 tareas. `pnpm --filter @mapit/e2e exec playwright test --config playwright.payment-live.config.ts`: tercera ejecución **exit 0, 2/2**, retries=0, 1.4 min total; flujo público **26.9 s**, configuración **8.0 s**. Las dos ejecuciones previas fallaron por harness (cuerpo GET descartado por Chromium y selectores/selección administrativa), corregido sin editar producto. Logs `mapit-qr-qa-bootjar.log` y `mapit-qr-qa-playwright-3.log`.

Flujo real: empresa/sede, reserva anónima, BOB 120.00 desde policy local, QR visible, cancelar y recargar terminal, reintentar con ID nuevo/mismo snapshot y plazo, confirmar por webhook HTTP real, STOMP y GET, recuperación HTTP con websocket cortado, comprobante/QR y reload. SQL: cancelar conserva `CREATED/AVAILABLE`; confirmar/consultar recibo conserva `CONFIRMED/AVAILABLE/NOT_CHECKED_IN`. Dos POST de simulación (cancelar+confirmar), cero al abrir/reload; cero pageerror y peticiones públicas con Authorization staff. Sin interceptar pagos/reservas/recibos. FAILED/EXPIRED y negativos aislados se prueban en B, no se duplican en E2E.

Evidencia focal: `apps/e2e/playwright-report/payment-live/index.html`; `apps/e2e/test-results/payment-live/.last-run.json` leído en esta consolidación: **status passed, failedTests []**. Backend log parametrizado `mapit-qr-qa-backend-final.log` con webhook/simulate/recibo 200. Sin capturas/trazas que persistan QR/capabilities/JWT. Los cuatro archivos Q permanecen no versionados según su reporte; no equivale a publicación. Warnings Angular NG02952 de imágenes existentes, no corregidos. Este E2E fue anterior a la corrección posterior del recibo de F; no se afirma reejecución tras ella.

### Cobertura focal y pendientes/sugerencias separados

| Criterios      | Evidencia reportada / límite                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| CA-01…03       | Q: reserva pública real/config local/policy/snapshot; B: validación monetaria y disponibilidad. No se inventa total/saldo.                          |
| CA-04…05       | Q/F: QR visible, enlace propio y abrir sin POST/evento. Visual F sintético distinguido de Q real.                                                   |
| CA-06…07       | B/Q: webhook/persistencia/SQL/eventos, reserva CONFIRMED y espacio AVAILABLE; no check-in.                                                          |
| CA-08…09       | Q: STOMP real y HTTP con websocket cortado, reload terminal/reintento; F: concurrencia GET y ámbitos viejos.                                        |
| CA-10          | Q: recibo real/QR/consulta/reload/NOT_CHECKED_IN; F: aviso sin dinero real y regresión tardía 20/20 posterior. No afirmar escaneo físico de cámara. |
| CA-11…12       | B/F: FAILED/EXPIRED separados y CANCELLED terminal; Q: cancelar persiste y recarga sin mutar reserva.                                               |
| CN-01…02/09…10 | B: tenant/sede cruzados, capabilities/recibos revocados/expirados y scopes STOMP/SEND.                                                              |
| CN-04…08/11    | B: HMAC/replay, datos persistidos, tamaño/413/lectura acotada, duplicados/concurrencia/conciliación, perfiles mixtos/prod bloqueados.               |
| CN-03          | Integración global de reserva pendiente de consolidar por owner; no se atribuye a Q negativo aislado no ejecutado.                                  |

**Revisión UI (solo lectura):** Impeccable y checklist Vercel manual aplicados, no scanner Vercel ni certificación WCAG; PASS visual con observaciones, P0=0/P1=0 verificados, P2=2/P3=3. El auditor citó `public-mock-checkout/spec.md`; esa spec secundaria **no es autoridad**: mandan la spec principal y plan aprobados. Oracle no comunicó seguridad bloqueante y cerró recibo stale como ADDRESSED.

**Sugerencias NO aplicadas por instrucción del usuario:** P2 recuperación GET explícita/instrucciones coherentes del simulador y target táctil de Actualizar estado; P3 skip link, hover secundario y tokens literales. No se pide autorización adicional en esta entrega ni se hace polish. Auditoría visual fina limitada en receipt-320 y simulation-768/1440 por artefactos comprimidos; no se diagnostica CSS sin reproducción ni se reclama sign-off pixel-level. Sin medición WCAG/zoom/lector de pantalla/dispositivo físico/bundle.

**Resultado consolidado:** API lint válido (dos warnings), API check sincronizado, be:lint/be:test BUILD SUCCESSFUL e integración global 143/143 con exit 0. El primer `check` terminó exit 1 exclusivamente por formato (2 archivos) y ESLint (3 errores); Q corrigió los cuatro archivos afectados sin editar backend y repitió E2E real con exit 0, 2/2 (26.8s público, 7.7s administrativo). Tras regenerar el cliente por el hash del YAML formateado, `pnpm check` terminó **exit 0 en todas sus etapas**, incluido build/tests/ArchUnit backend. Logs `mapit-qr-last-api-gen.log` y `mapit-qr-last-check.log`. `pnpm e2e` genérico **NO ejecutado**: no hay stack en :4200/:4300/:8080; Q focal usa backend aislado y :4400/:4500 y **no lo sustituye**. Funcionalidad MOCK y pruebas focales entregadas; cierre de historia/release pendiente del E2E genérico y evidencia remota de PR, sin publicación autorizada. No declarar suites omitidas verdes.

## Antecedentes históricos — 2026-10-24 (no validar ni reutilizar como resultados actuales)

El checklist anterior registraba como completados descubrimiento/Jira, motor independiente, configuración Console, tokens aislados y checks; dejaba checkout/confirmación/recibo/realtime público/E2E bloqueados. Esos bloqueos están superados por presencia de código actual y no son tareas vigentes. Las afirmaciones de Jira siguientes pertenecen al registro anterior: no hubo consulta remota en esta iteración. El ordinal «V19» del checklist antiguo no corresponde a las migraciones de pagos actuales V20–V26.

### Notas de ejecución históricas (transcritas)

2026-10-24: working tree inicialmente contiene AGENTS.md modificado por usuario; preservar.
Rama inicial feat/matiasmv05/MAP-66-implementar-servicios. GitHub MCP identifica matiasmv05; gh CLI ausente.
Jira consultado sin modificaciones: MAP-229 y MAP-228 En curso; MAP-193 Listo contradice código local sin transiciones.
Docker info no responde inicialmente; verificar disponibilidad sin asumir ejecución de integración.

Docker 29.8.2 verificado fuera del sandbox; PostgreSQL 17 real mediante Testcontainers.
Rama local creada según identidad autenticada, sin commit/push. Se preservó AGENTS.md del usuario.

### Evidencia y comandos históricos (no reejecutados)

- pnpm api:lint: aprobado, dos warnings previos health/demo-items.
- pnpm api:gen y api:check: aprobados; solo TypeScript generado por tooling existente.
- pnpm check: aprobado en todas sus etapas, incluidas 226 pruebas Console, 4 Public Web, bibliotecas, builds y ArchUnit.
- Gradle test: aprobado; 25 pruebas nuevas del motor/métodos/mock/tokens.
- Gradle integrationTest focalizado PaymentMethodsIntegrationTest: seis pruebas aprobadas, incluyendo HTTP ADMIN, tenant/RLS e idempotencia concurrente persistente.
- pnpm be:it: aprobado completo, 116 pruebas bootstrap, cero fallos/errores.
- pnpm e2e: no ejecutado, contrato público y flujo completo bloqueados; ninguna afirmación de E2E aprobado.
- Sin captura visual de la pantalla nueva; pruebas de UI a nivel de store, compilación y lint.
- Reportes XML locales: apps/backend/modules/payments/*/build/test-results/test/ y apps/backend/bootstrap/build/test-results/integrationTest/.
- PR/Checks screenshot siguen abiertos porque publicar no está autorizado; no se solicita revisión como ticket terminado.

### Conflictos históricos resueltos

- QA encontró importe fuera de NUMERIC(24,6); se limitó a 18 dígitos enteros y se añadió regresión.
- QA encontró elusión de configuración local mediante default de tenant; se corrigió y se añadió regresión.
- El test de integración usó inicialmente accessToken() inexistente; corregido a value() y verificado.
- Se evitó un allOf que prohibía propiedades de respuesta mediante additionalProperties:false en la base.
- En aquella etapa, mock y token quedaban expresamente aislados: sin endpoints de cobro, pago desde navegador ni recibo pagado. No describe las superficies públicas existentes al 2026-10-27; la prohibición de ocupación ficticia por pago continúa vigente.
