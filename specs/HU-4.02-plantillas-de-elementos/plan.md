# HU-4.02 — Plan técnico

> Escrito como documentación de la implementación realizada (la HU llegó con código en
> el worktree y se completó/verificó en la misma sesión). Las secciones reflejan el
> estado final, no el recorrido.

## 1. Enfoque

Una plantilla es un agregado minimalista del contexto `spaces`: `name` + `type`.
La decisión clave (validada con evidencia) es qué cuenta como "configuración reusable":
`SpaceElement` = `{id, tenantId, sectorId, type, x, y, state, audit}` — solo `type` es
configuración; el resto es identidad, posición o runtime. Por eso la plantilla **no**
referencia instancias ni sectores y **no** duplica catálogos: reutiliza
`SpaceElementType`. El frontend consume el api-client generado del contrato; la paleta
visual (niveles 1 y 2) es una capa puramente de presentación sobre el mismo store.

## 2. Patrones de diseño aplicados

| Patrón                    | Dónde                                                                                    | Por qué aquí                                                                         | Alternativa descartada                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Arquitectura hexagonal    | `spaces-domain/application/infrastructure` (paquete `template`)                          | Mismo límite que `sector`/`spaceelement`: dominio sin frameworks, puertos en dominio | Meter la entidad como `@Entity` anémica compartida (rompería la regla ArchUnit) |
| Puerto y adaptador        | `ElementTemplateRepository` (puerto) ↔ `ElementTemplatePersistenceAdapter` + Spring Data | Permite aislamiento por tenant explícito + `set_config` RLS antes de cada operación  | Repositorio JPA directo en el servicio (acoplaría aplicación a persistencia)    |
| Entidad de dominio rica   | `record ElementTemplate` inmutable con reglas en el constructor                          | Imposible construir una plantilla inválida; `update`/`softDelete` devuelven copias   | Setters mutables (permite estados inconsistentes)                               |
| Specification-like naming | `findAllAliveByTenant`, `findAliveById`, `existsAliveByName`                             | La baja lógica es regla de dominio, no un filtro opcional del repositorio            | `findAll` + filtrado en memoria (fugaría filas de baja)                         |
| RFC 9457 Problem Details  | `@ExceptionHandler` en `ElementTemplateController`                                       | Contrato de errores uniforme con el resto de spaces (`SpacesProblemTypes`)           | Cuerpos de error ad-hoc                                                         |
| MVVM con signals          | `TemplatesStore` (model) + `element-template-*` / `template-palette` (ui)                | El ViewModel es testeable sin renderizar; la UI solo hace binding y eventos          | Lógica en componentes (haría el estado no testeable)                            |
| Design tokens CSS         | `element-type-icon`, `template-palette`                                                  | Nada de valores hard-codeados de color/radio: `--mapit-color-*`                      | Estilos sueltos por componente                                                  |

## 3. Cambios en el contrato API

- [x] Endpoints nuevos en `packages/api-contract/openapi.yaml` (sección `templates`).
- [x] `pnpm api:gen` ejecutado: `TemplatesService` + modelos generados; `pnpm api:check` en verde.

| Método | Ruta                              | Descripción                                  |
| ------ | --------------------------------- | -------------------------------------------- |
| GET    | `/element-templates`              | Lista vivas del tenant, ordenadas por nombre |
| POST   | `/element-templates`              | Crea `{name, type}` → 201 / 400 / 409        |
| GET    | `/element-templates/{templateId}` | Detalle → 200 / 404                          |
| PUT    | `/element-templates/{templateId}` | Reemplazo completo → 200 / 400 / 404 / 409   |
| DELETE | `/element-templates/{templateId}` | Baja lógica → 204 / 404                      |

Esquemas: `ElementTemplate` (readOnly `id`, `createdAt`, `updatedAt`),
`ElementTemplateCreateRequest` / `ElementTemplateUpdateRequest` (`name` 1-100, `type`
enum de `SpaceElementType`). Errores: `Problem` (RFC 9457). Auth: `bearerAuth` (401 sin
JWT). El tenant nunca viaja en body, path ni header.

> **Nota:** los controllers del módulo `spaces` usan anotaciones manuales y no
> implementan interfaces Java generadas (patrón real del repo, p. ej.
> `SpaceElementController`). `ElementTemplateController` sigue ese patrón; la
> sincronización contrato↔implementación la garantizan los tests de integración.

## 4. Backend

**Módulo:** `spaces`

| Capa                    | Qué se añade                                                                                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spaces-domain`         | `ElementTemplate` (record, RN-1), `ElementTemplateId`, puerto `ElementTemplateRepository`                                                                                                            |
| `spaces-application`    | `ElementTemplateService` (CRUD, tenant del `TenantContext`, unicidad case-insensitive), commands, response, excepciones `NotFound`/`NameConflict`                                                    |
| `spaces-infrastructure` | `ElementTemplateJpaEntity`, `ElementTemplateSpringDataRepository`, `ElementTemplatePersistenceAdapter` (RLS vía `set_config('app.tenant_id',…,true)`), `ElementTemplateController` (Problem Details) |

## 5. Base de datos

- [x] Migración `V16__crear_tabla_element_template.sql`.
- [x] `tenant_id NOT NULL REFERENCES tenant(id)` + índice `(tenant_id, id)` + `enable_tenant_isolation()`.
- [x] Índice único parcial `(tenant_id, lower(name)) WHERE deleted_at IS NULL` (RN-3) e índice parcial de consulta `(tenant_id, name)`.
- [x] Checks: longitud de nombre 1-100; `deleted_by` exige `deleted_at`. Trigger `touch_updated_at`.
- [x] `docs/db/mapit.dbml` actualizado (bloque `element_template`).

## 6. Frontend

**App:** `console` · **Feature:** `spaces`

| Parte                | Qué se añade                                                                                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model/` (ViewModel) | `TemplatesStore`: CRUD sobre el `TemplatesService` **generado**, draft de formulario, selección para reutilización, mapeo de 409 a mensaje                                                                                                      |
| `ui/`                | `element-template-list-page` (CRUD con icono por tipo), `element-template-form`, **`template-palette`** (nivel 1: grid por categorías) e **`element-type-icon`** (nivel 2: miniatura SVG compuesta por tipo) integradas en `space-element-form` |
| `data/`              | Nada nuevo: se consume el api-client generado (sin HTTP manual en componentes)                                                                                                                                                                  |

La ruta `/spaces/templates` se añadió a `app.routes.ts` y la entrada "Plantillas" al
`staff-shell`. La paleta reemplazó al `<select>` de "Aplicar plantilla": al elegir una
tarjeta se pre-rellena el tipo del borrador y el alta sigue el flujo normal (RN-5).

## 7. Feature toggle

- [ ] No va detrás de flag. La HU es funcionalidad núcleo del editor; si surgiera la
      necesidad: `pnpm new:flag spaces.templates release`.

## 8. Testing

| Nivel              | Qué se prueba                                                                                                                               | Estado                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Unit (dominio)     | `ElementTemplateTest`: validaciones de nombre, update en baja prohibido, softDelete                                                         | ✅                                                                    |
| Unit (controller)  | `ElementTemplateControllerTest`: mapping, 400/404/409, lista solo vivas, in-memory multi-tenant                                             | ✅                                                                    |
| Integración API    | `ElementTemplateApiIntegrationTest` (Testcontainers): 201/400/404/409/204, orden, baja lógica, **401 sin JWT**, migración V16 aplicada      | ✅ 11/11                                                              |
| Aislamiento tenant | `ElementTemplateTenantIsolationIntegrationTest`: RLS bidireccional, falla cerrado, índice único, checks, FK, liberación de nombre tras baja | ✅ 9/9                                                                |
| Frontend           | `templates-store.spec.ts` (Vitest): carga, validación sin HTTP, 409→mensaje, `saveFromElement` solo envía name+type, selección, borrado     | ✅ 8/8                                                                |
| E2E                | `apps/e2e/tests/console/templates.spec.ts`: login → CRUD completo de plantilla                                                              | ⚠️ escrito, no corrido en esta sesión (requiere `pnpm dev` levantado) |

## 9. Riesgos

| Riesgo                                                             | Mitigación                                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| El spec se escribió a posteriori (la implementación llegó primero) | Documentado aquí con fidelidad al estado final; ciclo SDD se retoma en la próxima HU                                                              |
| `saveAsTemplate` usa `window.prompt`/`alert` nativos               | Deuda de UX conocida: migrar a diálogo del ui-kit cuando exista patrón de modal                                                                   |
| Cualquier rol autenticado puede gestionar plantillas               | CU-24 definirá la autorización fina; los endpoints ya exigen JWT y quedan listos para `hasAnyRole(ADMIN)`                                         |
| Paleta sin canvas (el drag & drop depende de ADR-0006)             | La aplicación de plantilla es por click sobre el borrador del formulario; cuando llegue el canvas, la paleta se reutiliza como fuente de arrastre |

## 10. Niveles de la paleta visual (alcance acordado en sesión)

| Nivel | Qué                                                                                                  | Estado                                                       |
| ----- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1     | Panel de plantillas en grid agrupadas por categoría con icono + nombre; click aplica el tipo         | ✅ Hecho                                                     |
| 2     | Miniaturas SVG compuestas por tipo/categoría (mesa con sillas, filas de asientos, barra, escenario…) | ✅ Hecho                                                     |
| 3     | Plantillas con configuración rica (forma, capacidad, dimensiones) y thumbnails que la reflejen       | ⏸ Requiere ampliar modelo + migración + contrato: nuevo spec |
| 4     | Drag & drop al canvas                                                                                | ⏸ Bloqueado por ADR-0006 (motor de mapa)                     |
