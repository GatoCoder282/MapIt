# CU-05-gestion-pisos-y-sectores — Plan técnico

> Se escribe **después** de que `spec.md` esté aprobada, y **antes** de tocar código.

## 1. Enfoque

El módulo `spaces` ya cuenta con las entidades `Floor` (Planta) y `Sector` completamente implementadas en el backend siguiendo la arquitectura hexagonal (Ports & Adapters). El Piso es la entidad raíz (Aggregate Root) que contiene una colección de Sectores. Este caso de uso expone endpoints bajo `/v1/floors/{floorId}/sectors` para crear y listar sectores dentro de un piso existente. El trabajo restante es la implementación del frontend en la aplicación `console`, dividido en las tareas MAP-69 a MAP-71, que consisten en: (a) crear la interfaz de listing y creación de Pisos (MAP-69), (b) crear la interfaz de listing y creación de Sectores dentro de un Piso (MAP-70), y (c) integrar el ViewModel con los endpoints del api-client generado y establecer la comunicación backend-frontend (MAP-71). Se usará señales de Angular para el estado, siguiendo el patrón MVVM donde el ViewModel (signal store) separa la lógica de la presentación.

## 2. Patrones de diseño aplicados

| Patrón           | Dónde                   | Por qué aquí                                                                                                                                                                                 | Alternativa descartada                                    |
| ---------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Aggregate Root   | `spaces-domain`         | El Piso tiene identidad propia y agrupa lógicamente su colección de Sectores. Tratar el Piso como raíz permite gestionar la invariante de que los Sectores pertenecen a un Piso válido.      | Tratarlo como un Value Object incrustado en otro dominio. |
| Repository       | `spaces-infrastructure` | Desacopla la lógica pura de negocio de la tecnología JPA/Hibernate. La interfaz `FloorRepository` y `SectorRepository` en el dominio exponen métodos sin conocer la implementación JDBC/JPA. | Active Record (acopla el modelo a la base de datos).      |
| MVVM (ViewModel) | Angular `console`       | Las señales (signalsState, createSector, loadSectors) encapsulan el estado y la lógica del caso de uso, permitiendo que la plantilla sea pura y declarativa sin lógica de negocio.           | Componer toda la lógica en el componente (anti-patrón).   |

## 3. Cambios en el contrato API

- [x] ¿Hay endpoints nuevos o modificados? → Ya definidos en `packages/api-contract/openapi.yaml` **antes** de iniciar el frontend
- [x] `pnpm api:gen` tras cada cambio del contrato (ya ejecutado, cliente TS y interfaces Java generadas)

| Método | Ruta                           | Descripción                                              |
| ------ | ------------------------------ | -------------------------------------------------------- |
| POST   | `/v1/floors/{floorId}/sectors` | Crea un nuevo sector validando que el `slug` sea único.  |
| GET    | `/v1/floors/{floorId}/sectors` | Lista todos los sectores asociados a un piso específico. |

El contrato OpenAPI ya incluye los schemas `Sector`, `SectorCreateRequest`, y los endpoints correspondientes. No se requieren modificaciones adicionales.

## 4. Backend

**Estado:** Ya implementado (MAP-63 a MAP-68). Los módulos siguientes ya existen y están funcionales:

| Capa                    | Qué ya existe                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spaces-domain`         | Entidad `Floor` (record), `Sector` (record), puertos `FloorRepository`, `SectorRepository`. Sin importes Spring ni JPA.                                        |
| `spaces-application`    | Casos de uso `CreateSectorUseCase`, `GetSectorsByFloorUseCase`, `CreateFloorUseCase`. Lógica de negocio con resolución de `tenant_id` del JWT.                 |
| `spaces-infrastructure` | Adaptadores `JpaFloorRepository`, `JpaSectorRepository`, controladores `FloorController`, `SectorController` (REST). RLS PostgreSQL via `setDatabaseTenant()`. |

## 5. Base de datos

**Estado:** Ya migrada (MAP-65). Migración Flyway aplicada con:

- Tabla `floor`: `id`, `tenant_id`, `establishment_id`, `name`, `level`, `slug`, `deleted_at`. Índices: `(tenant_id, id)`, `(establishment_id, slug)` [partial unique].
- Tabla `sector`: `id`, `tenant_id`, `floor_id`, `name`, `slug`, `maxCapacity`. Índices: `(tenant_id, id)`, `(tenant_id, floor_id)`. RLS habilitado mediante `enable_tenant_isolation()`.
- `docs/db/mapit.dbml` actualizado en el mismo commit con la definición de ambas tablas.

Convención cumplida: `tenant_id NOT NULL` + índice `(tenant_id, id)` + `enable_tenant_isolation()`.

## 6. Frontend

**App:** `console` · **Feature:** `spaces` (gestión de pisos y sectores)

Las tareas MAP-69 a MAP-71 siguen estrictamente las reglas Angular del proyecto:

| Parte                | Qué se añade                                                                                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model/` (ViewModel) | Signal store en `features/spaces/model/`: estado `spacesState` (lista de pisos, lista de sectores por piso), comandos `createFloor`, `createSector`, `loadFloors`, `loadSectorsByFloor`. Usar `inject()` para inyectar el `api-client`. |
| `ui/`                | Componentes de presentación: `<piso-form>` y `<piso-list>` para MAP-69; `<sector-form>` y `<sector-list>` para MAP-70, ambos usando `@if/@for`, `[class.x]`, `[style.x]` y signals de entrada `readonly`. Sin `NgClass` ni `NgStyle`.   |
| `data/`              | Llamadas a los endpoints utilizando el `api-client` autogenerado (`import { SpacesApi } from '@spatialize/api-client'`). Los servicios retornan observables que se suscriben dentro de efectos `toSignal()`.                            |

###### Uso de DESIGN.md

Antes de maquetar `<piso-form>` y `<sector-form>`, se debe consultar obligatoriamente DESIGN.md para los tokens de color y espaciado, o utilizar la skill de extracción visual si hay una imagen de referencia.

### Animaciones

Si los modales o formularios de creación van a tener transiciones de entrada/salida:

- Usar `@angular/animations` para estados simples (fade, slide).
- Usar GSAP en `ngAfterViewInit` si la UI requiere animaciones complejas (ScrollTrigger, etc.).
- **No usar Framer Motion** — este proyecto no permite dependencias de React.

### Flujo de datos — MAP-69 (Interfaz de Pisos)

1. La ruta `/console/spaces/floors` carga el componente `PisoListComponent`.
2. En `ngOnInit`, se ejecuta `loadFloors` desde el signal store, que llama al endpoint `GET /v1/floors` vía api-client.
3. Los pisos se muestran en una lista usando `@for` sobre la señal `spacesState.floors`, con `[class.x]` para estilizado condicional.
4. Al hacer clic en "Crear Piso", se abre el formulario `<piso-form>` con un input `readonly` para el nombre (gestionado por el signal store).
5. Al submitar, `createFloor` se ejecuta, genera el slug automáticamente y llama al endpoint `POST /v1/floors`.
6. La señal se actualiza y la lista se re-renderiza automáticamente sin `ngZone` ni `changeDetectorRef` manual (zoneless).

### Flujo de datos — MAP-70 (Interfaz de Sectores dentro de un Piso)

1. La ruta `/console/spaces/floors/{floorId}/sectors` carga el componente `SectorListComponent`.
2. En `ngOnInit`, se obtiene el `floorId` de la ruta y se ejecuta `loadSectorsByFloor(floorId)`, que llama al endpoint `GET /v1/floors/{floorId}/sectors` vía api-client.
3. Los sectores se muestran en una lista usando `@for` sobre la señal `spacesState.sectorsByFloor`, ordenados por nombre.
4. Al hacer clic en "Crear Sector", se abre el formulario `<sector-form>` que solicita únicamente el nombre (el slug se autogenera).
5. Al submitar, `createSector` genera el slug a partir del nombre (transformación: string → lowercase, tildes removed, espacios a guiones), valida unicidad y llama al endpoint `POST /v1/floors/{floorId}/sectors`.
6. La señal `spacesState.sectorsByFloor` se actualiza y el nuevo sector aparece en la lista.

### Flujo de integración — MAP-71

1. El `api-client` generado a partir de `openapi.yaml` ya tiene los tipos tipados para `SectorCreateRequest`, `Sector`, `Floor` y las operaciones `createSector`, `listSectorsByFloor`.
2. El signal store inyecta el cliente inyectado via `inject(SpacesApi)` y usa `toSignal(http$)` para convertir los observables de HttpClient a señales reactivas.
3. En `ngOnDestroy`, se limpian los suscriptores y señales para evitar fugas de memoria, siguiendo el patrón zoneless.
4. Los componentes usan la directiva `<p featureFlag="'spaces.sectors.management'">` para ocultar/ mostar la funcionalidad detrás de la feature flag, sin `*ngIf` puro (usando la directiva del proyecto).
5. Verificación visual con Playwright: `maxDiffPixelRatio: 0.02` comparando capturas de la interfaz antes y después de las interacciones.

## 7. Feature toggle

- [x] ¿Va detrás de una flag? → Ya definida (MAP-62).
- Clave: `spaces.sectors.management` · Tipo: `release`
- Si es **release**: fecha de retiro `2026-10-30` e issue de limpieza `#MAP-80`

## 8. Testing

| Nivel              | Qué se prueba                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit (dominio)     | Validar la generación limpia del `slug` (lowercase, sin tildes, guiones) y el límite de 100 caracteres del nombre, sin levantar contexto Spring. |
| Integración        | Validar la persistencia y RLS levantando PostgreSQL con Testcontainers (ya verificado en MAP-65+).                                               |
| Aislamiento tenant | Obligatorio: test que un usuario del tenant A no ve datos del B en la lista de sectores por piso.                                                |
| Frontend           | Tests del ViewModel `spacesState` con Vitest: verificar la transformación de nombre a slug, el efecto de `loadFloors` y `loadSectorsByFloor`.    |
| E2E                | Pruebas visuales con Playwright: verificar diffs con `maxDiffPixelRatio: 0.02` en los componentes de listado y forms de pisos y sectores.        |

## 9. Riesgos

| Riesgo                                                  | Mitigación                                                                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formato de slug inconsistente entre backend y frontend. | El slug se genera solo en el backend (endpoints `POST`). El frontend nunca genera slugs por sí mismo; solo envía el nombre y recibe el slug generado en la respuesta. |
| RLS falla si falta `app.tenant_id` en la sesión.        | El adaptador `SectorPersistenceAdapter` y `FloorPersistenceAdapter` fijan el tenant vía `setDatabaseTenant()` en cada transacción. El test de aislamiento lo valida.  |
| Cambio en el contrato OpenAPI rompido.                  | El `api-client` se regenera con `pnpm api:gen` y los tipos TypeScript son source of truth. Cualquier cambio en el yaml debe pasar `pnpm api:lint` primero.            |
