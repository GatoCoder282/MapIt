# Tareas — HU-1.05 Solicitud y aprobación de incorporación de negocios

## MAP-261 — Modelo y migración

- [ ] Crear la entidad de dominio `BusinessApplication` y sus estados con invariantes probadas.
- [ ] Crear migración Flyway nueva para `business_application`, con restricciones, índices y RLS.
- [ ] Actualizar `docs/db/mapit.dbml` en el mismo commit de la migración.
- [ ] Probar migración y aislamiento desde el rol de runtime; ejecutar checks aplicables.

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
