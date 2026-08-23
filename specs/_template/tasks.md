# {{CODIGO}} — Tareas

> Se generan desde `plan.md`. Cada tarea debe ser **ejecutable y verificable**:
> al terminarla, algo observable cambia (un test pasa, un endpoint responde).
> Si una tarea no se puede verificar, está mal descompuesta.

## Orden de ejecución

- [ ] **T1 — Contrato.** Editar `openapi.yaml` con los endpoints del §3 del plan.
      _Verificación:_ `pnpm api:lint` en verde y `pnpm api:gen` sin errores.

- [ ] **T2 — Migración.** `pnpm db:new "<descripción>"`, con `tenant_id` y RLS.
      _Verificación:_ `pnpm db:migrate` aplica limpio; `pnpm db:info` muestra la versión.

- [ ] **T3 — Dominio.** Entidades, value objects y puertos en `*-domain`.
      _Verificación:_ tests unitarios de las reglas de negocio en verde, sin Spring.

- [ ] **T4 — Casos de uso.** Servicios en `*-application`.
      _Verificación:_ tests con los puertos simulados.

- [ ] **T5 — Adaptadores.** JPA y REST en `*-infrastructure`.
      _Verificación:_ test de integración con Testcontainers + test de aislamiento entre tenants.

- [ ] **T6 — ViewModel.** Signal store en `features/<x>/model/`.
      _Verificación:_ tests de Vitest sobre el store, sin renderizar componentes.

- [ ] **T7 — UI.** Componentes en `features/<x>/ui/` y ruta lazy.
      _Verificación:_ la pantalla carga y opera contra el backend real.

- [ ] **T8 — Cierre.** `pnpm check` en verde; marcar los criterios de aceptación
      de `spec.md`; actualizar `docs/db/mapit.dbml` si cambió el esquema.

## Notas de ejecución

<Hallazgos, decisiones tomadas sobre la marcha, cosas que sorprendieron.
Esto es lo que hace defendible el trabajo hecho con agentes: aquí se ve
que el equipo entendió lo que se construyó.>
