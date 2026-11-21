# Tareas — HU-1.05 Solicitud y aprobación de incorporación de negocios

## MAP-261 — Modelo y migración

- [x] Crear la entidad de dominio `BusinessApplication` y sus estados con invariantes probadas.
- [x] Crear migración Flyway nueva para `business_application`, con restricciones, índices y RLS.
- [x] Actualizar `docs/db/mapit.dbml` en el mismo commit de la migración.
- [x] Probar migración y aislamiento desde el rol de runtime; ejecutar checks aplicables.

## MAP-262 — API pública y antiabuso

- [ ] Editar OpenAPI antes del código y regenerar clientes.
- [ ] Validar datos, duplicados y rate limit; emitir verificación del contacto sin enumeración.
- [ ] Probar respuestas neutras, fallos de flag y no creación de tenant antes de aprobar.

## MAP-263 — Formulario público

- [ ] Crear formulario responsive y accesible con textos de catálogo y estados de carga/error.
- [ ] Probar ViewModel y visibilidad con flag OFF/ON.

## MAP-264 — Bandeja Super Admin

- [ ] Crear contrato y API de listado, filtros y detalle protegidos por rol.
- [ ] Crear pantalla Console y probar autorización y ausencia de fugas entre ámbitos.

## MAP-265 — Decisión y onboarding

- [ ] Aprobar/rechazar de forma transaccional e idempotente con contacto verificado.
- [ ] Reutilizar el alta de tenant y la invitación del primer ADMIN de CU-25.
- [ ] Emitir evento de auditoría inmutable y probar decisiones concurrentes.

## MAP-266 — Notificaciones y E2E

- [ ] Notificar el resultado sin contraseñas ni datos internos.
- [ ] Cubrir duplicados, permisos, cross-tenant y flujo completo en integración/E2E.

## MAP-267 — Flag y rollback

- [ ] Configurar `mapit.s6.business-applications` OFF por defecto y fallback OFF.
- [ ] Probar ON/OFF, Unleash indisponible y conservación de solicitudes anteriores.

## Evidencia final

- [ ] `pnpm check` y suites de integración pertinentes en verde.
- [ ] Checks requeridos de CI verdes y captura de la pestaña Checks adjunta al PR.

## Notas de ejecución

- 20/11/2026: se confirmó en Jira que MAP-257 es la historia y MAP-261–267 son sus siete subtareas. La especificación está en la rama de historia. MAP-261 comienza con modelo y persistencia; la API y UI quedan en subtareas posteriores.
- MAP-261: `BusinessApplication` inicia en `PENDING` bajo `platform`, normaliza el contacto y exige verificación antes de aprobar. La migración V34 añade la tabla, restricciones, índices, RLS y una referencia al tenant aprobado; el modelo DBML se actualizó en el mismo incremento.
- Verificación local: 4 pruebas de dominio y 2 pruebas de integración con PostgreSQL 17 y `mapit_app` pasaron. La integración comprobó que sin tenant o desde `demo` no se leen ni alteran solicitudes de `platform`, y que la unicidad de solicitudes pendientes se aplica en la base.
- La primera corrida de integración falló porque dos fixtures reutilizaban el mismo hash de verificación; se corrigieron los datos de prueba y la repetición pasó. Una primera corrida de `pnpm check` tuvo un timeout de 5 s en un test de check-in ajeno a MAP-261; ese test pasó aislado (2/2) y la segunda corrida completa de `pnpm check` terminó en verde: Console 371, Public Web 148, librerías 84, builds, contrato y backend/ArchUnit.
- `pnpm be:it` completo pasó en 13 min 33 s: 184 tests de integración, 0 fallos, 0 errores y 0 omitidos.
- Pendiente para la revisión final de la historia: CI del PR, captura de checks y E2E del flujo de solicitud, que todavía no existe en MAP-261.
