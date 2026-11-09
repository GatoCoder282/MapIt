# Cierre parcial — reservas con mapa y QR MOCK

## Estado

**Reanudación 03/11:** HEAD observado ahora `7b7e643`, con cambios externos extensos en Console, contexto operativo y pruebas. No se sobrescribieron ni se validaron como parte de esta entrega. Los resultados citados abajo corresponden a las revisiones indicadas, no acreditan este nuevo workspace. `docker info` sigue fallando por pipe `dockerDesktopLinuxEngine` inexistente; no se repiten IT/E2E mientras persista ese bloqueo.

**HU-6.03 no completada.** HEAD observado: `15fd0c4`. La última comprobación de entorno no encuentra el motor Docker Desktop Linux; integración y nuevas coberturas E2E permanecen bloqueadas. No se configuró Pollos por SQL, no se eligieron importes de negocio ni se afirmó transferencia real. Esta sesión no hizo commits ni push; hubo commits externos durante las interrupciones.

## Causas y correcciones verificadas por lectura

- Los errores Java indicados no se reprodujeron con Gradle: compilación forzada exitosa, 48 tareas ejecutadas. No hay diagnóstico confirmado del IDE; no se alteraron imports para silenciar errores inexistentes en el compilador.
- Checkout conservaba pago/comprobante tras caducar la credencial y aceptaba un refresh de otra reserva. `payment-store.ts` valida ámbito y descarta datos/enlaces; dos regresiones añadidas.
- Checkout sin cotización ofrecía pagar después de finalizar la reserva. `PublicCheckoutService.java` devuelve `PAYMENT_WINDOW_EXPIRED` desde `endsAt`; prueba de frontera antes/en/después sin insertar quote.
- Respuestas tardías de policy/metadata tras cambiar establecimiento/sector mantenían bloqueado el guardado. Stores de Console liberan el estado; readiness diferencia 403 de policy ausente.
- Cuatro fixtures de layouts creaban elementos anónimamente después de restringir el CRUD. `FloorLayoutApiIntegrationTest.java` usa JWT ADMIN real, sin abrir endpoints. Su resultado focal final no quedó acreditado; Spotless focal no equivale a integración aprobada.
- Policy/metadata UI ya existían. Se conservaron sin preseleccionar moneda, anticipo, plazo o capacidad. `SECTOR_ZONE` sigue elegible y `DECOR` excluido; no se cambiaron reglas de otras verticales.

## Archivos intervenidos por las lanes

Durante esta ejecución, antes de los commits externos:

- Backend: `PublicCheckoutService.java`, `PublicPaymentServicesTest.java` y `FloorLayoutApiIntegrationTest.java`.
- Console: `features/payments/model/payment-methods-store.ts` y `.spec.ts`; `features/map-editor/model/map-editor-store.ts` y `.spec.ts`; `core/strings.ts`.
- Public Web: `features/payment/model/payment-store.ts` y `.spec.ts`.
- E2E pendientes contra HEAD actual: `apps/e2e/tests/payment-live/flow.spec.ts`, `mock-qr.spec.ts`, `setup.ts`.
- Documentación owner: `tasks.md` de esta carpeta y este informe. No se atribuye todo el diff histórico del repositorio a estas lanes.

Los últimos cambios E2E estabilizan selectores/click de canvas, preparan carrera HTTP real para 409, navegación móvil/teclado y expiración de credencial. `setup.ts` registra hash del JAR y revisión observada para próximas ejecuciones; registrar ambos no demuestra por sí solo que el JAR se compiló desde esa revisión. La expiración preparada envejece timestamps únicamente en la BD desechable del test, no espera el reloj natural ni modifica policy/dinero/dataset del usuario. **Esas ampliaciones aún no se ejecutaron.**

## Pruebas y resultados

| Comando/evidencia                                  | Resultado y límite                                                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Compilación `:bootstrap:compileJava --rerun-tasks` | SUCCESS, 48 tareas; ejecución previa al cambio externo de HEAD.                                                                                                                                  |
| `PublicPaymentServicesTest` focal                  | SUCCESS después del guard `endsAt`; no se ejecutó rojo previo.                                                                                                                                   |
| `ng test libs` focal motor                         | 2/2; readonly/selección, no reemplaza gesto de navegador.                                                                                                                                        |
| `ng test console` focal inspector                  | 2/2, proceso terminó; no se reprodujo timeout anterior.                                                                                                                                          |
| `pnpm api:lint` / `api:check`                      | Válido/sincronizado; dos warnings health/demo-items en esa ejecución.                                                                                                                            |
| `pnpm be:lint` / `be:test`                         | Exit 0 antes del cambio externo de HEAD; build posterior del check también aprobó.                                                                                                               |
| `pnpm check` del 29/10, HEAD actual                | Exit 1 exclusivamente por formato de flow; lint, tipos, 478 tests frontend (292 Console, 119 público, 67 libs), builds, contrato y backend build/tests/ArchUnit aprobados.                       |
| `pnpm fmt:check` posterior                         | Exit 0. No se reetiqueta retroactivamente el check como exit 0 ni se repiten etapas aprobadas por cambios solo de formato.                                                                       |
| E2E live del 29/10                                 | Q reportó 2 passed, exit 0, 2.4 min; owner leyó `.last-run.json` passed/sin fallidos. Backend/DB/STOMP reales, policy por UI. No hash del JAR de esa ejecución; HTML/capturas ya no disponibles. |
| `pnpm be:it` del 28/10                             | 148 tests, 4 fallos 401 de fixtures layouts; no global verde.                                                                                                                                    |
| `pnpm be:it` reanudado                             | Exit 1: 42 errores de inicialización por Docker ausente; no ejecución de aserciones de negocio.                                                                                                  |
| E2E ampliado y `pnpm e2e` genérico                 | Pendientes; genérico requiere stack completo. Descubrir tests no equivale a ejecutarlos.                                                                                                         |

## Seguridad

Lectura reconciliada: `payment-readiness` conserva ADMIN y valida establecimiento contra tenant autenticado; 404 cruzado es correcto. No se cambió por una consulta anónima. Contexto servlet y ActorContext usan autenticación Spring; STOMP revalida en SUBSCRIBE y entrega outbound. Webhook mantiene HMAC/timestamp, tamaño limitado e idempotencia persistida; no se añadió almacén de nonces innecesario. La auditoría no halló otro defecto demostrable dentro del flujo; no es pentest ni certificación. El fallback histórico `demo` del CRUD temporal sigue siendo un límite conocido fuera del cierre, no una garantía global de fail-closed.

## Criterios de aceptación — evidencia y pendientes

| Criterio principal                             | Estado                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| CA-01 reserva real                             | Evidencia live anterior; revalidación ampliada pendiente.                            |
| CA-02 configuración efectiva                   | Policy ADMIN por UI en live reportado; no se configura Pollos automáticamente.       |
| CA-03 importe/moneda/plazo autoritativos       | Cubierto en focal/live anteriores; suite global vigente bloqueada.                   |
| CA-04/05 intento propio y apertura sin efectos | Evidencia live anterior; no QR bancario genérico ni dinero real.                     |
| CA-06/07 webhook confirma sin ocupar           | Evidencia live anterior HTTP/SQL; no se acredita nueva ejecución con Docker apagado. |
| CA-08/09 STOMP/HTTP/recarga                    | Live anterior; nuevos casos UI de expiración pendientes.                             |
| CA-10 comprobante verificable                  | Live anterior con recarga y QR; no certifica escaneo físico ni artefactos borrados.  |
| CA-11 fallo/expiración                         | Cobertura parcial backend/unitarios; expiración financiera E2E pendiente.            |
| CA-12 cancelación diferenciada                 | Live anterior CANCELLED/reintento; no cancelar reserva ni ocupar.                    |
| 409 UI, responsive y teclado exigidos          | Ampliaciones preparadas; ejecución pendiente.                                        |
| Aislamiento y negativos CN-01…11               | Auditoría y tests existentes; global actual bloqueada, no todos se marcan aceptados. |
| Suites requeridas y cierre completo            | **Pendiente**: IT vigente y E2E ampliado/genérico.                                   |

## Desbloqueo

Abrir Docker Desktop y esperar Running; comprobar `docker info`. Después continuar únicamente IT y E2E pendientes. No borrar volúmenes, regenerar `.env`, desactivar autorización ni sembrar policy para conseguir verde. Pollos requiere elección explícita de sus valores por un ADMIN y evidencia del recorrido, no solo piezas funcionando por separado.
