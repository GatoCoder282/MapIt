# CU-05-gestion-pisos-y-sectores — Tareas

> Se generan desde `plan.md`. Cada tarea debe ser **ejecutable y verificable**:
> al terminarla, algo observable cambia (un test pasa, un endpoint responde).
> Si una tarea no se puede verificar, está mal descompuesta.

## Orden de ejecución

- [x] **T1 — Contrato.** Editar `openapi.yaml` añadiendo los endpoints `POST` y `GET` en `/v1/floors/{floorId}/sectors`.
      _Verificación:_ `pnpm api:lint` en verde y `pnpm api:gen` sin errores.

- [x] **T2 — Migración.** Ejecutar `pnpm db:new "create_sector_table"`, asegurando columnas (`id`, `tenant_id`, `floor_id`, `name`, `slug`), índice compuesto único y función `enable_tenant_isolation()`.
      _Verificación:_ `pnpm db:migrate` aplica limpio; `pnpm db:info` muestra la versión.

- [x] **T3 — Dominio.** Crear la entidad `Sector`, `SectorId` y el puerto `SectorRepository` en el módulo `spaces-domain`.
      _Verificación:_ tests unitarios en verde para las reglas de negocio (límite de 100 caracteres en nombre) sin levantar contexto Spring.

- [ ] **T4 — Casos de uso.** Crear `CreateSectorUseCase` y `GetSectorsByFloorUseCase` en `spaces-application`.
      _Verificación:_ tests con los puertos simulados (Mocks/Stubs) pasan correctamente.

- [ ] **T5 — Adaptadores.** Implementar `JpaSectorRepository` y `SectorController` en `spaces-infrastructure`.
      _Verificación:_ test de integración con Testcontainers pasa con éxito + test obligatorio de aislamiento entre tenants (RLS) verificado.

- [ ] **T6 — ViewModel.** Crear el signal store (`sectorsState`, `createSector`, `loadSectors`) en `features/sectors/model/` de la app `console`. Implementar la lógica para autogenerar el slug a partir del nombre antes de llamar al comando.
      _Verificación:_ tests de Vitest sobre el store en verde, verificando la transformación de nombre a slug, sin renderizar componentes.

- [ ] **T7 — UI.** Crear componentes de formulario (solo pide nombre) y lista en `features/sectors/ui/` e integrarlos a la ruta.
      _Verificación:_ la pantalla carga, se puede crear un sector y opera de extremo a extremo contra el backend real en local.

- [ ] **T8 — Cierre.** `pnpm check` en verde global; marcar los criterios de aceptación de `spec.md`; actualizar `docs/db/mapit.dbml` con la nueva tabla `sectors`.

## Notas de ejecución

<Hallazgos, decisiones tomadas sobre la marcha, cosas que sorprendieron.
Esto es lo que hace defendible el trabajo hecho con agentes: aquí se ve
que el equipo entendió lo que se construyó.>
