# Informe de auditoría MVP — MAP-236 / HU-7.05

> Auditoría del 21/11/2026. Rama auditada: HU-1.04-—-Gestión-de-usuarios-roles-y-permisos-por-tenant. Esa rama no estaba fusionada a main en la fecha de ejecución. Este informe se entrega en feat/GatoCoder282/MAP-236-validacion-integral-mvp, rama documental independiente desde origin/main, y no certifica automáticamente main.

## Resumen y criterio de clasificación

La evidencia detallada de comandos y ejecuciones está en [test-results.md](test-results.md). PASS significa comportamiento comprobado en el alcance indicado; FAIL, comportamiento incorrecto observado; BLOCKED, dependencia que impidió validarlo; NOT RUN, prueba no realizada. Una inspección de código o una prueba con API simulada no equivale a un flujo integrado completo.

El MVP tiene flujos verificables de identidad, gestión de usuarios, editor, disponibilidad y reserva pública. Quedan una escritura legacy anónima confirmada, un error global observado históricamente al navegar al pago y una carrera del smoke Playwright. La repetición focal de reserva → pago no reprodujo el error. La operación de reservas por establecimiento requiere validación propia sin clave Jira confirmada; MAP-260 corresponde al despliegue real de Unleash.

## Inventario funcional

| Área                               | Funcionalidad                                | Implementación                                        | Validación                                | Evidencia y observación                                                                                                                                            |
| ---------------------------------- | -------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Autenticación y roles              | JWT, login y rutas                           | IMPLEMENTADO                                          | PASS parcial                              | E2E de login y acceso SUPER_ADMIN con backend real; no se completó recorrido funcional de MANAGER/STAFF.                                                           |
| Usuarios y asignaciones            | Invitación, rol, baja y acceso STAFF a local | IMPLEMENTADO en MAP-238                               | PASS del alcance probado                  | E2E de usuarios real; integración HTTP previa de grants y check-in. La operación adicional por establecimiento no tiene clave Jira confirmada.                     |
| Establecimientos, pisos y sectores | CRUD y selección                             | IMPLEMENTADO                                          | FAIL de seguridad                         | POST anónimo de piso devolvió 201; la lectura quedó acotada al demo y el recurso ajeno dio 404.                                                                    |
| Editor visual                      | Plantas, sectores y elementos                | IMPLEMENTADO                                          | PASS parcial                              | Fase 9: sector y tres elementos persistidos y pintados tras mover, guardar y recargar; no cubre cada secuencia.                                                    |
| Reservas operativas                | Listado y operación por local                | PARCIAL                                               | BLOCKED para aceptación integral          | Lectura y transición independientes por establecimiento pendientes, sin clave Jira confirmada; check-in con can_check_in tiene evidencia previa.                   |
| Reservas públicas                  | Creación anónima                             | IMPLEMENTADO                                          | PASS focal; incidencia histórica          | Fase 9: HTTP 201 y checkout sin errores capturados; fase 4 registró error global intermitente.                                                                     |
| Disponibilidad y selección         | Fecha, intervalo, espacio y mapa             | IMPLEMENTADO                                          | PASS                                      | Recorrido con backend real; E2E desktop/móvil de interfaz, con tramos simulados.                                                                                   |
| Pagos y comprobante                | Checkout, webhook y comprobante MOCK         | IMPLEMENTADO según MAP-229; alcance CU-17 por decidir | PASS solo MOCK                            | MAP-229 está Listo y exige E2E con MOCK. El roadmap CU-17 menciona pasarela bancaria real; su vigencia requiere decisión del equipo.                               |
| Autogestión e historial            | Vistas públicas                              | IMPLEMENTADO                                          | PASS de interfaz                          | E2E desktop/móvil con API simulada; integración real de estos casos no se repitió.                                                                                 |
| Tiempo real                        | STOMP y actualización                        | IMPLEMENTADO                                          | NOT RUN entre dos navegadores             | Integración previa disponible; falta escenario funcional actual de dos sesiones.                                                                                   |
| Dashboard                          | Indicadores y estados sin datos              | IMPLEMENTADO                                          | NOT RUN funcionalmente aquí               | Spec local de [CU-10](../CU-10-dashboard-admin-home/tasks.md); no tratar «Sin datos» previsto como bug.                                                            |
| Configuración de vertical          | Cuatro modos de negocio                      | PARCIAL                                               | BLOCKED para aceptación integral          | En [HU-7.01/7.02](../HU-7.01-7.02-configuracion-y-validacion-integral-de-las-cuatro-verticales/tasks.md), MAP-232 está marcado; otras subtareas siguen pendientes. |
| Auditoría                          | Registro y consulta ADMIN                    | IMPLEMENTADO                                          | PASS de integración; NOT RUN en navegador | Integración previa y [HU-5.03](../HU-5.03-bitacora-auditoria/tasks.md); falta consulta funcional actual por roles.                                                 |
| Responsive                         | Vistas críticas                              | PARCIAL                                               | PASS de vistas inspeccionadas             | Escritorio y 390 × 844 en pantallas concretas. No cubre todos los modales, tablas ni estados.                                                                      |

## Seguridad y aislamiento

En backend y PostgreSQL efímeros se crearon establecimientos de prueba en el tenant demo y en otro tenant. Las solicitudes no llevaban JWT:

| Operación                                     | Esperado                                              | Real                                                | Interpretación                    |
| --------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- | --------------------------------- |
| GET /api/v1/establishments                    | Lectura limitada al contexto que resuelve el servidor | 200; apareció el establecimiento demo y no el ajeno | Lectura acotada en ese escenario. |
| POST /api/v1/establishments/{id-demo}/floors  | Rechazo de escritura anónima                          | 201; piso de prueba creado                          | Defecto confirmado.               |
| POST /api/v1/establishments/{id-ajeno}/floors | Sin acceso al recurso de otro tenant                  | 404                                                 | No se observó escritura cruzada.  |

La ruta conserva una apertura temporal en SecurityConfig de la rama auditada. La evidencia **no permite** declarar vulnerables otros métodos legacy ni afirmar una fuga entre tenants. Los permisos operativos independientes por establecimiento son una necesidad distinta, sin clave Jira confirmada.

## Fichas de defectos y tickets Jira

El 22/11/2026 se crearon únicamente los dos Bugs confirmados, después de comprobar duplicados por JQL. Ambos quedaron Por hacer, sin responsable ni sprint asignado. La incidencia intermitente de reserva → pago permanece documentada **sin ticket**.

### BUG A — [MAP-336](https://matiasmv2005.atlassian.net/browse/MAP-336): POST de pisos legacy permite crear un piso sin JWT

- **Tipo y área:** defecto funcional de seguridad, backend / espacios.
- **Precondiciones:** establecimiento demo existente en la base PostgreSQL desechable y backend temporal.
- **Pasos:** enviar sin Authorization un POST a /api/v1/establishments/{id-demo}/floors con nombre y slug de un piso ficticio; repetir contra el ID de establecimiento del otro tenant.
- **Esperado:** denegar la escritura sin identidad de staff; no permitir operar sobre el otro tenant.
- **Actual:** demo respondió 201 y creó el piso; el establecimiento ajeno respondió 404.
- **Evidencia:** respuestas HTTP de fase 4, datos desechables y regla temporal en SecurityConfig de la rama auditada. No se conserva una captura, ni hace falta para acreditar las respuestas registradas.
- **Severidad:** alta. **Sprint recomendado:** 5. **Historia relacionada:** MAP-236; CU-04/CU-05 y CU-24.
- **Jira:** Bug, prioridad **High**, estado **Por hacer**, sin sprint ni responsable; vínculo **relates to** con MAP-236. La recomendación Spring 5 no es una asignación Jira.
- **Estado de verificación:** confirmado para ese POST. Revisar otras escrituras legacy como alcance de investigación, sin atribuirles el defecto antes de probarlas.

### Incidencia C — Error global observado al pasar de reserva a pago (sin ticket Jira)

- **Tipo y área:** incidencia de producto con causa pendiente, Public Web / reserva.
- **Precondiciones:** espacio disponible y backend temporal; datos de cliente ficticios.
- **Pasos:** seleccionar fecha, intervalo y espacio; completar nombre y correo de prueba; pulsar «Confirmar reserva» y observar navegación y consola.
- **Esperado:** reserva creada y navegación a pago sin excepción global.
- **Actual:** en fase 4 se creó la reserva y abrió el anticipo, pero la consola registró `app.error.unhandled`. En fase 2 se observó `NG0911: View has already been destroyed` en ese tramo. En la repetición de fase 9, la reserva respondió 201, abrió checkout y no produjo `pageerror` ni errores de consola.
- **Evidencia:** registro de consola de fase 4, observación de fase 2 y [resultado sanitizado de fase 9](evidence/phase9-booking-result.json). El componente booking-page.ts de la rama auditada contiene trabajo asíncrono posterior al submit, pero eso no prueba la causa.
- **Severidad:** media provisional. **Sprint recomendado:** 5. **Historia relacionada:** MAP-236 y CU-16 / HU-6.02.
- **Estado de verificación:** incidencia histórica intermitente, no reproducida en fase 9; falta traza completa de una aparición futura para cerrar diagnóstico. No se afirma que `NG0911` y `app.error.unhandled` sean la misma excepción ni que el defecto esté corregido.
- **Decisión Jira:** no crear Bug, Task, subtarea ni ticket de investigación en esta ronda; conservar únicamente este hallazgo documental.

### BUG B — [MAP-337](https://matiasmv2005.atlassian.net/browse/MAP-337): el smoke recarga sin esperar la navegación de «Volver»

- **Tipo y área:** defecto de automatización, Playwright / pago MOCK.
- **Precondiciones:** smoke payment-live/flow.spec.ts en el paso de regreso desde el formulario de reserva.
- **Pasos:** ejecutar el smoke; después de pulsar booking-back, el script llama inmediatamente a page.reload() sin esperar URL o estado de destino.
- **Esperado:** confirmar que terminó la navegación antes de recargar y continuar.
- **Actual:** una ejecución pasó y otra terminó en timeout; la secuencia actual permite recargar la página anterior.
- **Evidencia:** ejecución fallida y aprobada de fase 2, más la secuencia en [flow.spec.ts](../../apps/e2e/tests/payment-live/flow.spec.ts).
- **Severidad:** media para la fiabilidad de pruebas. **Sprint recomendado:** 5. **Historia relacionada:** MAP-236 y MAP-229.
- **Jira:** Bug, prioridad **Medium**, estado **Por hacer**, sin sprint ni responsable; vínculos **relates to** con MAP-236 y MAP-229. La recomendación Spring 5 no es una asignación Jira.
- **Estado de verificación:** carrera de la prueba confirmada. No se clasifica como defecto funcional del producto.

## Pendientes, riesgos y pruebas no ejecutadas

**Funcionalidades pendientes, no bugs por sí mismas:** lectura y transición operativa independientes por establecimiento, sin clave Jira confirmada; MAP-260 **no** es su dueño: Jira lo define ahora como HU-3.03, despliegue real de Unleash. CU-19–CU-22 requieren reglas y aceptación integral de las cuatro verticales. [MAP-229](../HU-6.03-integracion-de-pago-qr/spec.md) está Listo y sus criterios incluyen QR, webhook válido e idempotente, actualización de estado y E2E con gateway MOCK. La pasarela bancaria real mencionada en [use_cases.md](../../docs/roadmap/use_cases.md) para CU-17 es una diferencia de alcance pendiente de decisión del equipo, no incumplimiento automático de MAP-229.

**Riesgos no concluyentes:** comportamiento de otras escrituras legacy, causa exacta del error global, integración real de las vistas públicas E2E simuladas y comportamiento de main respecto de la rama auditada. No se extrapola el 404 del recurso ajeno a todas las rutas.

**Pruebas no ejecutadas en navegador:** login y restricciones integrales de MANAGER/STAFF, actualización en tiempo real entre dos sesiones, consulta de bitácora por roles, recorrido completo de dashboard/configuración y todas las vistas responsive. La tabla móvil de tenants resultó densa, sin defecto bloqueante demostrado.

### MAP-324 — Plano vacío después de guardar

Jira mantiene [MAP-324](https://matiasmv2005.atlassian.net/browse/MAP-324) Por hacer en **Spring 6**. Su título y descripción mencionan Sprint 7; ese texto no cambia su asignación real. El E2E anterior solo acreditó API persistida y canvas visible. En fase 9, sobre la rama auditada, se movió un sector de (40, 40) a (95, 75), se guardó con HTTP 200 y se recargó: la API conservó la posición y tres elementos; el canvas de Konva volvió a pintar el contorno y los elementos. Véanse la [captura](evidence/phase9-map324-reloaded.png), las [medidas del canvas](evidence/phase9-map324-result.json) y los límites de [test-results.md](test-results.md). El plano vacío **no se reprodujo en ese escenario**; no se descartan otras regresiones ni se propone un Bug nuevo por este resultado.

| Smoke crítico | Evidencia de MAP-236 sobre la rama auditada                                                                                                       | Límite                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Editor/mapa   | PASS fase 9, navegador + backend + PostgreSQL temporales; persistencia y renderizado tras recargar.                                               | Otras secuencias de plano vacío, NOT RUN.                                                |
| Reservas      | PASS fase 9, navegador + HTTP real: reserva 201 y checkout visible.                                                                               | Los E2E públicos previos interceptaron la API; no sustituyen esta comprobación real.     |
| Pago QR MOCK  | Un smoke de fase 2 pasó con backend y PostgreSQL reales; el proveedor de dinero fue MOCK. Otra ejecución terminó en timeout por carrera del test. | No hubo pasarela bancaria real ni nueva ejecución en fases 9–10.                         |
| Check-in      | PASS fase 10, un método de integración con HTTP real y PostgreSQL Testcontainers: STAFF asignado 200, no asignado 403, reserva ACTIVE persistida. | La interfaz de recepción y el esquema JSON de la respuesta no se comprobaron en fase 10. |

La matriz tiene evidencia funcional representativa y límites explícitos, incluida la UI de check-in NOT RUN. Por decisión del usuario, MAP-236 no solicita más revisión ni pruebas de MAP-324; no se cambió su estado en Jira.

### Duplicados de bugs

Antes de crear cada Bug, la búsqueda JQL focal no encontró equivalentes entre Bugs, historias o subtareas de MAP. MAP-268/269/258 tratan auditoría o navegación espacial, no el POST anónimo probado; MAP-318 y otros resultados de navegación tampoco describen la carrera `booking-back` → `reload()`. La búsqueda posterior de issues tipo Bug en MAP devolvió solo [MAP-336](https://matiasmv2005.atlassian.net/browse/MAP-336) y [MAP-337](https://matiasmv2005.atlassian.net/browse/MAP-337). MAP-324 trata otro síntoma del editor; no duplica ninguno de los dos Bugs. La incidencia C no originó ticket.

## Trazabilidad y estado Jira

Los estados siguientes se verificaron mediante JQL en el sitio correcto. La evidencia del repositorio es histórica y puede corresponder a otra revisión. La spec de HU-1.04 pertenecía solo a la rama auditada en la fecha inicial; entró después mediante la integración de origin/main en esta rama documental. No se repitieron aquí las pruebas de la auditoría ni se certifica el estado actual de main.

| Historia               | Estado y sprint Jira | Subtareas Jira                            | Evidencia local y acción recomendada                                                                                                                                                                                |
| ---------------------- | -------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAP-236 / HU-7.05      | En curso · Spring 6  | MAP-324 Por hacer                         | Auditoría y prueba focal documentadas; Bugs MAP-336/337 creados. La entrega documental queda preparada sin actuar sobre MAP-324.                                                                                    |
| MAP-231 / HU-7.01/7.02 | Listo · Spring 5     | MAP-232/233/234/235/247/248/249 Por hacer | [Tareas locales](../HU-7.01-7.02-configuracion-y-validacion-integral-de-las-cuatro-verticales/tasks.md): MAP-232 marcada completa, otras capacidades pendientes. Discrepancia registrada, sin intervención en Jira. |
| MAP-194 / HU-5.03      | Listo · Spring 4     | MAP-222–226 Por hacer                     | [Tareas locales](../HU-5.03-bitacora-auditoria/tasks.md) y pruebas marcadas completas; evidencia de PR no revisada aquí. Sin acciones adicionales en MAP-236.                                                       |
| MAP-238 / HU-1.04      | QA · Spring 6        | MAP-244/245/246 Por hacer                 | T12 y CA-01–CA-12 marcados PASS en el alcance aprobado de la rama auditada, aún no fusionada en la fecha de ejecución. Sin acciones adicionales en MAP-236.                                                         |
| MAP-229 / HU-6.03      | Listo · Spring 5     | Sin subtareas consultadas                 | Flujo MOCK integrado y E2E requerido por Jira; no reabrir solo por ausencia de pasarela bancaria real.                                                                                                              |
| MAP-260 / HU-3.03      | En curso · Spring 6  | MAP-280–284 Por hacer                     | Despliegue real y operación segura de Unleash. Su antiguo alcance de panel STAFF fue sustituido; no atribuirle permisos de reservas ni check-in.                                                                    |

La evidencia histórica de MAP-194 distingue MAP-222 (entidad, migración y RLS), MAP-223 (eventos y rollback), MAP-224 (endpoint y autorización), MAP-225 (vista ADMIN y estados) y MAP-226 (integración y checks). Su estado Jira no se altera ni genera tareas de cierre en MAP-236.

### MAP-231 — Validación de las cuatro verticales

En Jira, la historia principal figura como **Listo**, pero sus siete subtareas (MAP-232, MAP-233, MAP-234, MAP-235, MAP-247, MAP-248 y MAP-249) permanecían **Por hacer** durante la auditoría. La [evidencia local](../HU-7.01-7.02-configuracion-y-validacion-integral-de-las-cuatro-verticales/tasks.md) indica que MAP-232 estaba marcada completa y que algunas capacidades de las cuatro verticales todavía requerían validación o implementación. Esta discrepancia queda registrada como observación de la auditoría, sin modificar estados de Jira ni asumir su resolución dentro de MAP-236. No se crea Bug ni tarea nueva por ella.

### Evidencia histórica de subtareas relacionadas

Los estados Jira se consultaron el 22/11/2026; las pruebas locales corresponden a las fechas de [test-results.md](test-results.md). Esta tabla conserva la evidencia observada sin asignar trabajo adicional a MAP-236.

| Jira                  | Evidencia disponible                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- |
| MAP-232               | Vertical por establecimiento y flag marcados completos localmente.                            |
| MAP-233               | Reglas de reservas por turno, noche y estadía pendientes localmente.                          |
| MAP-234               | Terminología y formularios por vertical pendientes localmente.                                |
| MAP-235               | Integración, aislamiento y regresiones pendientes localmente.                                 |
| MAP-247               | Catálogo y plantillas para cuatro verticales pendientes localmente.                           |
| MAP-248               | Integración con mapa, disponibilidad y reservas pendiente localmente.                         |
| MAP-249               | E2E y aceptación de cuatro verticales pendientes localmente.                                  |
| MAP-222               | Entidad, migración, RLS e inmutabilidad marcadas completas localmente.                        |
| MAP-223               | Eventos y rollback marcados completos localmente.                                             |
| MAP-224               | Endpoint y autorización marcados completos localmente.                                        |
| MAP-225               | Vista ADMIN marcada completa localmente.                                                      |
| MAP-226               | Integración marcada completa; adjuntos de evidencia de PR pendientes en las tareas locales.   |
| MAP-238 y MAP-244–246 | Padre en QA, subtareas Por hacer; T12 y criterios locales marcados PASS en la rama auditada.  |
| MAP-324               | Editor, reserva, QR MOCK y check-in API con evidencia; UI de check-in NOT RUN.                |
| MAP-229               | Listo; sus criterios Jira incluyen E2E con gateway MOCK.                                      |
| MAP-260               | En curso en Spring 6; despliegue real de Unleash, sin relación con permisos operativos STAFF. |

El usuario aprobó para MAP-236 la prioridad **High** de [MAP-336](https://matiasmv2005.atlassian.net/browse/MAP-336) y **Medium** de [MAP-337](https://matiasmv2005.atlassian.net/browse/MAP-337). MAP-194, MAP-238 y MAP-324 no requieren más acciones en esta entrega. La incidencia reserva → pago permanece sin ticket. Ninguno de los dos Bugs tiene sprint Jira asignado; no se cambiaron sprints ni estados.

## Priorización Sprint 5 / Sprint 6

La tabla separa asignación **actual de Jira**, recomendación histórica de la auditoría y decisión del usuario. Ningún sprint se modificó; MAP-336 y MAP-337 existen y siguen sin sprint Jira.

| Asunto                         | Sprint Jira actual                   | Recomendación histórica QA                | Decisión para MAP-236                                                  |
| ------------------------------ | ------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------- |
| MAP-336, POST anónimo de pisos | Sin sprint; MAP-236 en Spring 6      | Spring 5 por impacto de seguridad         | Prioridad High aprobada; asignación de sprint fuera de esta entrega.   |
| MAP-337, carrera Playwright    | Sin sprint; MAP-229 en Spring 5      | Spring 5 por fiabilidad de automatización | Prioridad Medium aprobada; asignación de sprint fuera de esta entrega. |
| MAP-231, cuatro verticales     | Spring 5; padre Listo                | Conservar compromiso registrado           | Discrepancia documentada, sin intervención.                            |
| MAP-194 y MAP-238              | Spring 4 y Spring 6, respectivamente | Revisión histórica propuesta              | Sin acciones adicionales.                                              |
| MAP-324, plano vacío y smoke   | Spring 6; texto menciona Sprint 7    | Prueba focal y matriz smoke realizadas    | Sin más revisión ni pruebas; limitaciones documentadas.                |
| Incidencia reserva → pago      | Sin ticket                           | Investigación si reaparece                | Solo documentada, sin ticket.                                          |

MAP-229 conserva su estado Listo en Spring 5 y los criterios con gateway MOCK; MAP-260 sigue En curso en Spring 6 con alcance Unleash real. Esos estados y las funcionalidades pendientes se registran como contexto, sin decisiones de implementación o planificación dentro de MAP-236.

## Estado del MVP y cierre de MAP-236

**Funciona en el alcance probado:** identidad de plataforma, usuarios, editor con contenido tras recarga, disponibilidad, selección y creación pública, check-in por API con STAFF asignado; checkout MOCK integrado en una ejecución. **Defectos:** escritura anónima confirmada, error global histórico intermitente con causa pendiente y carrera confirmada del test. **Pendientes separados:** permisos operativos sin clave confirmada, validación integral de cuatro verticales, despliegue real de Unleash en MAP-260 y decisión de alcance sobre banco QR real en CU-17. **Bloqueadores potenciales:** seguridad legacy y compromisos funcionales que el equipo mantenga para el MVP. **Sin comprobar funcionalmente:** otras secuencias de plano vacío, interfaz de check-in actual, dos navegadores en tiempo real, bitácora por roles, todos los roles y toda la cobertura responsive.

La trazabilidad Jira y los dos Bugs autorizados ya están registrados. Con la prioridad aprobada y las decisiones de alcance del usuario, CA-08 queda cumplido para la entrega documental: MAP-231 consta como observación; MAP-194, MAP-238 y MAP-324 no generan más acciones en MAP-236. La incidencia intermitente conserva su evidencia sin ticket. El commit y push de esta rama están autorizados; el PR requiere autorización aparte y después podrá solicitarse el cierre administrativo de MAP-236. Véanse [spec.md](spec.md) y [tasks.md](tasks.md).
