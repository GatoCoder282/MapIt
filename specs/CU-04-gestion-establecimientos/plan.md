# CU-04 — Plan técnico

## 1. Enfoque

Se implementa en el bounded context `spaces` (Spatial Model), siguiendo la hexagonal
modular ya establecida y usando `DemoItem` como referencia estructural viva dentro del
mismo módulo. El orden es el del proyecto: contrato OpenAPI primero, después migración,
dominio, caso de uso, adaptadores y por último la feature Angular.

La decisión de fondo es que **la baja es lógica, no física**. `floor` y `sector` (CU-05)
apuntarán a `establishment`, y borrar físicamente dejaría huérfanos o exigiría cascadas
que hoy nadie ha decidido. Marcar la fila conserva el histórico, evita ese problema y
permite además liberar el slug para reutilizarlo.

La autoría (`created_by`, `updated_by`, `deleted_by`) se modela desde ahora, pero se
persiste nula: la tabla `app_user` no existe hasta CU-23/CU-24. La alternativa —dejar
las columnas para después— obligaría a una migración de datos sobre filas reales, que es
más caro que aceptar nulos temporales.

## 2. Patrones de diseño aplicados

> Este caso de uso es, en el fondo, un CRUD con aislamiento por tenant. Se aplican solo
> los patrones que la arquitectura ya impone o que resuelven un problema real aquí. No
> se fuerza `Strategy` ni `State`: el establecimiento no tiene comportamiento variable ni
> ciclo de vida con transiciones (eso llega en CU-19…22 y CU-13). Meterlos sería
> "patrón por el patrón", que el propio catálogo marca como antipatrón.

| Patrón               | Dónde                                        | Por qué aquí                                                                                                                                                                                                                                                                          | Alternativa descartada                                                                              |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Ports & Adapters** | todo el módulo `spaces`                      | Es la arquitectura del proyecto: `spaces-domain` no declara Spring ni JPA, así que ni siquiera compilaría de otro modo.                                                                                                                                                               | Un `@Service` que use `JpaRepository` directamente, como en el tutorial clásico de Spring.          |
| **Repository**       | `EstablishmentRepository` en `spaces-domain` | El caso de uso necesita expresar _qué_ persiste sin saber que hay PostgreSQL ni RLS debajo.                                                                                                                                                                                           | Consultas JPA dentro de `EstablishmentService`.                                                     |
| **Value Object**     | `EstablishmentType`, `Slug`, `AuditTrail`    | El tipo tiene exactamente 4 valores y el slug un formato estricto; con `String` la validación se dispersa por controlador, servicio y tests. `AuditTrail` agrupa los seis campos de auditoría, que siempre se leen y escriben juntos, y expone las transiciones válidas como métodos. | `String` con validaciones repetidas en cada capa, y seis campos de auditoría sueltos en la entidad. |
| **Adapter**          | `EstablishmentPersistenceAdapter`            | Traduce entre el `record` del dominio y la `@Entity` de JPA, y es donde se activa la RLS por transacción.                                                                                                                                                                             | Anotar el propio dominio con `@Entity`, que acoplaría las reglas de negocio al esquema de la base.  |

**Soft delete** no se lista como patrón de diseño: es una decisión de modelado de datos,
no un patrón del catálogo. Se documenta en §5 y en `spec.md` §RN-5.

## 3. Cambios en el contrato API

- [ ] Editar `packages/api-contract/openapi.yaml` **antes** de escribir código Java
- [ ] `pnpm api:gen` tras cada cambio del contrato

| Método   | Ruta                          | Descripción                                                  |
| -------- | ----------------------------- | ------------------------------------------------------------ |
| `POST`   | `/api/v1/establishments`      | Registra un establecimiento. `201` con el recurso creado.    |
| `GET`    | `/api/v1/establishments`      | Lista los establecimientos vivos del tenant del contexto.    |
| `GET`    | `/api/v1/establishments/{id}` | Consulta uno. `404` si no existe o es de otro tenant.        |
| `PUT`    | `/api/v1/establishments/{id}` | Actualiza nombre, slug y zona horaria. El tipo **no** viaja. |
| `DELETE` | `/api/v1/establishments/{id}` | Baja lógica. `204` sin cuerpo.                               |

Esquemas: `Establishment` (respuesta), `EstablishmentCreateRequest` (con `type`),
`EstablishmentUpdateRequest` (**sin** `type`, así el contrato hace cumplir RN-3 antes de
que llegue una sola línea de Java).

## 4. Backend

**Módulo:** `spaces`

| Capa                    | Qué se añade                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spaces-domain`         | `Establishment` (record inmutable con reglas en el constructor compacto), `EstablishmentType` (enum), `Slug` (value object), `EstablishmentRepository` (puerto). |
| `spaces-application`    | `EstablishmentService` con los 5 casos de uso; `EstablishmentNotFoundException`, `SlugAlreadyExistsException`.                                                   |
| `spaces-infrastructure` | `EstablishmentController`, `EstablishmentJpaEntity`, `EstablishmentPersistenceAdapter`, `EstablishmentSpringDataRepository`.                                     |

El `TenantContext` se reutiliza tal cual: `DemoTenantContext` ya lo implementa y vive en
este mismo módulo. No se crea un segundo adaptador.

`Clock` se inyecta en el servicio, como en `DemoItemService`, para que los tests puedan
congelar el tiempo y verificar `updated_at`.

## 5. Base de datos

- [ ] Migración nueva → `pnpm db:new "crear tabla establishment"` (será `V3__…`)
- [ ] `tenant_id TEXT NOT NULL REFERENCES tenant(id)` + índice `(tenant_id, id)`
- [ ] `SELECT enable_tenant_isolation('establishment')`
- [ ] Trigger `touch_updated_at` como el de `demo_item`
- [ ] `docs/db/mapit.dbml` actualizado en el **mismo** commit

Columnas: `id`, `tenant_id`, `name`, `type`, `slug`, `timezone`, `created_at`,
`created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`.

Dos detalles que no son obvios:

1. **Índice único parcial** `(tenant_id, slug) WHERE deleted_at IS NULL`. Un índice único
   normal impediría reutilizar el slug de un establecimiento dado de baja, que es
   justamente lo que pide CA-7.
2. **`created_by` / `updated_by` / `deleted_by` sin clave foránea.** `app_user` no existe
   todavía; la migración de CU-23/CU-24 añadirá las tres FK. Queda anotado como comentario
   SQL en la propia migración para que quien llegue después no lo tenga que adivinar.

Esto **añade tres columnas de auditoría al diseño de `mapit.dbml`**, que solo preveía
`created_at`. El DBML se actualiza en el mismo commit, como exige la regla del proyecto.

## 6. Frontend

**App:** `console` · **Feature:** `features/administration/establishments`

> `apps/console/AGENTS.md` asigna CU-01…CU-05 a la feature `administration`, así que la
> pantalla cuelga de ahí y no de una feature suelta.

| Parte                | Qué se añade                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `model/` (ViewModel) | `EstablishmentsStore`: señales de lista, borrador, edición, carga, guardado y error; comandos del CRUD. |
| `ui/`                | `Establishments`: lista + formulario con nombre, tipo (select de 4 valores), slug y zona horaria.       |
| `data/`              | `EstablishmentsApi`: adaptador delgado sobre el cliente generado.                                       |

Ruta `establishments` en `app.routes.ts`, con `loadComponent` perezoso como las demás.
El selector de tipo se deshabilita en modo edición, que es RN-3 hecha visible.

## 7. Feature toggle

No se añade feature flag. Gestionar establecimientos es una capacidad base del producto,
no un experimento ni un despliegue progresivo; una flag aquí solo añadiría una rama
muerta que alguien tendría que limpiar después.

## 8. Testing

| Nivel                  | Qué se prueba                                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit (dominio)**     | Reglas de `Establishment`: nombre obligatorio, formato de `Slug`, tipo válido, inmutabilidad del tipo al actualizar.                                                                                     |
| **Integración**        | Con Testcontainers: migración aplicada, alta, consulta, actualización, baja lógica, conflicto de slug `409` y `404` ajeno.                                                                               |
| **Aislamiento tenant** | **Obligatorio.** `EstablishmentIsolationIntegrationTest` siguiendo el patrón de `DemoItemIsolationIntegrationTest`: dos tenants, rol no privilegiado, se comprueba que solo se ve el propio. Cubre CA-9. |
| **Frontend**           | `establishments-store.spec.ts` con Vitest: carga, alta, edición, baja y estados de error.                                                                                                                |
| **E2E**                | No se añade. QA valida el flujo funcional; el E2E se reserva para flujos de cliente final.                                                                                                               |

## 9. Riesgos

| Riesgo                                                                                   | Mitigación                                                                                                                     |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Conflicto en `openapi.yaml`** con las ramas sin fusionar de CU-01 (`MAP-34`…`MAP-42`). | Añadir solo rutas y esquemas nuevos, sin tocar los del tenant. Rebase sobre `main` antes del PR.                               |
| Índice único total impediría reutilizar el slug tras una baja.                           | Índice **parcial** con `WHERE deleted_at IS NULL`, verificado por CA-7.                                                        |
| Olvidar el filtro `deleted_at IS NULL` en alguna consulta y exponer bajas.               | El filtro vive en el adaptador de persistencia, en un único sitio; test de integración que lo cubre (CA-6).                    |
| Columnas de autoría nulas indefinidamente si CU-23/CU-24 se retrasa.                     | Documentado en `spec.md` §9 y como comentario SQL en la migración; el dominio las trata como `Optional`, no como obligatorias. |
| Reproducir el antipatrón **Anemic Domain Model** dejando las reglas en el servicio.      | Las validaciones viven en el constructor compacto del record `Establishment`, como en `DemoItem`.                              |
| Editar una migración ya mergeada y romper el checksum de Flyway.                         | Migración nueva `V3__`; nunca se toca `V1` ni `V2`.                                                                            |
