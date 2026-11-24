# Tareas — HU-7.05 Validación integral del MVP

> MAP-236. Registro retrospectivo de las fases 1–10. El plan y esta lista se redactaron después de las pruebas iniciales y se actualizaron con las verificaciones posteriores.

## Auditoría ejecutada

- [x] Fijar la línea base de Git: **rama auditada** HU-1.04-—-Gestión-de-usuarios-roles-y-permisos-por-tenant, fecha, upstream y archivos locales conservados.
- [x] Diagnosticar el alcance MVP y sus dependencias a partir de los CU/HU disponibles (fase 1).
- [x] Ejecutar la línea base de contrato y calidad: api:lint, check e integración completa; registrar resultados y límites (fase 2).
- [x] Reproducir focalmente el cambio de estado de elementos con seis pruebas de integración y descartar la sospecha de precedencia del matcher (fase 3).
- [x] Probar HTTP anónimo de rutas legacy en backend y PostgreSQL desechables: lectura 200, creación de piso demo 201, acceso a establecimiento de otro tenant 404 (fase 4).
- [x] Recorrer reserva pública hasta la pantalla de anticipo y registrar el error global; conservar NG0911 como observación distinta sin causa raíz demostrada (fases 2 y 4).
- [x] Ejecutar tres E2E de Console con backend real y doce E2E públicos de escritorio/móvil, identificando los tramos con API simulada (fase 4).
- [x] Inspeccionar pantallas representativas de Console y Public Web en escritorio y 390 × 844; registrar vistas no inspeccionadas (fase 4).
- [x] Consolidar inventario, tres fichas de defectos y propuesta Sprint 5 / Sprint 6 sin duplicar pruebas (fase 5).
- [x] Crear en rama separada los cinco documentos de MAP-236 y validar únicamente su formato y referencias (fase 6).
- [x] Consultar mediante JQL el Jira correcto: MAP-236/MAP-324, MAP-231 y siete subtareas, MAP-194 y cinco subtareas, MAP-238 y tres subtareas, MAP-229 y MAP-260; contrastar criterios con las specs locales (fase 7B).
- [x] Buscar duplicados de los tres hallazgos: ningún issue de tipo Bug en MAP y ningún equivalente evidente en las búsquedas focales de esa fase; la comprobación final se realizó antes de crear los Bugs.
- [x] Verificar focalmente MAP-324 en la rama auditada: mover, guardar y recargar un sector con tres elementos; comprobar layout persistido y contenido pintado en el canvas de Konva (fase 9).
- [x] Repetir una reserva pública real hasta checkout: HTTP 201 y pantalla de pago visible, sin `pageerror` ni errores de consola en esa ejecución (fase 9). Conservar las observaciones previas como incidencia intermitente no diagnosticada.
- [x] Ejecutar un único método de integración HTTP con PostgreSQL Testcontainers: STAFF sin concesión 403, STAFF asignado 200, reserva `ACTIVE` y evento de check-in persistido (fase 10).
- [x] Comprobar duplicados mediante JQL antes de cada creación; revisar también historias y subtareas temáticamente próximas, sin encontrar equivalentes de los dos defectos confirmados.
- [x] Crear [MAP-336](https://matiasmv2005.atlassian.net/browse/MAP-336) (Bug de seguridad, High) y [MAP-337](https://matiasmv2005.atlassian.net/browse/MAP-337) (Bug de automatización, Medium); verificar estado Por hacer, vínculos, ausencia de sprint y responsable. No crear ticket para la incidencia intermitente de reserva → pago.

## Decisiones de cierre documental

- [x] Registrar la discrepancia de MAP-231 y sus siete subtareas sin intervenir en Jira.
- [x] Conservar MAP-194 y MAP-238 como trazabilidad histórica, sin acciones adicionales en MAP-236.
- [x] Conservar la evidencia focal y los límites de MAP-324 sin solicitar otra revisión ni ejecutar más pruebas.
- [x] Registrar la prioridad aprobada: MAP-336 High por seguridad y MAP-337 Medium por automatización; ambos Bugs permanecen sin sprint Jira asignado.
- [x] Mantener la incidencia intermitente reserva → pago documentada, sin ticket ni causa raíz confirmada.
- [x] Completar CA-08 de [spec.md](spec.md) para la entrega documental con las decisiones anteriores y CA-07 cumplido.
- [ ] Crear el PR documental cuando el usuario lo autorice; después podrá solicitarse el cierre administrativo de MAP-236. El commit y push de esta rama ya cuentan con autorización. No se exige resolver las otras historias dentro de esta entrega.

El detalle de la evidencia está en [audit-report.md](audit-report.md). No se cambiaron estados ni sprints Jira.

## Notas de ejecución

### Revisión y entorno

La auditoría inicial se ejecutó el 21/11/2026 en la rama auditada HU-1.04; las verificaciones focales de fases 9–10 se completaron el 21–22/11/2026 en esa misma rama. Su PR aún no estaba fusionado durante la auditoría. La documentación se redactó desde origin/main en feat/GatoCoder282/MAP-236-validacion-integral-mvp; posteriormente se integró origin/main, que ya contenía HU-1.04. No se repitieron pruebas en main, de modo que los resultados de la rama auditada no certifican su estado actual.

PostgreSQL, backend y frontends temporales de la fase 4 se retiraron; no se modificó la base persistente. Los comandos y resultados exactos se consolidan en [test-results.md](test-results.md). El inventario, las fichas y la priorización están en [audit-report.md](audit-report.md).

### Hallazgos y límites

La escritura anónima confirmada se limita al POST de pisos probado. El 404 del recurso de otro tenant confirma únicamente ese caso de aislamiento; no prueba todas las rutas. La reserva alcanzó el pago pero registró app.error.unhandled; la observación previa NG0911 no se atribuye automáticamente al mismo origen. El smoke Playwright pasó una vez y falló otra por timeout tras una recarga sin espera explícita de navegación. Los flujos funcionales de MANAGER/STAFF, dos navegadores en tiempo real y bitácora por roles no quedaron cubiertos en navegador.

MAP-238 tiene evidencia local de cierre técnico dentro de su alcance aprobado, mientras Jira lo mantiene en QA con MAP-244–246 Por hacer. La necesidad de permisos independientes de lectura y transición por establecimiento permanece sin clave Jira confirmada. **MAP-260 corresponde ahora a HU-3.03: despliegue real de Unleash**, En curso en Spring 6 según JQL del 22/11/2026; su antiguo alcance de panel STAFF fue sustituido.

MAP-231 figura Listo en Spring 5 con MAP-232/233/234/235/247/248/249 Por hacer; MAP-232 está marcada completa localmente y otras capacidades de las cuatro verticales requerían validación o implementación durante la auditoría. La discrepancia se documenta sin intervención en Jira. MAP-194 figura Listo en Spring 4 con MAP-222–226 Por hacer: sus tareas locales y pruebas están marcadas, mientras la evidencia de PR no se revisó aquí; no se acordaron acciones adicionales. MAP-229 figura Listo en Spring 5 y sus criterios incluyen E2E con gateway MOCK; una pasarela bancaria real pertenece al alcance más amplio del roadmap CU-17 si el equipo lo mantiene. MAP-236 sigue En curso en Spring 6.

MAP-324 figura Por hacer en Spring 6, aunque su título y descripción mencionan Sprint 7. El E2E anterior solo comprobó persistencia por API y visibilidad del canvas. En fase 9, la prueba focal confirmó además sector y tres elementos pintados después de mover, guardar y recargar; el plano vacío no se reprodujo en ese escenario. En fase 10, un método de integración con HTTP real verificó check-in de STAFF asignado y rechazo del no asignado, sin probar la interfaz. La matriz y los límites están en [audit-report.md](audit-report.md) y [test-results.md](test-results.md). La bitácora HU-5.03 tiene pruebas de integración, pero faltó su recorrido funcional en esta auditoría.

### Estado Jira y entrega

La conexión inicial no permitía consultar el Jira correcto y el endpoint directo de lectura falló; la búsqueda JQL sí funcionó después en matiasmv2005.atlassian.net. En esta ronda se crearon solo MAP-336 y MAP-337, ambos Por hacer, sin sprint ni responsable; MAP-336 se vinculó con MAP-236 y MAP-337 con MAP-236/MAP-229 mediante «relates to». No se cambiaron estados ni sprints de historias existentes. El usuario aprobó las prioridades y acotó la entrega a la documentación; la asignación de sprint de los Bugs no se realizó ni es requisito de CA-08.
