# HU-2.03 — Asignación de Elementos Espaciales

> **Estado:** Aprobada (alcance backend, Foggi) · **Creada:** 2026-09-23 · **Responsable:** Integrante A/B (backend)
>
> **Jira:** historia MAP-109 · épica E02 — Modelado Espacial Genérico · Sprint 2
> **Subtareas:** MAP-110 (entidad), MAP-111 (migración), MAP-112 (entidad — duplicada de MAP-110),
> MAP-113 (migración — duplicada de MAP-111), MAP-114 (service), MAP-115 (endpoint).

## Enunciado

Como Admin Tenant, quiero registrar `SpaceElement` dentro de un sector con tipo,
coordenadas x/y y estado inicial, para representar los elementos espaciales que
después podrán operar en tiempo real.

> **Alcance de esta entrega: SOLO backend.** El formulario y su integración con la API
> son tareas de frontend de otro integrante. Sin drag & drop ni editor visual (eso es
> HU-4.01 / CU-06). El modelo backend queda listo para que HU-3.01/HU-3.02 consuman y
> auditen estados después.

Relación con el roadmap: es el backend que precede a CU-08 («persistir el mapa como
estructura de datos»); la edición visual encima es CU-06, fuera de esta entrega.

---

## 1. Por qué (contexto)

Hoy pueden crearse tenants, establecimientos, pisos y sectores (CU-01, CU-04, CU-05),
pero un sector queda vacío: no hay forma de decir «en este sector hay una mesa en
(120, 80)». Sin elementos espaciales no hay mapa, y sin mapa no hay operación CU-09.

## 2. Actores

| Rol                                  | Qué hace en este caso de uso                                      |
| ------------------------------------ | ----------------------------------------------------------------- |
| Administrador (de empresa) / Manager | Da de alta y actualiza elementos dentro de un sector de su tenant |

## 3. Precondiciones

- Existen `tenant`, `establishment`, `floor` y `sector` (CU-01…CU-05) ya aplicados en BD.
- El tenant efectivo se resuelve del contexto del backend (hoy `DemoTenantContext` con el
  tenant `demo`; en CU-23/CU-24 sale del claim `tenant` del JWT). El tenant **nunca viaja
  en el cuerpo de la petición**.

## 4. Flujo principal

1. El cliente envía `POST /api/v1/sectors/{sectorId}/elements` con `type`, `x`, `y` y
   `initialState`. `initialState` es opcional y su default es `AVAILABLE`.
2. El backend resuelve el tenant desde el contexto, verifica que el sector existe vivo
   **dentro de ese tenant** y valida los datos.
3. Persiste el elemento con el tenant derivado del sector/contexto y devuelve 201.
4. `PUT /api/v1/sectors/{sectorId}/elements/{elementId}` reemplaza los campos editables
   (`type`, `x`, `y`) de un elemento vivo del mismo sector y tenant.
5. `GET /api/v1/sectors/{sectorId}/elements` lista los elementos vivos del sector
   (necesario para «consulta» de MAP-114 y para que el formulario del compañero cargue).

## 5. Flujos alternativos y errores

| Situación                                             | Comportamiento esperado                                               |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| Sector inexistente o de otro tenant                   | 404 Sector no encontrado (mismo error; no se revela existencia ajena) |
| Tipo no permitido por la vertical del establecimiento | 400 con mensaje claro                                                 |
| Tipo o estado fuera de catálogo                       | 400 datos inválidos                                                   |
| `x`/`y` nulas o negativas                             | 400 datos inválidos                                                   |
| Payload incompleto (faltan campos)                    | 400 con Problem Details (RFC 9457)                                    |
| Elemento inexistente o de otro sector/tenant en PUT   | 404                                                                   |

## 6. Reglas de negocio

- **RN-1:** El tenant efectivo lo decide siempre el backend (contexto), nunca el cliente.
  Un `sectorId`/`tenantId` del cuerpo no es confiable: no viaja `tenantId`, y el
  `sectorId` del path se valida contra el tenant actual.
- **RN-2:** Un elemento pertenece a exactamente un sector; la truncamiento de la cadena
  es `tenant → establishment → floor → sector → space_element` y ningún eslabón admite
  orfandad (FK `ON DELETE RESTRICT`; las bajas son lógicas).
- **RN-3:** El `type` es de un catálogo cerrado: `TABLE`, `BAR`, `SECTOR_ZONE`, `STAGE`,
  `SEAT`, `ROOM`, `DECOR` (el mismo que `libs/map-engine`; es nuestro modelo, ADR-0006).
- **RN-4:** El tipo debe ser coherente con la vertical: `ROOM` solo en hotel y `SEAT`
  solo en salón de eventos; el resto aplica a cualquier vertical. **Divergencia
  documentada:** Jira dice "según la vertical del Tenant" pero el criterio se aplica
  contra la vertical del **establecimiento** del sector (`tenant → sector → floor →
establishment.type`), más granular y aprovechando que `tenant.vertical` tiene default
  `RESTAURANT` (V4) y por tanto discrimina menos. Si Jira exige el tenant tras revisión,
  el cambio es una línea en `SpaceElementTypePolicy`. La exclusividad es **provisional**:
  CU-07 la refinará con plantillas configurables.
- **RN-5:** `initialState` puede ser `AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`,
  `OUT_OF_SERVICE`. Nace como estado actual del elemento; el estado es un dato mutable
  y su cambio auditado viene en HU-3.01, por eso el modelo no lo congela.
- **RN-6:** `x`/`y` son relativas al sector y no pueden ser negativas. **Incertidumbre
  documentada:** el sector no modela dimensiones (width/height) todavía, así que todavía
  NO se valida un límite superior contra el sector; cuando exista, se añade esa regla
  sin cambiar el contrato.
- **RN-7:** La baja es lógica (`deleted_at`) para no romper referencias futuras de
  reservas y bitácora (CU-12, CU-14). Fuera de alcance de esta entrega.

## 7. Criterios de aceptación

- [x] **CA-1:** Dado un sector vivo del tenant, cuando envío `POST` con datos válidos,
      entonces responde 201 y el elemento queda persistido con el tenant del contexto.
- [x] **CA-2:** Dado un sector que no existe, cuando envío `POST`, entonces responde 404.
- [x] **CA-3:** Dado un sector de OTRO tenant, cuando envío `POST`, entonces responde 404
      y no se persiste nada (aislamiento cross-tenant).
- [x] **CA-4:** Dado un `type` no permitido por la vertical (p. ej. `ROOM` en un
      restaurante), cuando envío `POST`, entonces responde 400 y señala el tipo.
- [x] **CA-5:** Dado `x` o `y` negativas o un `initialState` fuera de catálogo, cuando
      envío `POST`, entonces responde 400.
- [x] **CA-6:** Dado un payload incompleto o inválido, entonces responde 400 Problem
      Details sin reflejar datos internos.
- [x] **CA-7:** Dado un elemento vivo, cuando lo `PUT` con nuevos `type`/`x`/`y`, entonces
      responde 200 y `updatedAt` avanza; su estado no se toca.
- [x] **CA-8:** Dado un elemento inexistente o de otro tenant, cuando lo `PUT`, entonces
      responde 404.
- [x] **CA-9:** Dada la tabla `space_element`, cuando se consulta como tenant A bajo un rol
      sin bypass RLS, entonces no ve elementos del tenant B; sin `app.tenant_id` en sesión
      ve 0 filas (test de aislamiento, obligatorio por `specs/AGENTS.md` §4).
- [x] **CA-10:** Dada la migración nueva, cuando arranca CI, entonces Flyway la aplica
      limpio y `ddl-auto: validate` pasa (compatibilidad CI reproducible).

## 8. Fuera de alcance

- Frontend, formularios e integración (otro integrante, mismas HU).
- Drag & drop, editor visual, WebSocket, tiempo real (HU-4.01 / CU-06, CU-09).
- Auditoría y transiciones de estado (HU-3.01), posiciones con dimensiones/rotación
  avanzadas, plantillas por vertical configurables (CU-07).
- Baja de elementos (baja lógica prevista en el modelo, sin endpoint todavía).

## 9. Impacto multi-tenant

- Sí: `space_element` lleva `tenant_id TEXT NOT NULL REFERENCES tenant(id)`, índice
  `(tenant_id, id)`, trigger `touch_updated_at` y `enable_tenant_isolation('space_element')`.
- Test de aislamiento CA-9, replicando `FloorSectorTenantIsolationIntegrationTest`
  (rol `mapit_rls_test` para no caer en el falso verde del superusuario).

### Desvíos y deuda técnica registrada (fuera de HU-2.03)

| Item                                                                       | Dónde                                               | Acción de equipo pendiente                                                                                                       |
| -------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Rutas `/sectors/**` públicas con fallback `demo`                           | `SecurityConfig.java`                               | Cerrar cuando CU-23/CU-24 termine (autenticación por rol). Mismo riesgo que pisos/sectores.                                      |
| `Instant.now()` en Create/Update/DeleteSectorUseCase                       | `spaces-application/sector/`                        | Inyectar `Clock` igual que ya lo hace `EstablishmentService` (evitar tiempo no-determinista en tests).                           |
| `SectorResponse` mappeado 4 veces                                          | `spaces-application/sector/`                        | consolidar en `SectorResponse.fromDomain()`, como ya hace `SpaceElementResponse`.                                                |
| `FloorService.generateSlugFromName` duplica el VO `Slug.fromName`          | `spaces-application/floor/`                         | Unificar; colisión de la `ñ` que el regex manual explica.                                                                        |
| `FloorService.requireLevelFree` re-lee el propio piso                      | `spaces-application/floor/`                         | Añadir `existsAliveByLevel(..., exceptId)` al puerto; no re-leer.                                                                |
| `FloorHasActiveSectorsException`                                           | `spaces-application/floor/` + handler en controller | ⚠️ código muerto: el throw está comentado en `FloorService`; eliminar cuando se decida la regla o implementarlo.                 |
| `FloorResponse`/`EstablishmentResponse` mappean dominio en infraestructura | `spaces-infrastructure/`                            | Subir esas factories a `*-application`.                                                                                          |
| `Checks` JSON del `SpaceElement.x/y` no cubren `NaN`/`Infinity`            | `V12__crear_tabla_space_element.sql`                | La validación real vive en dominio (`SpaceElement` constructor); opcional: añadir check `x <> 'NaC'::float8` si sube el volumen. |
| Doble escritura de `updated_at`                                            | domain `touch` + trigger DB                         | Misma postura de sector/floor; dominar una sola si complica merges.                                                              |
| `GET /sectors/{sectorId}/elements` sin paginación                          | API                                                 | Correcto hoy; añadir `page/size` cuando la lista crezca.                                                                         |

### Lo que NO se corrigió aquí

Sector seguirá mezclando `Instant.now()` y `SectorResponse` repetido 4 veces: no es mi HU, es de `CU-05` (otro integrante). Está documentada en `audit_application.md`.

### Lo que quedó plano vs. reorganizado

`spaces/application` quedó en subpaquetes por agregado (`establishment/`, `floor/`, `sector/`, `spaceelement/`, `demo/`), y lo mismo en `spaces-domain` (`establishment/`, `floor/`, `sector/`, `spaceelement/`, `demo/`) e `spaces-infrastructure` (`demo/`, `establishment/`, `floor/`, `sector/`, `spaceelement/`, `realtime/` ya existía). El commit `126fff8` (application) y `cabf132` (domain+infrastructure) son el reflejo de la auditoría.

### Criterios de la época del scope

Cada cambio hecho aquí llevó a este criterio aplicado al spec hermano (mapas editoriales, no estética vaga): no repiqueteos de motion — sólo el keyframe de entrada `formSlideIn` que ya existe; semáforos de loading/éxito/error en la capa de datos, no en la presentación; y tokens `--mapit-*` reutilizados.

## 10. Requerimientos relacionados

RF04, RF05 de `docs/roadmap/project_definition.md`; CU-08; prepara HU-3.01 y HU-3.02.
