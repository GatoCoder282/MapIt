# CU-05-gestion-pisos-y-sectores — Plan técnico

> Se escribe **después** de que `spec.md` esté aprobada, y **antes** de tocar código.

## 1. Enfoque

Implementaremos `Sector` como una entidad de dominio central dentro del módulo `spaces`. Dado que un sector representa una zona delimitada del espacio físico, su ciclo de vida y la unicidad de su `slug` dependerán directamente de la entidad `Floor`. Garantizaremos el aislamiento de datos utilizando el identificador del inquilino (tenant) mediante Row Level Security (RLS) en la base de datos.

## 2. Patrones de diseño aplicados

> **Sección obligatoria.** Un plan sin esta tabla completa no pasa review.
> Las columnas "por qué aquí" y "alternativa descartada" existen para que cada
> patrón se justifique o se caiga: meter patrones para lucirlos hace daño.
> Catálogo de referencia: `docs/architecture/design-patterns.md`.

| Patrón         | Dónde                   | Por qué aquí                                                              | Alternativa descartada                                      |
| -------------- | ----------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Aggregate Root | `spaces-domain`         | El Sector tiene identidad propia y agrupa lógicamente los `SpaceElement`. | Tratarlo como un simple Value Object incrustado en `Floor`. |
| Repository     | `spaces-infrastructure` | Desacopla la lógica pura de negocio de la tecnología JPA/Hibernate.       | Active Record (acopla el modelo a la base de datos).        |

## 3. Cambios en el contrato API

- [ ] ¿Hay endpoints nuevos o modificados? → editar `packages/api-contract/openapi.yaml` **primero**
- [ ] `pnpm api:gen` tras cada cambio del contrato

| Método | Ruta                           | Descripción                                              |
| ------ | ------------------------------ | -------------------------------------------------------- |
| POST   | `/v1/floors/{floorId}/sectors` | Crea un nuevo sector validando que el `slug` sea único.  |
| GET    | `/v1/floors/{floorId}/sectors` | Lista todos los sectores asociados a un piso específico. |

## 4. Backend

**Módulo(s):** `spaces`

| Capa               | Qué se añade                                                                    |
| ------------------ | ------------------------------------------------------------------------------- |
| `*-domain`         | Entidad `Sector`, `SectorId`, puerto `SectorRepository`. Estrictamente sin JPA. |
| `*-application`    | Casos de uso `CreateSectorUseCase` y `GetSectorsByFloorUseCase`.                |
| `*-infrastructure` | Adaptador `JpaSectorRepository` y el controlador `SectorController` (REST).     |

## 5. Base de datos

- [ ] Migración necesaria → `pnpm db:new "create_sector_table"`
- [ ] `tenant_id NOT NULL` + índice `(tenant_id, id)` + `enable_tenant_isolation()`
- [ ] `docs/db/mapit.dbml` actualizado en el **mismo** commit

## 6. Frontend

**App:** `console` · **Feature:** `sectors`

| Parte                | Qué se añade                                                                       |
| -------------------- | ---------------------------------------------------------------------------------- |
| `model/` (ViewModel) | Signal store: estado `sectorsState`, comandos `createSector` y `loadSectors`.      |
| `ui/`                | Componentes de presentación para el listado y formulario de creación en el editor. |
| `data/`              | Llamadas a los endpoints utilizando el `api-client` autogenerado.                  |

## 7. Feature toggle

- [ ] ¿Va detrás de una flag? → `pnpm new:flag spaces.sectors.management`
- Clave: `spaces.sectors.management` · Tipo: `release`
- Si es **release**: fecha de retiro `2026-10-30` e issue de limpieza `#MAP-80`

## 8. Testing

| Nivel              | Qué se prueba                                                                     |
| ------------------ | --------------------------------------------------------------------------------- |
| Unit (dominio)     | Validar la generación limpia del `slug` y el límite de 100 caracteres del nombre. |
| Integración        | Validar la persistencia y RLS levantando PostgreSQL con Testcontainers.           |
| Aislamiento tenant | Obligatorio al crear la tabla `Sector`, probar política RLS.                      |
| Frontend           | Pruebas del ViewModel `sectorsState` con Vitest.                                  |
| E2E                | No aplica (el CRUD base no representa un flujo de usuario completo).              |

## 9. Riesgos

| Riesgo                                          | Mitigación                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Colisión de `slug` por peticiones concurrentes. | Restricción `UNIQUE` estricta a nivel de base de datos combinada con el `tenant_id` y `floor_id`. |
