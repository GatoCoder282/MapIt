# HU-7.05 — Validación integral del MVP y gestión de defectos

> Historia Jira: [MAP-236](https://matiasmv2005.atlassian.net/browse/MAP-236). Documento de consolidación redactado después de la auditoría; no se presenta como especificación aprobada antes de ejecutar las fases 1–5.

## Objetivo

Establecer el estado verificable del MVP de MapIt, identificar defectos reproducibles y riesgos aún no comprobados, y registrar su priorización y trazabilidad. La historia produce evidencia y fichas de defectos; se registraron los dos Bugs confirmados, sin implementar funcionalidades ni correcciones.

**Rama auditada:** HU-1.04-—-Gestión-de-usuarios-roles-y-permisos-por-tenant. La auditoría se ejecutó el 21/11/2026, cuando esa rama no estaba fusionada a main. Esta documentación se entrega en feat/GatoCoder282/MAP-236-validacion-integral-mvp, rama independiente basada en origin/main; los resultados no certifican automáticamente main.

La consulta Jira posterior confirmó MAP-236 **En curso**, asignada a **Spring 6**, y su subtarea MAP-324 **Por hacer** en el mismo sprint. La reconciliación de historias relacionadas y las discrepancias de subtareas están en [audit-report.md](audit-report.md). El estado Jira actual se distingue de las notas históricas del repositorio.

## Alcance

- Console: identidad y navegación por rol, usuarios, contexto operativo, establecimientos, editor visual, reservas, dashboard y configuración.
- Public Web: acceso anónimo, tenant por URL, disponibilidad, selección espacial, reserva, pago MOCK, autogestión e historial.
- Backend: autorización, aislamiento entre tenants, rutas legacy, bitácora y tiempo real.
- Calidad: pruebas automáticas y manuales disponibles, escritorio y móvil representativos, estados de carga, vacío y error, y límites de cobertura.
- Gestión: fichas de defectos, Bugs confirmados en Jira, dependencias del alcance MVP y priorización Sprint 5 / Sprint 6.

El alcance funcional de referencia es [Casos de uso y alcance ampliado](../../docs/roadmap/use_cases.md).

## Fuera de alcance

Implementar o corregir código y pruebas; crear migraciones; activar una pasarela bancaria; cerrar historias ajenas; cambiar estados o crear tickets Jira durante la documentación; declarar cobertura de flujos no ejecutados; certificar main con pruebas de la rama auditada. No se exige una auditoría exhaustiva de accesibilidad ni una comparación visual píxel a píxel.

## Criterios de aceptación

- [x] **CA-01 — Inventario trazable.** Dada la rama auditada en la fecha de ejecución, cuando se consulta [audit-report.md](audit-report.md), entonces cada área distingue estado de implementación, estado de validación, evidencia y límites.
- [x] **CA-02 — Resultados fieles.** Dadas ejecuciones con backend real, API simulada y antecedentes históricos, cuando se consulta [test-results.md](test-results.md), entonces se identifican por separado y no se suman dos veces.
- [x] **CA-03 — Hallazgos verificables.** Dados los dos defectos confirmados y la incidencia intermitente, cuando se revisan sus fichas, entonces constan precondiciones, pasos ejecutados, esperado, actual, evidencia, severidad y grado de certeza.
- [x] **CA-04 — Pendientes separados.** Dado un alcance no implementado o no probado, cuando se clasifica, entonces queda separado de los bugs confirmados y se vincula con la historia o CU correspondiente.
- [x] **CA-05 — Prioridad propuesta.** Dados seguridad, camino de reserva y alcance comprometido, cuando se consulta el plan Sprint 5 / Sprint 6, entonces constan dependencias, impacto, sprint Jira y propuesta de auditoría por separado, sin cambiar unilateralmente un compromiso registrado.
- [x] **CA-06 — Trazabilidad Jira actual.** Dada la conexión al Jira correcto, cuando se consulten MAP-236 y las historias relacionadas, entonces se registrarán sus estados y subtareas actuales frente a la evidencia local.
- [x] **CA-07 — Gestión efectiva de defectos.** Dadas las dos fichas Bug aprobadas, se crearon MAP-336 y MAP-337 y se registraron sus claves, vínculos y estado en [audit-report.md](audit-report.md), sin atribuir una causa al error de reserva ni crearle ticket.
- [x] **CA-08 — Cierre de la historia.** Dadas las evidencias, cuando el responsable apruebe la priorización y las acciones sobre subtareas históricas, se verifique focalmente MAP-324 y se complete CA-07, entonces podrá solicitarse el cierre de MAP-236 sin declarar pruebas no ejecutadas como PASS.

## Evidencia requerida para el cierre

El inventario, la trazabilidad Jira verificada y las fichas están en [audit-report.md](audit-report.md); comandos, resultados y limitaciones están en [test-results.md](test-results.md); secuencia y notas de ejecución en [tasks.md](tasks.md). CA-06 y CA-07 quedan documentados. CA-08 se cumple para la **entrega documental**: el usuario fijó High para MAP-336 y Medium para MAP-337, decidió registrar MAP-231 sin intervención y descartó acciones adicionales sobre MAP-194, MAP-238 y MAP-324; esta última ya tuvo verificación focal. Los Bugs siguen abiertos y sin sprint Jira asignado. El síntoma de reserva permanece documentado sin ticket ni causa raíz confirmada. El cumplimiento de CA-08 permite solicitar el cierre administrativo de MAP-236; no cambia su estado en Jira ni certifica pruebas no ejecutadas.

Esta historia no crea tablas ni modifica el esquema, el contrato API o las reglas de aislamiento.
