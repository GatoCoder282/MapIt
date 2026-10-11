# HU-5.02 — Tareas

## MAP-193 — Flujo de estados de reserva

- [x] Completar y revisar `spec.md`, `plan.md` y este checklist antes de cambios de código.
- [x] Añadir al contrato OpenAPI el PATCH de transición, request, respuesta y errores; correr `pnpm api:lint` y `pnpm api:gen`.
- [x] Implementar matriz de dominio y transición inmutable; probar todos los caminos válidos, inválidos y terminales.
- [x] Implementar el caso de uso transaccional y puertos tenant-scoped.
- [x] Añadir lectura JDBC y actualización condicional de estado con `updated_by`/`updated_at` y RLS.
- [x] Añadir endpoint, Problem Details y autorización ADMIN/MANAGER/STAFF.
- [x] Añadir pruebas de API/integración para persistencia, permisos, tenant, establecimiento y conflictos concurrentes.
- [x] Integrar acciones y etiqueta de estado en la consola desde la respuesta de backend; añadir pruebas Vitest.
- [x] Ejecutar `pnpm check`, completar criterios de aceptación y notas de ejecución.
- [ ] Publicar PR `HU-5.02 — Flujo de Estados de Reserva`, base `chris799-hub/map-216-concurrencia-reservas`.

## Notas de ejecución

- Rama de implementación: `feat/gatocoder282/HU-5.02-flujo-estados-de-reserva`.
- Rama base: HEAD de PR #36 (`chris799-hub/map-216-concurrencia-reservas`).
- `pnpm api:lint`, generación de contrato, pruebas unitarias de los módulos de reservas, pruebas Vitest de la feature y build de consola completados correctamente.
- `pnpm check` ejecutado; formato, lint, tipos, pruebas/build de frontend y `api:check` pasan. La fase backend de integración no pudo completar los Testcontainers porque Docker no está disponible en este entorno (`Could not find a valid Docker environment`).
- La compilación de backend e integración compila; falta ejecutar la suite que requiere Docker en un entorno con Docker activo.
- Sin migración: V17 ya contiene los estados y columnas necesarios; no cambia `docs/db/mapit.dbml`.
