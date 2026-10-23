# Tareas — HU-5.03 Bitácora de Auditoría

## MAP-222 — Crear entidad AuditLog inmutable

- [x] Crear el modelo `AuditLog` y tipos cerrados de recurso/evento.
- [x] Definir el puerto transversal de registro y el repositorio de consulta.
- [x] Crear migración Flyway generalizando el histórico de HU-3.01 sin perder datos.
- [x] Añadir índices, RLS y protección contra `UPDATE`/`DELETE` del rol runtime.
- [x] Implementar el adaptador JDBC con filtro explícito por tenant.
- [x] Actualizar `docs/db/mapit.dbml`.
- [x] Cubrir invariantes, persistencia e inmutabilidad con pruebas.

## MAP-223 — Registrar eventos de Reservation y SpaceElement

- [ ] Registrar `RESERVATION_CREATED` en la transacción de creación.
- [ ] Registrar `SPACE_ELEMENT_STATE_CHANGED` reutilizando el flujo de HU-3.01.
- [ ] Integrar `RESERVATION_STATUS_CHANGED` si HU-5.02 ya existe en la rama base.
- [ ] Garantizar rollback conjunto cuando falle la auditoría.
- [ ] Verificar que no se registren secretos ni datos personales innecesarios.

## MAP-224 — Implementar endpoint de histórico

- [ ] Editar primero el contrato OpenAPI y ejecutar `pnpm api:gen`.
- [ ] Definir respuesta paginada y filtros tipados.
- [ ] Implementar caso de uso y controlador `GET /api/v1/audit-logs`.
- [ ] Autorizar exclusivamente a `ADMIN` del tenant.
- [ ] Cubrir respuesta, filtros, paginación, `400`, `401` y `403`.

## MAP-225 — Implementar vista de auditoría para Administrador

- [ ] Crear feature Angular `audit` sin importar otras features.
- [ ] Añadir capa de datos sobre el cliente OpenAPI generado.
- [ ] Implementar store de filtros, paginación y estados de carga.
- [ ] Crear vista responsive y accesible con textos del catálogo.
- [ ] Añadir ruta y navegación visibles solo para `ADMIN`.
- [ ] Cubrir el ViewModel con Vitest.

## MAP-226 — Tests de integración de auditoría

- [ ] Probar eventos de reserva y `SpaceElement` de extremo a extremo.
- [ ] Probar atomicidad y ausencia de eventos huérfanos.
- [ ] Probar migración del histórico de HU-3.01.
- [ ] Probar aislamiento RLS y filtros explícitos entre dos tenants.
- [ ] Probar autorización y ausencia de secretos.
- [ ] Probar que el rol runtime no pueda actualizar ni eliminar registros.

## Cierre de HU-5.03

- [ ] Ejecutar `pnpm check` y dejarlo en verde.
- [ ] Ejecutar `pnpm be:it` y dejarlo en verde.
- [ ] Marcar todos los criterios de aceptación de `spec.md`.
- [ ] Completar las notas de ejecución de cada MAP.
- [ ] Adjuntar evidencias de backend, frontend y API al PR.

## Notas de ejecución

### Preparación

- Jira define HU-5.03 en MAP-194 y las subtareas MAP-222 a MAP-226.
- HU-5.01 ya está integrada en `origin/main` mediante el PR #36.
- HU-3.01 ya aporta `space_element_state_change`; la historia generalizará esa bitácora en
  lugar de mantener dos fuentes de trazabilidad para el mismo evento.
- La primera rama es
  `feat/christian799-hub/MAP-222-crear-entidad-auditlog-inmutable`, basada en `origin/main`.

### MAP-222

- La especificación fue aprobada por el responsable el 2026-10-22.
- Se creó `audit_log` en V19 porque `origin/main` ya usa V18 para la geometría de plantas y
  sectores.
- La migración conserva el histórico de `space_element_state_change`; la tabla anterior sigue
  disponible hasta que MAP-223 cambie su escritor.
- El modelo admite únicamente combinaciones cerradas de recurso, evento y detalles mínimos. El
  adaptador JDBC exige una transacción activa y fija el tenant para RLS en cada operación.
- Cinco pruebas de integración con PostgreSQL verifican persistencia, aislamiento, actor del mismo
  tenant, uso transaccional y rechazo de `UPDATE`/`DELETE` por el rol runtime.
- `pnpm check` quedó completamente en verde. Antes fue necesario ejecutar `pnpm api:gen` porque el
  cliente generado local estaba desactualizado respecto al contrato ya integrado en `main`; el
  código generado está ignorado y no forma parte del commit.

### MAP-223

Pendiente.

### MAP-224

Pendiente.

### MAP-225

Pendiente.

### MAP-226

Pendiente.
