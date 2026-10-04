# Plan — HU-5.01 Creación de Reserva Interna

## 1. Enfoque

La capacidad vive en el módulo `reservations`, responsable de CU-11 y CU-12. El dominio
modela primero `Reservation`, sus identificadores y el intervalo temporal sin depender de
Spring, JPA ni del módulo `spaces`. Los identificadores de establecimiento y elementos se
mantienen como UUID en este contexto; la aplicación verifica su existencia mediante puertos
propios implementados por infraestructura.

El contrato REST será la fuente de verdad antes de implementar el controlador. La creación
se ejecutará en una sola transacción y validará persona, establecimiento, elementos,
aislamiento por tenant y ausencia de solapamientos. La protección final ante concurrencia se
decidirá en MAP-216 con una prueba que reproduzca dos solicitudes simultáneas.

## 2. Patrones de diseño aplicados

| Patrón              | Dónde                                                                                                  | Por qué aquí                                                                                    | Alternativa descartada                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Ports and Adapters  | Puertos de personas, recursos y reservas en `reservations-domain`; adaptadores JDBC en infraestructura | Evita importar los módulos `spaces` o `identity` y permite probar el caso de uso sin PostgreSQL | Importar repositorios de otros módulos rompería los límites modulares |
| Repository          | Persistencia y consulta de conflictos mediante interfaces del dominio                                  | El caso de uso expresa qué necesita consultar sin conocer SQL ni RLS                            | Ejecutar SQL desde application acoplaría negocio y base de datos      |
| Value Object        | `ReservationId`, `PersonId` y `ReservationTimeRange`                                                   | Evita confundir UUID y concentra la validez del intervalo `[inicio, fin)`                       | Usar UUID e instantes sueltos permitiría combinaciones inválidas      |
| Application Service | Caso de uso `CreateReservation`                                                                        | Coordina validaciones y persistencia dentro de una transacción atómica                          | Colocar la lógica en el controlador mezclaría HTTP y negocio          |

No se aplica State en esta historia: la reserva solo nace en `CREATED`; las transiciones
corresponden a CU-13.

## 3. Cambios en el contrato API

- [ ] Editar `packages/api-contract/openapi.yaml` antes del controlador y del cliente.
- [ ] Ejecutar `pnpm api:lint` y `pnpm api:gen` después del cambio.

| Método | Ruta                                                    | Descripción                                            |
| ------ | ------------------------------------------------------- | ------------------------------------------------------ |
| `GET`  | `/api/v1/people`                                        | Buscar clientes del tenant con criterios normalizados. |
| `POST` | `/api/v1/people`                                        | Registrar una persona del tenant.                      |
| `POST` | `/api/v1/establishments/{establishmentId}/reservations` | Crear una reserva interna para uno o más elementos.    |

El cuerpo de creación incluirá `personId`, `spaceElementIds`, `startsAt` y `endsAt`. No
aceptará `tenantId`, `status`, `createdBy` ni campos de auditoría.

## 4. Backend

**Módulo:** `reservations`

| Capa                          | Qué se añade                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `reservations-domain`         | Entidad `Reservation`, estado inicial, objetos de valor para identificadores e intervalo y puertos de persistencia/consulta.    |
| `reservations-application`    | Casos de uso para buscar/registrar personas y crear reservas; coordinación transaccional y validación de disponibilidad.        |
| `reservations-infrastructure` | Adaptadores JDBC con tenant explícito y RLS, controladores que implementan interfaces generadas y traducción a Problem Details. |

El módulo `reservations` no importará `spaces`: infraestructura consultará las tablas
necesarias mediante sus propios adaptadores y devolverá proyecciones mínimas definidas por
los puertos de reservations.

## 5. Base de datos

- [ ] Crear migraciones nuevas con `pnpm db:new`; no editar migraciones mergeadas.
- [ ] Crear `person`, `reservation` y la asociación de reserva con elementos.
- [ ] Incluir `tenant_id NOT NULL`, índices multi-tenant y RLS forzada.
- [ ] Mantener FKs compuestas o validaciones equivalentes que impidan asociaciones entre
      tenants.
- [ ] Actualizar `docs/db/mapit.dbml` en el mismo commit de migración.

La representación del intervalo en PostgreSQL debe permitir comprobar la fórmula de
solapamiento y soportar una garantía de concurrencia. MAP-216 elegirá entre una restricción
de exclusión y un bloqueo transaccional por recurso basándose en una prueba concurrente.

## 6. Frontend

**App:** `console` · **Feature:** `reservations`

| Parte    | Qué se añade                                                                     |
| -------- | -------------------------------------------------------------------------------- |
| `model/` | Store con búsqueda/alta de cliente, borrador de reserva, carga, éxito y errores. |
| `ui/`    | Formulario accesible para cliente, intervalo y selección de elementos.           |
| `data/`  | Adaptador delgado sobre el cliente generado de OpenAPI.                          |

La feature `reservations` no importará otra feature Angular. Los elementos necesarios se
obtendrán mediante el cliente API o una librería compartida si aparece una necesidad real.

## 7. Feature toggle

No se crea una flag: la reserva interna es una capacidad base de CU-12 y no un experimento.
La ruta permanecerá fuera de la navegación hasta que el flujo completo esté integrado.

## 8. Testing

| Nivel               | Qué se prueba                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Unitario de dominio | Identidad, estado inicial, intervalo válido, elementos obligatorios y únicos, inmutabilidad y detección de solapamiento. |
| Aplicación          | Creación válida, validaciones de recursos, rechazo total ante un conflicto y ausencia de escritura parcial.              |
| Integración         | Contrato HTTP, seguridad, persistencia, FKs, errores y transacción completa con Testcontainers.                          |
| Aislamiento tenant  | Tenant A no consulta ni referencia personas, reservas o elementos del tenant B; sin tenant no hay filas.                 |
| Concurrencia        | Dos solicitudes simultáneas sobre el mismo recurso producen un éxito y un `409`.                                         |
| Frontend            | Store con búsqueda, alta, creación, loading y errores `400`, `404` y `409`.                                              |
| E2E                 | Flujo de alta/búsqueda de cliente y creación desde la consola cuando backend y frontend estén completos.                 |

## 9. Riesgos

| Riesgo                                                              | Mitigación                                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Dos solicitudes pasan la consulta de disponibilidad al mismo tiempo | Prueba concurrente en MAP-216 y garantía en transacción/BD antes de cerrar la HU               |
| Referencias cruzadas entre tenants                                  | Filtro explícito, RLS, índices/FKs multi-tenant y pruebas con dos tenants                      |
| Acoplar reservations con spaces                                     | Puertos y proyecciones mínimas dentro de reservations; solo bootstrap conoce todos los módulos |
| Ambigüedad de zonas horarias                                        | API y dominio usan instantes; la UI convierte con la zona IANA del establecimiento             |
| Reservas parciales con varios elementos                             | Validar todos los recursos antes de persistir y mantener una sola transacción                  |

## 10. Entregas por MAP

| MAP     | Entrega                                                         |
| ------- | --------------------------------------------------------------- |
| MAP-208 | Entidad `Reservation`, value objects e invariantes de creación. |
| MAP-209 | Migración Flyway, índices, integridad, RLS y DBML.              |
| MAP-210 | Entidad `Person`, búsqueda y registro de clientes.              |
| MAP-211 | Caso de uso de creación y validación de no superposición.       |
| MAP-212 | Contrato OpenAPI, generación y endpoint POST.                   |
| MAP-213 | Búsqueda y alta de cliente en la consola.                       |
| MAP-214 | Formulario conectado a API con manejo de resultados.            |
| MAP-215 | Pruebas de integración del flujo completo.                      |
| MAP-216 | Prueba y garantía frente a condiciones de carrera.              |
