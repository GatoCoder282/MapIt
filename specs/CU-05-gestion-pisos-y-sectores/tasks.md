# CU-05-gestion-pisos-y-sectores — Tareas

> Se generan desde `plan.md`. Cada tarea debe ser **ejecutable y verificable**:
> al terminarla, algo observable cambia (un test pasa, un endpoint responde).
> Si una tarea no se puede verificar, está mal descompuesta.

## Orden de ejecución

- [x] **MAP-63 — Diseño de modelo Floor.** Definir la entidad `Floor` como `record` inmutable en `spaces-domain`, con campos `id`, `tenant_id`, `establishment_id`, `name`, `level`, `slug`. Incluir negocio: validación de nombre (máx 100 chars), generación de slug única por establecimiento, niveles 1-999. Verificación: tests unitarios en verde sin levantar contexto Spring.

- [x] **MAP-64 — Diseño de modelo Sector.** Definir la entidad `Sector` como `record` inmutable en `spaces-domain`, con campos `id`, `tenant_id`, `floor_id`, `name`, `slug`, `maxCapacity`. Incluir negocio: patrón de slug `^[a-z0-9][a-z0-9-]{1,62}$`, límite 100 chars en nombre, capacidad máxima > 0. Verificación: tests unitarios en verde sin contexto Spring.

- [x] **MAP-65 — Crear migraciones Flyway.** Ejecutar `pnpm db:new "create_floor_and_sector_tables"`, asegurando columnas `tenant_id NOT NULL`, índices compuestos `(tenant_id, id)` y `(tenant_id, floor_id)`, y funciones `enable_tenant_isolation()` para ambas tablas. Verificación: `pnpm db:migrate` aplica limpio; `pnpm db:info` muestra la versión correcta.

- [x] **MAP-66 — Implementar servicios.** Crear los casos de uso en `spaces-application`: `CreateFloorUseCase`, `GetFloorsByEstablishmentUseCase`, `CreateSectorUseCase`, `GetSectorsByFloorUseCase`. Lógica de negocio: autogeneración de slug a partir del nombre, validación de unicidad por `floor_id`, resolución de `tenant_id` del claim JWT. Verificación: tests con puertos simulados (Mocks/Stubs) pasan correctamente.

- [x] **MAP-67 — Implementar endpoints de plantas.** Implementar `FloorController` en `spaces-infrastructure` con endpoints REST: `GET /v1/establishments/{establishmentId}/floors`, `GET /v1/floors/{id}`, `POST /v1/establishments/{establishmentId}/floors`, `PUT /v1/floors/{id}`. Manejadores de excepción: `FloorNotFoundException`, `FloorSlugAlreadyExistsException`, `FloorHasActiveSectorsException`. Verificación: test de integración con Testcontainers pasa.

- [x] **MAP-68 — Implementar endpoints de sectores.** Implementar `SectorController` en `spaces-infrastructure` con endpoints REST bajo `/v1/floors/{floorId}/sectors`: `POST` (crear sector con generación automática de slug y validación de unicidad) y `GET` (listar sectores por piso). Manejadores de excepción: `SectorNotFoundException`, `SectorSlugAlreadyExistsException`. Verificación: test de integración con Testcontainers pasa + test obligatorio de aislamiento entre tenants (RLS) verificado.

- [x] **MAP-69 — Crear interfaz de plantas.** Implementar la vista en Angular `console` para gestión de pisos: componente `PisoListComponent` que lista los pisos del establecimiento usando `@for` sobre señales, `<p featureFlag="'spaces.floors.management'>` para toggle, y formularios `<piso-form>` con validación de longitud 100 caracteres. Ruta `/console/spaces/floors` con lazy loading. Verificación: la pantalla carga y muestra la lista de pisos.

- [x] **MAP-70 — Crear interfaz de sectores.** Implementar la vista en Angular `console` para gestión de sectores dentro de un piso: componente `SectorListComponent` que lista los sectores de un piso específico usando `@for` y `loadSectorsByFloor(floorId)` desde el signal store. Formulario `<sector-form>` que solicita solo el nombre (slug autogenerado en backend). Verificación: al crear un sector, aparece en la lista con nombre y slug generado.

- [x] **MAP-71 — Integración frontend/backend.** Conectar el ViewModel `spacesState` signal store con el `api-client` generado: efectos que suscriben a `loadFloors()` y `loadSectorsByFloor(floorId)` usando `toSignal(http$)`. Inyectar `SpacesApi` via `inject()`. Verificar flujo end-to-end: crear piso → aparecer en lista; crear sector → aparecer en lista de ese piso. Verificación: tests de Vitest del store en verde, sin renderizar componentes.

- [ ] **MAP-72 — Pruebas de jerarquía espacial.** Implementar tests de integración que verifiquen la relación Piso-Sector: (a) un piso puede tener múltiples sectores, (b) un sector pertenece a exactamente un piso, (c) al filtrar sectores por piso, solo se muestran los asociados. Usar Testcontainers con PostgreSQL y verificar RLS en la jerarquía. Verificación: test de RLS pasando para ambos sentidos (tenant A ve solo sus datos, no los de tenant B).

- [ ] **MAP-73 — Pruebas de aislamiento Tenant.** Implementar el test específico de multi-tenant: dado un usuario del tenant A, verificar que no puede ver/listar pisos ni sectores pertenecientes al tenant B. Igual para tenant B. Usar `enable_tenant_isolation()` y verificar que queries sin `app.tenant_id` devuelven 0 filas. Verificación: test pasa en entorno de Testcontainers, cumpliendo la falla cerrada de RLS.

## Notas de ejecución

Las tareas MAP-63 a MAP-68 han sido completadas exitosamente, reflejando el fuerte avance en el backend:

- **Modelo Floor y Sector:** Definidos como records inmutables en `spaces-domain` con todas las reglas de negocio (validación de longitud, patrones de slug, restricciones de capacidad).
- **Migraciones Flyway:** Aplicadas con las tablas `floor` y `sector`, incluyendo `tenant_id NOT NULL`, índices compuestos y RLS PostgreSQL mediante `enable_tenant_isolation()`.
- **Servicios y Casos de uso:** Implementados en `spaces-application` con lógica de negocio completa: generación automática de slug, validación de unicidad, resolución de tenant del JWT.
- **Endpoints REST:** Ambos controladores (`FloorController`, `SectorController`) están operativos con manejo de excepciones RFC 9457 y validaciones apropiadas.

El terreno está listo para iniciar el frontend. Las tareas pendientes MAP-69 a MAP-73 se enfocan entirely en la aplicación Angular `console`, siguiendo estrictamente las reglas del proyecto:

- Sin `*ngIf`/`*ngFor`, usar `@if`/`@for`.
- Sin `NgClass`/`NgStyle`, usar `[class.x]`/`[style.x]`.
- Usar `inject()` para inyección de dependencias.
- Los signal stores como ViewModel con patrón MVVM.
- Feature flags mediante la directiva `<p featureFlag>`.
- Animaciones complejas con GSAP + ScrollTrigger.
- Verificación visual con Playwright `maxDiffPixelRatio: 0.02`.

El siguiente paso es comenzar la implementación frontend con la MAP-69 (interfaz de plantas), aprovechando el api-client ya generado y los endpoints REST verificados en backend.
