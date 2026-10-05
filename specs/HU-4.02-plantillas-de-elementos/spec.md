# HU-4.02 — Plantillas de Elementos

> **Estado:** Completada · **Creada:** 2026-10-04 · **Responsable:** Integrante C (Frontend Editor) + Lead Implementation Agent
>
> **Jira:** MAP-191 (épica MAP-88 — E04 Editor Visual de Espacios) · Subtareas MAP-202…MAP-207

## Enunciado

Como **administrador**, quiero **guardar y reutilizar configuraciones de SpaceElements
como plantillas** para acelerar la construcción de sectores.

---

## 1. Por qué (contexto)

Configurar un sector implica dar de alta decenas de elementos del mismo tipo ("mesa
redonda", "butaca", "barra"). Sin plantillas, el staff repite la misma elección de tipo
una y otra vez. Con plantillas se guarda la configuración una vez y se reutiliza en cada
alta, reduciendo tiempo y errores de configuración.

## 2. Actores

| Rol   | Qué hace en este caso de uso                                                    |
| ----- | ------------------------------------------------------------------------------- |
| Admin | Crea, lista, edita y da de baja plantillas; las aplica al dar de alta elementos |
| Staff | (mismo acceso técnico hoy; la restricción fina por rol es de CU-24)             |

## 3. Precondiciones

- Existe un tenant activo con sesión JWT válida (claim `tenant`).
- HU-2.03 implementada: existe `SpaceElement` y su alta por sector.

## 4. Flujo principal

**Guardar plantilla (MAP-205):**

1. El usuario abre un elemento existente en el formulario de elementos de un sector.
2. Pulsa "Guardar como plantilla", indica un nombre descriptivo.
3. El sistema crea la plantilla con `name` + `type` del elemento (sin coordenadas,
   sector, estado ni id de instancia).
4. La plantilla queda disponible para el tenant.

**Reutilizar plantilla (MAP-206):**

1. En el alta de un elemento, el usuario ve la **paleta de estructuras y plantillas**:
   tarjetas agrupadas por categoría (Mesas y barras, Asientos y salas, Zonas y
   escenarios, Ambientación) con miniatura por tipo.
2. La paleta muestra siempre las estructuras base (una por `SpaceElementType`) y,
   debajo de cada una, las plantillas guardadas de ese tipo.
3. Al elegir una plantilla, el tipo del borrador se pre-rellena; el alta continúa por
   el flujo normal (coordenadas, estado inicial) y crea una **instancia nueva**:
   jamás se reutilizan ids de la plantilla ni de otra instancia.

**Gestión (MAP-204):** CRUD completo en `/spaces/templates` (crear, listar, editar,
baja lógica).

## 5. Flujos alternativos y errores

| Situación                                                             | Comportamiento esperado                                    |
| --------------------------------------------------------------------- | ---------------------------------------------------------- |
| Nombre duplicado en el tenant (case-insens.)                          | 409 Problem Details; el formulario muestra el conflicto    |
| Nombre vacío o >100 caracteres                                        | 400 (validación de dominio + CHECK en BD)                  |
| `type` fuera de `SpaceElementType`                                    | 400 con lista de valores válidos                           |
| Plantilla inexistente / dada de baja / ajena                          | 404 indistinguible (no se filtra existencia entre tenants) |
| Sin JWT                                                               | 401                                                        |
| Alta de elemento con plantilla de otro tipo permitido por la vertical | 400 por la regla de vertical existente (HU-2.03)           |

## 6. Reglas de negocio

- **RN-1:** Una plantilla solo almacena **configuración reusable**: `name` y `type`.
  Nunca `id` de instancia, `sectorId`, coordenadas ni estado operativo.
- **RN-2:** El tenant siempre sale del claim `tenant` del JWT; nunca del body ni de la URL.
- **RN-3:** La unicidad de nombre es por tenant, case-insensitive, solo sobre filas vivas;
  doble red: capa de aplicación (409 claro) + índice único parcial en BD.
- **RN-4:** La baja es lógica (`deleted_at`): el histórico se conserva y el nombre queda
  libre tras la baja.
- **RN-5:** Reutilizar una plantilla crea una instancia nueva de `SpaceElement`; la
  plantilla no arrastra identidad ni posición.
- **RN-6:** No se crea catálogo paralelo de tipos: se reutiliza `SpaceElementType`.

## 7. Criterios de aceptación

- [x] **CA-1:** Dado un JWT válido, cuando hago POST `/api/v1/element-templates` con
      `{name, type}` válidos, entonces responde 201 con la plantilla y persiste con el
      `tenant_id` de la sesión. _(ElementTemplateApiIntegrationTest)_
- [x] **CA-2:** Dado el mismo tenant, cuando consulto/listo/actualizo/elimino la plantilla,
      entonces las operaciones responden 200/200/204 conforme al contrato.
      _(ElementTemplateApiIntegrationTest)_
- [x] **CA-3:** Dado un nombre ya usado por una plantilla viva del tenant, cuando intento
      crear otra con ese nombre (distinta capitalización), entonces 409.
      _(API + controller tests + índice único parcial verificado en BD)_
- [x] **CA-4:** Dado el tenant A con plantillas, cuando el tenant B lista u opera por id,
      entonces ve 0 resultados / 404; la RLS lo garantiza incluso con SQL directo.
      _(ElementTemplateTenantIsolationIntegrationTest)_
- [x] **CA-5:** Dado un elemento existente, cuando lo guardo como plantilla, entonces solo
      viajan `name` y `type` por la capa de datos (api-client generado).
      _(templates-store.spec.ts)_
- [x] **CA-6:** Dada la paleta en el alta de elemento, cuando elijo una plantilla,
      entonces el tipo se pre-rellena y el alta crea una instancia nueva.
      _(Integración en space-element-form + spec del store)_
- [x] **CA-7:** Dado el repositorio, cuando corro `pnpm be:test`, `be:it` (clases nuevas),
      `api:check`, typecheck, lint y Vitest, entonces todo queda en verde.

## 8. Fuera de alcance

- Drag & drop de plantillas sobre un canvas (bloqueado por ADR-0006: motor de mapa sin decidir).
- Plantillas con configuración rica (forma, capacidad, dimensiones, disposición de asientos)
  — requeriría ampliar `ElementTemplate` **y** `SpaceElement`; decisión de diseño nueva.
- Restricción por rol (solo ADMIN); hoy cualquier rol autenticado — la autorización fina
  es CU-24.
- SSR / public-web: las plantillas son una herramienta de staff.

## 9. Impacto multi-tenant

- Tabla nueva `element_template`: `tenant_id TEXT NOT NULL REFERENCES tenant(id)`,
  índice `(tenant_id, id)`, índice único parcial `(tenant_id, lower(name)) WHERE
deleted_at IS NULL`, y `SELECT enable_tenant_isolation('element_template')` (RLS). ✅
- Tests de aislamiento: `ElementTemplateTenantIsolationIntegrationTest` (9 tests:
  bidireccional, falla cerrado sin tenant, constraints) y caso cross-tenant a nivel HTTP
  (404 al leer/editar/borrar lo ajeno) en `ElementTemplateApiIntegrationTest`. ✅

## 10. Requerimientos relacionados

RF05 (el mapa se persiste como estructura de datos), CU-07 de `docs/roadmap/use_cases.md`;
depende de HU-2.03 (elementos espaciales) y CU-23/CU-24 (auth JWT).
