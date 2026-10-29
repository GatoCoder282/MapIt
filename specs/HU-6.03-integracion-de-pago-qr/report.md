# Informe técnico — MAP-229 y ampliaciones de pagos

> Informe histórico previo a la llegada de HU-6.02 a main. Sus bloqueos y estado de conexión se actualizan en [integration/report.md](integration/report.md).

Fecha de trabajo: 2026-10-24. Rama local: `feat/matiasmv05/MAP-229-hu-6-03-integracion-de-pago-qr`.
Entrega parcial deliberada: **MAP-229 no está terminada**. No se modificó Jira ni se hizo commit, push, PR, merge o despliegue.

## A. Resumen ejecutivo

Implementada la administración de métodos de cobro en Console y API: ADMIN, tenant/establecimiento, herencia local, país/moneda, QR bancario PNG/JPEG, activación y verificación manual explícita. OpenAPI y cliente TypeScript regenerados.

Implementado y probado el motor independiente de pagos: snapshot de precio backend, importes por moneda, estados, persistencia JDBC, bloqueo por pago, eventos idempotentes, verificación manual y conciliación. Mock de pruebas con sesiones Java, consulta, resultados simulados y notificaciones HMAC. Soporte criptográfico aislado de tokens de comprobante.

**No hay cobro público utilizable, simulador web ni webhook HTTP conectado.** El enlace `mock://payments/…` es una referencia de prueba sin pantalla. PaymentService no es un bean de producción: necesita un adaptador de reservas estable. Las pruebas de motor utilizan puertos de reserva de prueba y no acreditan confirmación real.

Bloqueados checkout, confirmación de reserva, comprobante emitido, escáner, check-in, ocupación y realtime público. HU-6.02 carece de contrato de creación pública/credencial; HU-5.02 solo tiene enum, creación y listado en este checkout. No se eludieron estas dependencias actualizando tablas de reservas desde Payments.

## B. Arquitectura resultante

- **Domain**: MerchantPaymentMethod, Money, Payment, PaymentProvider, PaymentGatewayPort, ReservationPaymentPort y repositorios; Java sin Spring/JPA/Jackson.
- **Application**: PaymentMethodService con transacciones/contexto; PaymentService independiente para snapshot, validación de evento y liquidación. No importa Infrastructure ni otro contexto.
- **Infrastructure**: API de métodos, JDBC con filtros y SET LOCAL, configuración mock opt-in dev/test, MockPaymentGateway, MockWebhookAuthenticator y MockWebhookCodec.
- **Bootstrap**: autorización ADMIN, migración V19, pruebas HTTP/RLS/concurrencia.
- **Console**: ruta `/payment-methods`, guard ADMIN, cliente generado, store Signals, catálogo de textos y componentes actuales.

GET/POST `/api/v1/payment-methods` y PUT `/api/v1/payment-methods/{methodId}` son la única superficie HTTP nueva. La API no recibe tenant, actor, secretos ni importes de cobro del navegador. Con establishmentId se valida el recurso y se aplican métodos locales si existen, incluso deshabilitados; sin locales hereda los predeterminados.

Cada fila payment representa un intento con reserva, establecimiento, método, proveedor, comercio, referencia, importe y moneda congelados. No existe agregado adicional de factura ni saldo total: se necesita la política de precios/anticipo futura.

Estados de pago: PENDING, PENDING_MANUAL_VERIFICATION, CONFIRMED, FAILED, EXPIRED y RECONCILIATION_REQUIRED. Confirmado no retrocede; ingreso tardío, posterior a fallo/vencimiento o sin reserva confirmable requiere conciliación. No se añadió RECLAMADO ni se duplicó la máquina de reservas.

El procesamiento bloquea el pago FOR UPDATE y registra el evento mediante unicidad persistente por tenant/proveedor/evento. Historial de verificación conserva actor/origen/referencia. La prueba concurrente verifica una sola confirmación y una fila de evento/verificación; la confirmación de reserva de esa prueba es un puerto doble.

El mock firma timestamp y bytes exactos antes de deserializar; ventana de replay, límite de cuerpo y comparación constante. No se incorporan credenciales reales. Integraciones reales habilitadas se rechazan.

ReceiptToken genera 256 bits aleatorios base64url, admite solo forma canónica y hash SHA-256 persistible; ReceiptCredential valida tenant/reserva/tiempo y revocación. No tiene almacenamiento, emisión ni URL HTTPS expuesta. El diseño futuro está en receipt-check-in-design.md.

Realtime existente no se modificó: outbox y salas de staff no autorizan al cliente anónimo. Tampoco se reutiliza una bitácora de elementos espaciales para fingir auditoría general de pagos; payment_verification es su historial específico. La integración con MAP-194 sigue pendiente.

## C. Trabajo de subagentes

| Rol              | Entrega e integración                                                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Análisis     | Inspección de solo lectura de reservas, operaciones, auditoría y realtime; confirmó discrepancias Jira/código y contratos ausentes. Principal leyó los once tickets mediante Atlassian MCP.                                                    |
| B — Backend      | Propietario de modules/payments, excepto receipt. Dominio, servicios, JDBC, mock/HMAC, controlador y pruebas.                                                                                                                                  |
| C — Frontend     | Propietario de Console. Pantalla administrativa, cliente/store, strings, guard/navegación y ocho pruebas. Aplicó ticket-delivery e impeccable conforme a la coordinación.                                                                      |
| D — Comprobantes | Propietario de receipt y su diseño. Tokens, caducidad/revocación y nueve pruebas; sin emisión ficticia.                                                                                                                                        |
| E — Seguridad/QA | Segunda tarea de solo lectura del agente A, independiente de quienes implementaron. Detectó desbordamiento NUMERIC y elusión de configuración local; B corrigió ambos con regresiones. Sin hallazgos altos/críticos pendientes por inspección. |
| Principal        | Spec→plan→tasks, Jira, contrato/generación, migración/DBML, autorización, integración concurrente y ejecución de checks.                                                                                                                       |

No hubo propietarios simultáneos sobre un mismo archivo. No se delegaron modificaciones Jira ni publicación.

## D. Cambios del repositorio

| Ubicación                                                                                        | Propósito                                                                            |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| specs/HU-6.03-integracion-de-pago-qr/{spec,plan,tasks}.md                                        | Especificación autorizada, arquitectura/patrones y ejecución verificable             |
| jira-discovery.md                                                                                | Once tickets leídos y contraste con código local                                     |
| receipt-check-in-design.md                                                                       | Integración futura, puertos y bloqueos sin duplicar estados                          |
| packages/api-contract/openapi.yaml                                                               | Tres operaciones administrativas y modelos tipados                                   |
| libs/api-client/src/lib/generated/                                                               | Regenerado por herramienta; ignorado por Git, no editado manualmente                 |
| apps/backend/modules/payments/payments-domain/src/                                               | Dinero, métodos, estados, puertos, tokens y pruebas                                  |
| apps/backend/modules/payments/payments-application/src/                                          | Casos de uso y pruebas de reglas                                                     |
| apps/backend/modules/payments/payments-infrastructure/src/                                       | JDBC, API de métodos, mock/HMAC y pruebas                                            |
| apps/backend/bootstrap/src/main/resources/db/migration/V19__crear_metodos_e_intentos_de_pago.sql | merchant_payment_method, payment, payment_webhook_event y payment_verification       |
| docs/db/mapit.dbml                                                                               | Tablas y FK compuestas; constraint adicional de reserva para asociar establecimiento |
| apps/backend/bootstrap/src/main/java/com/mapit/config/SecurityConfig.java                        | ADMIN para métodos antes de cualquier ruta pública                                   |
| apps/backend/bootstrap/src/test/java/com/mapit/payments/PaymentMethodsIntegrationTest.java       | Seis pruebas reales HTTP, RLS y concurrencia PostgreSQL 17                           |
| apps/console/src/app/features/payments/                                                          | Data/store/UI y pruebas                                                              |
| apps/console/src/app/{app.routes.ts,core/strings.ts,layout/staff-shell.*}                        | Ruta, catálogo y navegación administrativa                                           |

No hay dependencias nuevas ni migraciones históricas modificadas. Se preservó el cambio previo del usuario en AGENTS.md.
El generador actual del repositorio produce cliente TypeScript; no genera interfaces Java, pese a los comentarios de contexto. Los DTO del controlador siguen la convención existente. Esto es una limitación previa del chequeo contractual Java, no una generación Java ejecutada en esta entrega.

## E. Matriz de criterios de aceptación

Evidencia: IT = PaymentMethodsIntegrationTest; APP = PaymentServicesTest; DOM = PaymentTest/MerchantPaymentMethodTest; MOCK = MockGatewayTest; TOKEN = ReceiptTokenTest/ReceiptCredentialTest; UI = payment-methods-store.spec.ts.

| Criterio solicitado                                 | Estado                                         | Evidencia / límite                                          |
| --------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| Configurar método propio por tenant/establecimiento | Implementado y probado                         | IT + UI; actor y fechas persistidos                         |
| Impedir consulta/modificación desde otro tenant     | Implementado y probado                         | IT HTTP + runtime RLS + APP                                 |
| QR estático no confirma automáticamente             | Implementado y probado                         | APP; IT verifica que configurar no crea pago                |
| Pago manual requiere verificación autorizada        | Parcial                                        | Actor y regla APP; endpoint manual aún no expuesto          |
| Sesión mock utilizable por cliente                  | Parcial                                        | MOCK crea/consulta/simula en Java; sin pantalla/handler web |
| Webhook válido confirma pago y reserva              | Parcial                                        | HMAC y motor probados; sin HTTP/adaptador real de reserva   |
| Webhook duplicado no duplica efectos                | Implementado y probado en motor                | IT concurrente PostgreSQL + APP; no E2E proveedor           |
| Webhooks alterados o comercio distinto rechazados   | Implementado y probado en adaptadores/motor    | MOCK + APP; no endpoint conectado                           |
| Monto o moneda distinta impide confirmación         | Implementado y probado en motor                | APP; JPY/KWD y límite de almacenamiento DOM                 |
| Pago vencido/tardío requiere conciliación           | Implementado y probado en dominio              | DOM; sin conciliación administrativa web                    |
| Realtime frontend y recuperación tras reconexión    | Bloqueado                                      | Contrato público HU-6.02 + evento/sala limitada pendientes  |
| Reserva confirmada/pagada genera comprobante        | Bloqueado                                      | Sin transición válida/precio/credencial pública             |
| Pendiente no aparece como pagado                    | Parcial                                        | Estados separados; sin vista de comprobante                 |
| Distinguir anticipo, pago total y saldo             | Bloqueado                                      | Falta política monetaria/snapshot total de reserva          |
| QR resuelve reserva sin datos sensibles             | Parcial                                        | TOKEN seguro; sin emisión/URL/consulta pública              |
| Token alterado, revocado o inválido                 | Implementado y probado como credencial aislada | TOKEN; aún no autoriza operaciones reales                   |
| Reserva cancelada no permite check-in               | Bloqueado                                      | Falta caso de uso y consulta vigente                        |
| Operador autorizado escanea comprobante             | Bloqueado                                      | Sin emisión/escáner ni permisos por establecimiento         |
| Backend valida reserva y establecimiento operativo  | Bloqueado                                      | Contrato de check-in pendiente                              |
| Muestra ubicación realmente asignada                | Bloqueado                                      | Sin consulta de comprobante conectado                       |
| Check-in activa reserva y ocupa espacios            | Bloqueado                                      | HU-5.02 y orquestación multi-elemento                       |
| Check-in registrado en auditoría                    | Bloqueado                                      | Depende de caso de uso real y MAP-194                       |
| Dos escaneos no duplican ocupación                  | Bloqueado                                      | Concurrencia de pago probada; ocupación no implementada     |
| Impedir check-in desde otro tenant                  | Bloqueado                                      | Token liga tenant, pero check-in aún no existe              |
| Ventana temporal de llegada                         | Bloqueado                                      | Política por establecimiento/vertical no definida           |
| Dashboard y mapa actualizados                       | Bloqueado                                      | No evento de check-in/pago conectado                        |
| Reservas con múltiples elementos                    | Bloqueado para check-in                        | Reglas existentes conservadas; no nueva ocupación           |
| Cuatro verticales                                   | Bloqueado para integración completa            | MAP-231/MAP-239 pendientes; motor monetario independiente   |
| E2E reserva→pago→comprobante→scan→check-in          | Bloqueado                                      | No se ejecutó ni se simuló una aprobación                   |
| Proveedores bancarios reales                        | Fuera del alcance acordado de esta etapa       | Abstracción preparada; sin credenciales/sandbox             |

No se marca como aprobado un endpoint, pantalla o flujo que no existe. El checkout y el check-in no son criterios satisfechos por las pruebas aisladas.

## F. Pruebas

- `pnpm api:lint`: aprobado; dos warnings previos en health/demo-items por respuestas 4xx ausentes.
- `pnpm api:gen`: aprobado, incluido ajuste de composición de esquemas; cliente actualizado.
- `pnpm check`: aprobado completo. Incluye prettier, fe:lint, fe:typecheck, fe:test, fe:build, api:check y Gradle build con unitarias/ArchUnit.
- Console: 226 pruebas aprobadas, incluidas 8 nuevas de configuración; Public Web: 4 aprobadas. Bibliotecas también aprobadas por pnpm check.
- Payments unitarias: 25 aprobadas (7 application, 5 dominio de pago/método, 9 tokens, 4 mock/HMAC).
- `node tools/scripts/gradle.mjs spotlessApply test :bootstrap:integrationTest --tests com.mapit.payments.PaymentMethodsIntegrationTest`: aprobado tras corregir compilación inicial.
- Integración focalizada final: 6 pruebas, 0 fallos, 0 errores. PostgreSQL 17 real con Testcontainers; permisos HTTP, RLS, sustitución local y concurrencia de duplicados.
- `pnpm be:it`: aprobado completo (11m 3s), 116 pruebas de integración en bootstrap, cero fallos/errores. Incluye las seis nuevas de pagos y las regresiones de los demás contextos.
- `pnpm e2e`: no ejecutado; flujo completo bloqueado por contratos ausentes. No hay evidencia E2E ni captura visual de la pantalla nueva.
- `pnpm check` no incluye integración ni E2E; se reportan aparte.

Error introducido durante verificación y resuelto: el test usó accessToken() en lugar de IssuedAccessToken.value(); se corrigió y compilaron/pasaron los tests. La revisión detectó dos defectos de reglas corregidos antes de entrega.
Advertencias previas: RouterLink sin uso en AdminShell. Hubo error de outbox al cerrar un contenedor de prueba; no falló la suite focalizada. Fallos de pnpm/procesos dentro del sandbox se resolvieron con ejecución autorizada fuera del sandbox.
Reportes reproducibles: apps/backend/modules/payments/*/build/test-results/test/ y apps/backend/bootstrap/build/test-results/integrationTest/.

## G. Dependencias y riesgos

1. HU-6.02 debe definir creación pública, acceso seguro a reserva y su compatibilidad con created_by de staff NOT NULL.
2. HU-5.02 necesita find/update, transición autoritativa y concurrencia; el estado Jira Listo no aporta esos métodos al checkout.
3. Faltan total, anticipo, moneda y vencimiento definidos por backend. No se aceptó monto del navegador para suplirlos.
4. Permisos por establecimiento y política de llegada por las cuatro verticales deben preceder al escáner.
5. Mock actual es para pruebas de código; configurar un método mock no habilita cobros públicos.
6. Historial de verificación no sustituye una bitácora general aún incompleta; no hay CRUD de ese historial.
7. Referencias de eventos HMAC requieren resolver/configurar secretos fuera del código antes de exponer webhook. Sin proveedores reales, no se implementó almacenamiento de credenciales.
8. UI compilada y testeada, sin inspección visual de navegador ni evidencia responsive real.
9. No existe PR remoto ni screenshot de Checks; ticket-delivery mantiene ese paso abierto porque el usuario prohibió publicar sin autorización.

## H. Siguientes pasos

Primero estabilizar HU-6.02/HU-5.02 y fijar precios/anticipos. Después implementar el adaptador de ReservationPaymentPort en bootstrap, registrar PaymentService, endpoints contract-first de inicio/verificación/webhook y simulador HTTP dev/test. Añadir evento de pago al outbox existente y una credencial pública restringida, con recuperación después de reconexión.

Persistir hash/rotación del comprobante únicamente tras reserva confirmada y pago verificado. Implementar consulta HTTPS mínima y consulta de staff autorizada; seleccionar biblioteca QR con compatibilidad Angular, licencia y mantenimiento comprobados al implementar el escáner. Check-in bloqueará reserva y todos los elementos en orden estable, validará política temporal/pago/permisos y aplicará estados existentes en una transacción.

Para un país concreto: elegir proveedor autorizado con documentación oficial, credenciales y sandbox; validar moneda/unidades/redondeo, comercio receptor, autenticación/rotación webhook, caducidad, reversos/reembolsos y conciliación. Desarrollar adaptador real y pruebas sandbox sin afirmar cobertura bancaria universal. Ejecutar E2E completo y documentar las cuatro verticales antes de solicitar revisión/publicación.

Historias adicionales propuestas, sin modificar Jira: configuración internacional y QR propio; comprobantes verificables; escaneo/check-in y ocupación.
