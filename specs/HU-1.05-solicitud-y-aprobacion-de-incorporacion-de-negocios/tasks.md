# Tareas — HU-1.05 Solicitud y aprobación de incorporación de negocios

## MAP-261 — Modelo y migración

- [x] Crear la entidad de dominio `BusinessApplication` y sus estados con invariantes probadas.
- [x] Crear migración Flyway nueva para `business_application`, con restricciones, índices y RLS.
- [x] Actualizar `docs/db/mapit.dbml` en el mismo commit de la migración.
- [x] Probar migración y aislamiento desde el rol de runtime; ejecutar checks aplicables.

## MAP-262 — API pública y antiabuso

- [x] Editar OpenAPI antes del código y regenerar clientes.
- [x] Validar datos, duplicados y rate limit; emitir verificación del contacto sin enumeración.
- [x] Probar respuestas neutras, fallos de flag y no creación de tenant antes de aprobar.

## MAP-263 — Formulario público

- [x] Crear formulario responsive y accesible con textos de catálogo y estados de carga/error.
- [x] Probar ViewModel y visibilidad con flag OFF/ON.

## MAP-264 — Bandeja Super Admin

- [x] Crear contrato y API de listado, filtros y detalle protegidos por rol.
- [x] Crear pantalla Console y probar autorización y ausencia de fugas entre ámbitos.

## MAP-265 — Decisión y onboarding

- [x] Aprobar/rechazar de forma transaccional e idempotente con contacto verificado.
- [x] Reutilizar el alta de tenant y la invitación del primer ADMIN de CU-25.
- [x] Emitir evento de auditoría inmutable y probar decisiones concurrentes.

## MAP-266 — Notificaciones y E2E

- [x] Notificar el resultado sin contraseñas ni datos internos.
- [x] Cubrir duplicados, permisos, cross-tenant y flujo completo en integración/E2E.

## MAP-267 — Flag y rollback

- [x] Configurar `mapit.s6.business-applications` OFF por defecto y fallback OFF.
- [x] Probar ON/OFF, Unleash indisponible y conservación de solicitudes anteriores.

## Evidencia final

- [x] `pnpm check` y suites de integración pertinentes en verde.
- [ ] Checks requeridos de CI verdes y captura de la pestaña Checks adjunta al PR.

## Notas de ejecución

- 20/11/2026: se confirmó en Jira que MAP-257 es la historia y MAP-261–267 son sus siete subtareas. La especificación está en la rama de historia. MAP-261 comienza con modelo y persistencia; la API y UI quedan en subtareas posteriores.
- MAP-261: `BusinessApplication` inicia en `PENDING` bajo `platform`, normaliza el contacto y exige verificación antes de aprobar. La migración V41 añade la tabla, restricciones, índices, RLS y una referencia al tenant aprobado; el modelo DBML se actualizó en el mismo incremento.
- Verificación local: 4 pruebas de dominio y 2 pruebas de integración con PostgreSQL 17 y `mapit_app` pasaron. La integración comprobó que sin tenant o desde `demo` no se leen ni alteran solicitudes de `platform`, y que la unicidad de solicitudes pendientes se aplica en la base.
- La primera corrida de integración falló porque dos fixtures reutilizaban el mismo hash de verificación; se corrigieron los datos de prueba y la repetición pasó. Una primera corrida de `pnpm check` tuvo un timeout de 5 s en un test de check-in ajeno a MAP-261; ese test pasó aislado (2/2) y la segunda corrida completa de `pnpm check` terminó en verde: Console 371, Public Web 148, librerías 84, builds, contrato y backend/ArchUnit.
- `pnpm be:it` completo pasó en 13 min 33 s: 184 tests de integración, 0 fallos, 0 errores y 0 omitidos.
- Pendiente para la revisión final de la historia: CI del PR, captura de checks y E2E del flujo de solicitud, que todavía no existe en MAP-261.
- MAP-262: OpenAPI define solicitud y verificación públicas con respuestas neutras. El backend guarda solo el hash del token, aplica límites por IP real y por IP/correo en PostgreSQL, renueva solicitudes pendientes no verificadas y envía el correo después de confirmar la transacción. No crea tenant ni usuario. La flag de Jira `mapit.s6.business-applications` queda apagada por defecto en backend, frontend y Unleash.
- MAP-262: `pnpm api:lint`, `pnpm api:gen`, `pnpm api:check`, `pnpm be:test` y la integración `BusinessApplicationApiIntegrationTest` pasaron. La integración cubre HTTP 400, 503, 202, 429, duplicados, token renovado/de un solo uso y ausencia de un tenant nuevo. `public-web` pasó 148/148; `libs`, 85/85; las pruebas unitarias nuevas de aplicación pasaron 4/4.
- Dos intentos de `pnpm check` terminaron rojos únicamente por límites de 5 s en pruebas existentes de consola bajo carga: `tenants-table.spec.ts` en el primero y `staff-shell.spec.ts` en el segundo. Cada archivo pasó al repetirse aislado (16/16 y 17/17). Formato, lint, tipos, builds, contrato y backend/ArchUnit pasaron en ambos intentos. La suite completa deberá quedar verde en CI antes de revisión del PR final.
- MAP-263: el formulario de la web pública consume el cliente OpenAPI generado, valida los campos antes de enviar y muestra confirmación neutra, error y límite de solicitudes. La entrada desde Negocios aparece con la flag ON; con OFF se conserva la información de acceso por invitación. El enlace de verificación elimina el token de la URL antes de invocar la API.
- MAP-263: pruebas específicas de estado y visibilidad 6/6. `pnpm check` completo en verde: Console 371, Public Web 152, librerías 85, builds, contrato y backend/ArchUnit.
- MAP-264: el contrato y cliente generados agregan listado filtrable y detalle sin exponer hashes de tokens. El backend consulta exclusivamente bajo RLS de `platform` y exige SUPER_ADMIN antes de llegar al controlador. La consola tiene bandeja, filtros, paginación y vista de detalle en `/admin/business-applications`.
- MAP-264: prueba de integración con PostgreSQL 17 y JWT real pasó (401 sin sesión, 403 para ADMIN, 200 para SUPER_ADMIN, 404 para ID inexistente; respuesta sin hash). Prueba del store, build de consola, `pnpm be:test`, `pnpm api:lint` y tipos pasaron. `pnpm check` completo terminó en verde: formato, lint, tipos, pruebas y builds frontend, contrato API y backend/ArchUnit.
- MAP-265: se añadieron acciones de aprobar y rechazar para SUPER_ADMIN, con bloqueo de fila, decisión idempotente y auditoría en `platform`. La aprobación exige contacto verificado y reutiliza el alta de tenant y la invitación segura de CU-25; la consola permite decidir desde el detalle. La migración V42 amplía la bitácora inmutable y el DBML acompaña el cambio.
- MAP-265: integración PostgreSQL 17 pasó con JWT real, invitación, rechazo, repetición idempotente, aprobaciones concurrentes y reversión completa si falla el correo. Pruebas específicas de consola 2/2. El primer `pnpm check` falló por una regla de lint corregida y un timeout de 5 s en una prueba preexistente de métodos de pago; esa prueba pasó aislada 8/8. La repetición completa quedó en verde: Console 373, Public Web 152, librerías 85, builds, contrato y backend/ArchUnit.
- MAP-266: los correos de aprobación y rechazo se envían después del commit, una sola vez por decisión. El contenido incluye únicamente nombre del negocio y resultado; el enlace de activación del primer ADMIN sigue llegando por separado mediante CU-25. La integración verifica emisión única, ausencia de correo tras rollback, permisos por rol, RLS cross-tenant, duplicados, concurrencia y reversión transaccional.
- MAP-266: E2E real con `pnpm dev`, `pnpm db:seed:flags` y `pnpm --filter @mapit/e2e exec playwright test tests/business-onboarding/flow.spec.ts --project=business-onboarding --no-deps` pasó 1/1. Recorrió formulario público anónimo, Mailpit, verificación, aprobación en Console, notificación de resultado, invitación, idempotencia y activación. El reporte local `apps/e2e/playwright-report/index.html` contiene una captura de la aprobación. La prueba restauró la flag `OFF` al terminar. CI ahora carga las flags antes de E2E y adjunta el reporte desde la ruta real. `pnpm check` completo quedó en verde: Console 373, Public Web 152, librerías 85, builds, contrato y backend/ArchUnit. `pnpm --filter @mapit/e2e typecheck` también pasó.
- MAP-267: la flag ya estaba declarada OFF por defecto en catálogo backend/frontend y en el seed de Unleash. Se añadió falla cerrada al perder Unleash después de haber recibido ON, tanto en el adaptador Java como en el servicio Angular. Al recuperarse el transporte, ambos vuelven a evaluar la flag. El envío público se bloquea con OFF; revisión, decisiones, verificación y datos anteriores permanecen operativos. Como el solicitante aún no pertenece a un tenant, este toggle de entrada se opera por entorno; la segmentación por tenant se reserva para capacidades posteriores a la aprobación.
- MAP-267: pruebas unitarias del adaptador y frontend, integración PostgreSQL de rollback y E2E real pasaron. El E2E apaga Unleash tras verificar una solicitud, comprueba que desaparece el formulario público, aprueba la solicitud anterior y concluye la activación; adjunta capturas del estado OFF y de la aprobación y restaura el flag inicial al terminar.
- MAP-267: `pnpm check` completo quedó en verde: Console 373/373, Public Web 152/152, librerías 86/86, builds, contrato API y backend/ArchUnit. El test de integración de rollback y el E2E dirigido pasaron 1/1 cada uno. Queda pendiente únicamente la evidencia de los checks de CI del futuro PR.
- 23/11/2026, cierre tras rebase sobre `main`: `pnpm be:it` pasó en 14 min 45 s (229 pruebas, 0 fallos, 0 errores, 0 omitidas). `pnpm check` pasó completo: Console 402, Public Web 153, librerías 88, builds, contrato API y backend/ArchUnit. El cliente TypeScript generado se regeneró desde el contrato antes de validar frontend.
- 24/11/2026, rebase final tras el merge de PR #80 (`c9d8e39`): main conserva V40 para el perfil personal; se renumeró `business_application` a V41 sin cambiar su contenido (blob `c791ba7`) y la ampliación de auditoría a V42. V42 conserva los tipos y eventos efectivos de V34/V36, incluido `USER_RECOVERED`, y añade `BUSINESS_APPLICATION`, `BUSINESS_APPLICATION_APPROVED` y `BUSINESS_APPLICATION_REJECTED` con su correspondencia de recurso.
- Verificación de esta revisión: `node tools/scripts/gradle.mjs build` pasó; `pnpm be:it` terminó en verde en 15 min 34 s; `pnpm api:gen` regeneró el cliente desde el contrato; `pnpm check` pasó formato, lint, tipos, Console 488/488, Public Web 153/153, libs 108/108, builds, contrato y backend/ArchUnit. La primera generación desde la ruta del checkout falló por espacios en el path de Windows; se completó con un alias temporal sin espacios y no se versionaron salidas generadas.
