# CU-01 — Tareas

## Orden de ejecución

- [ ] **T1 — Contrato.** Actualizar `openapi.yaml`, validar y regenerar el cliente.
- [ ] **T2 — Dominio.** Crear entidad, value objects y puertos sin frameworks.
- [ ] **T3 — Persistencia.** Añadir solo la migración necesaria, mapeo JPA y unicidad.
- [ ] **T4 — Caso de uso.** Implementar `TenantService` y sus tests unitarios.
- [ ] **T5 — API.** Implementar POST, validaciones y tests con Testcontainers.
- [ ] **T6 — Correo.** Implementar puerto SMTP y comprobar Mailpit.
- [ ] **T7 — Frontend.** Crear store, formulario, ruta y adaptador API.
- [ ] **T8 — Cierre.** Ejecutar `pnpm check`, actualizar criterios y entregar a QA.

## Notas de ejecución

- La tabla `tenant` ya está creada por `V1__baseline.sql`; no se debe editar ni
  duplicar esa migración.
- La tabla es global. Las tablas tenant-scoped futuras seguirán llevando `tenant_id`,
  índice compuesto y RLS.
- MAP-42 ya tiene cobertura de RLS en `DemoItemIsolationIntegrationTest`; la validación
  funcional entre usuarios requiere CU-23/CU-24.
- QA es responsable de la aceptación funcional y de las pruebas manuales.
