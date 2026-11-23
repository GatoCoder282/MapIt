# Plan — HU-7.05 Validación integral del MVP

> Plan retrospectivo de consolidación. Las fases 1–5 se ejecutaron antes de redactar este archivo; no se afirma una aprobación previa de este plan.

## Estrategia utilizada

1. Fijar la **rama auditada**: HU-1.04-—-Gestión-de-usuarios-roles-y-permisos-por-tenant. Registrar fecha, upstream y cambios locales.
2. Aprovechar la línea base de contrato, calidad e integración de la fase 2; reproducir únicamente riesgos sin evidencia suficiente en las fases 3–4.
3. Probar las rutas legacy con PostgreSQL y backend efímeros, dos tenants y datos desechables; distinguir la apertura de la ruta del comportamiento HTTP real.
4. Recorrer Console y Public Web con E2E focalizados y navegador; etiquetar explícitamente las respuestas simuladas y los flujos que usaron backend real.
5. Observar escritorio y móvil representativos; documentar las vistas realmente inspeccionadas y no inferir cobertura visual a partir del CSS.
6. Consolidar pruebas, hallazgos y tareas históricas sin contar dos veces una suite y una prueba incluida en ella.

Los resultados medidos están en [test-results.md](test-results.md); el inventario y las decisiones están en [audit-report.md](audit-report.md).

## Técnicas y herramientas

| Técnica                                   | Uso y límite                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Git y lectura de specs                    | Rama auditada, historial y alcance; HU-1.04 aún no fusionada en la fecha de ejecución.                          |
| pnpm, Gradle, Testcontainers y Playwright | Línea base, integración focal y E2E existentes. Una tarea backend UP-TO-DATE no equivale a recompilación nueva. |
| HTTP contra backend/PG17 temporales       | Lectura y escritura anónimas controladas; el otro tenant permite comprobar el límite del recurso probado.       |
| Navegador Console/Public Web              | Reserva real hasta anticipo, consola de errores y revisión responsive de pantallas concretas.                   |
| API simulada en E2E                       | Verifica interacción y presentación; no acredita integración de esos casos con backend.                         |
| Revisión de código acotada                | Contrasta rutas, autorización y secuencia del smoke; una sospecha en código no se declara bug sin reproducción. |

## Gestión de hallazgos

Cada ficha indica tipo, área, precondiciones, pasos, esperado, actual, evidencia, severidad, sprint e historia. Se separan: bug funcional confirmado; síntoma observado con causa pendiente; problema de automatización; funcionalidad pendiente; riesgo no comprobado; y prueba no ejecutada. Las fichas se prepararon durante la auditoría; posteriormente se registraron MAP-336 y MAP-337 en Jira.

La prioridad considera exposición de seguridad, camino crítico, criterios Jira, alcance más amplio de [use_cases.md](../../docs/roadmap/use_cases.md), dependencias, posibilidad de demo y esfuerzo cualitativo. Se registran por separado el **sprint asignado en Jira**, la **recomendación histórica de QA** y la **prioridad finalmente aprobada**. MAP-336 quedó High y MAP-337 Medium; ninguno tiene sprint Jira asignado. MAP-236 y MAP-324 figuran en Spring 6; MAP-231 y MAP-229 en Spring 5; MAP-194 en Spring 4; MAP-238 y MAP-260 en Spring 6. No se trasladan tickets por inferencia ni por el texto histórico de su descripción.

[MAP-229](../HU-6.03-integracion-de-pago-qr/spec.md) incluye un E2E con gateway MOCK entre sus criterios y está Listo en Jira. La pasarela bancaria real de CU-17 se mantiene como diferencia de alcance del roadmap sujeta a decisión de producto, no como incumplimiento automático de MAP-229. MAP-260 corresponde ahora al despliegue real de Unleash; la necesidad de permisos operativos independientes queda sin clave Jira confirmada. El compromiso registrado de Spring 5 de [HU-7.01/7.02](../HU-7.01-7.02-configuracion-y-validacion-integral-de-las-cuatro-verticales/spec.md) se consigna como contexto histórico; MAP-236 solo documenta la discrepancia de MAP-231.

## Patrones de diseño aplicados

| Patrón        | Por qué aquí                                                                                              | Alternativa descartada                                         |
| ------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Ninguno nuevo | La historia produce evidencia documental y borradores de defectos; no introduce componentes de ejecución. | Añadir un patrón de implementación sin código que lo necesite. |

La matriz, las fichas y las referencias cruzadas son una estructura de informe, no un patrón de software nuevo.

## Limitaciones y riesgos

- El acceso a Jira se resolvió mediante JQL en fase 7B. MAP-231 y MAP-194 figuran Listo con todas sus subtareas Por hacer; la evidencia local no autoriza cerrarlas automáticamente. Por decisión del usuario, MAP-231 queda como observación y MAP-194 no requiere acciones en esta entrega.
- La especificación de HU-1.04 no existía en origin/main durante la auditoría inicial; entró posteriormente al integrar origin/main en esta rama documental. Los resultados se atribuyen a la rama auditada en las fechas de ejecución y no certifican por sí solos el estado actual de main.
- El gateway MOCK valida el flujo técnico con persistencia; no acredita cobro real mediante QR bancario.
- La prueba funcional entre dos navegadores para tiempo real y la consulta de auditoría por roles no se ejecutaron en esta auditoría.
- El error global de reserva y NG0911 se observaron en ejecuciones distintas; no hay traza completa que pruebe una causa única.
- MAP-324 sigue Por hacer. El E2E inicial solo comprobó persistencia y presencia del canvas; la prueba focal posterior de fase 9 confirmó sector y elementos renderizados después de guardar y recargar. La matriz incorpora el check-in por HTTP/integración de fase 10, sin UI. Su texto menciona Sprint 7 aunque Jira la asigna a Spring 6. No se solicitan más revisiones ni pruebas para cerrar documentalmente MAP-236.
- Una ejecución fallida del smoke puede deberse a la secuencia de navegación de Playwright. La ficha de automatización no se confunde con un defecto del producto.
- Las pruebas sobre base persistente de desarrollo se evitaron; los servicios y datos efímeros de la fase 4 fueron retirados.

No hay cambios de contrato, código ni esquema que requieran migración o tests nuevos para esta entrega documental.
