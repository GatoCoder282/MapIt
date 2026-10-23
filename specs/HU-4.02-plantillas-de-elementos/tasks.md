# HU-4.02 — Tareas

> Generadas desde `plan.md`. Estado real al cierre de la sesión (2026-10-04).

## Orden de ejecución

- [x] **T1 — Contrato (MAP-204).** Sección `templates` en `openapi.yaml` + esquemas.
      _Verificación:_ `pnpm api:check` → "El contrato y el cliente generado están
      sincronizados". ✅

- [x] **T2 — Migración (MAP-203).** `V16__crear_tabla_element_template.sql` con
      `tenant_id`, índices, checks, trigger y RLS.
      _Verificación:_ el contexto de Spring arranca contra Testcontainers con
      `ddl-auto: validate` (test `arranque_con_la_migracion_aplicada`); `mapit.dbml`
      actualizado. ✅

- [x] **T3 — Dominio (MAP-202).** `ElementTemplate` (record), `ElementTemplateId`,
      puerto `ElementTemplateRepository`.
      _Verificación:_ `ElementTemplateTest` en verde, sin Spring (`pnpm be:test`). ✅

- [x] **T4 — Casos de uso (MAP-204).** `ElementTemplateService` con tenant de contexto,
      unicidad case-insensitive → 409, baja lógica.
      _Verificación:_ cubierto por tests de controller e integración. ✅

- [x] **T5 — Adaptadores (MAP-204, MAP-207).** JPA + RLS (`set_config`), REST con
      Problem Details.
      _Verificación:_ `ElementTemplateApiIntegrationTest` (11/11) y
      `ElementTemplateTenantIsolationIntegrationTest` (9/9) en verde con Testcontainers. ✅

- [x] **T6 — ViewModel (MAP-205/206).** `TemplatesStore` (CRUD + draft + selección).
      _Verificación:_ `templates-store.spec.ts` (8/8) sin renderizar componentes. ✅

- [x] **T7 — UI (MAP-205/206 + paleta niveles 1-2).** Página `/spaces/templates`,
      formulario, "Guardar como plantilla" desde el elemento, y **paleta visual**:
      `template-palette` (grid por categorías con estructuras base + plantillas) e
      `element-type-icon` (miniaturas SVG por tipo) integrados en `space-element-form`;
      icono por tipo en el listado.
      _Verificación:_ `tsc --noEmit` 0 errores, ESLint 0 warnings, Vitest 57/57. ✅

- [ ] **T8 — Cierre.** `pnpm check` completo (incluirá `be:it` entero y frontend build).
      _Pendiente:_ no se corrió la suite E2E (`templates.spec.ts` requiere `pnpm dev`
      levantado) ni `fe:build`. Commits pendientes por separado (esta HU vs. V15/pisos).

## Notas de ejecución

- **La HU llegó a medio hacer.** El worktree ya contenía entidad, migración, CRUD,
  contrato, cliente generado y UI CRUD. El trabajo de la sesión fue auditar todo
  contra los patrones del repo y cerrar la brecha real: **MAP-207 no tenía tests de
  integración con PostgreSQL real**.
- **Hallazgo de seguridad al escribir los tests:** la primera versión de
  `ElementTemplateApiIntegrationTest` falló con 401 en todo — a diferencia de
  `/sectors/**` (público temporal), `/element-templates/**` **no** está en
  `RUTAS_PUBLICAS` y exige JWT. El test final emite JWT reales con `AccessTokenIssuer`
  (patrón de `SpaceElementStateIntegrationTest`), lo que de paso verifica el criterio
  de autenticación. Ojo en futuras HU: el comentario "ruta pública hasta CU-23" de
  tests antiguos ya no aplica a rutas nuevas.
- **`mapit.unleash.enabled=false` tumba el contexto** si no se provee un bean
  `FeatureFlagPort` de respaldo (`RealtimeStompInterceptor` lo exige). Se resolvió
  quitando la propiedad (en este test Unleash no estorba); alternativa: el `@TestConfiguration`
  con flag stub que usa `SpaceElementStateIntegrationTest`.
- **Decisión de modelo confirmada con evidencia:** plantilla = `name` + `type`.
  `SpaceElement` solo tiene `type` como configuración no-posicional; todo lo demás
  (sector, x, y, estado, id) es instancia. Si el negocio pide plantillas "ricas"
  (p. ej. mesa de 6 con sillas), eso es el **nivel 3**, que exige ampliar también
  `SpaceElement` y debe pasar por su propio spec.
- **La paleta reemplazó al `<select>` de plantillas** en el formulario de elemento:
  mismo mecanismo de aplicación (`TemplatesStore.selectTemplate` + pre-llenado del
  `type`), mejor ergonomía y alineada con las referencias visuales (AllSeated /
  planificadores de oficina). Las estructuras base (7 tipos) siempre están
  disponibles aunque no haya plantillas guardadas.
- **Deuda conocida:** `window.prompt`/`alert` en "Guardar como plantilla" (pendiente
  patrón de modal del ui-kit); el E2E de plantillas existe pero no se corrió en esta
  sesión.
