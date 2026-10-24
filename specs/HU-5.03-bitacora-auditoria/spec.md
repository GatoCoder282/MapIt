# HU-5.03 — Bitácora de Auditoría

> **Estado:** Aprobada el 2026-10-22 · **Creada:** 2026-10-22 · **Responsable:** Christian Ferrufino

## Enunciado

Como administrador, quiero consultar una bitácora inmutable de los eventos relevantes de
reservas y elementos espaciales, para conocer quién realizó cada acción, sobre qué recurso y
cuándo ocurrió, sin exponer información de otros tenants ni datos sensibles.

Fuente funcional: [MAP-194](https://matiasmv2005.atlassian.net/browse/MAP-194).

---

## 1. Por qué (contexto)

MapIt ya registra en `space_element_state_change` los cambios de estado operativo creados por
HU-3.01. Ese registro es específico de `SpaceElement` y no permite consultar en una misma
bitácora los eventos de reservas. HU-5.03 amplía esa capacidad a una auditoría transversal,
conserva el historial existente y evita convertir los logs técnicos de la aplicación en una
fuente de trazabilidad de negocio.

La bitácora responde preguntas operativas como: quién creó una reserva, quién cambió el estado
de un elemento, cuál era el valor anterior, cuál es el nuevo valor y en qué instante ocurrió.

## 2. Actores

| Actor               | Participación                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `ADMIN`             | Consulta la bitácora de su tenant y aplica filtros.                                              |
| `MANAGER` / `STAFF` | Sus acciones autorizadas pueden generar eventos, pero no consultan la bitácora en esta historia. |
| `SUPER_ADMIN`       | No consulta bitácoras de tenants desde este flujo.                                               |
| Sistema             | Registra el evento dentro de la misma transacción que la acción auditada.                        |

## 3. Precondiciones

- El usuario que consulta inició sesión como `ADMIN` de un tenant activo.
- El tenant se obtiene exclusivamente del claim `tenant` del JWT.
- El evento de negocio que se audita fue validado y será persistido correctamente.
- Los registros existentes de HU-3.01 se conservan al generalizar la bitácora.

## 4. Flujo principal

1. Un usuario autorizado crea una reserva o cambia el estado operativo de un `SpaceElement`.
2. El caso de uso construye un evento con tenant, actor, instante, tipo de recurso,
   identificador, tipo de evento y cambios mínimos permitidos.
3. La acción y el evento se persisten en una sola transacción.
4. Un `ADMIN` abre la pantalla de auditoría.
5. La consola solicita una página del histórico con filtros opcionales.
6. El backend obtiene el tenant del JWT, aplica autorización y consulta solo sus registros.
7. La consola muestra los eventos en orden cronológico descendente y con textos comprensibles.

## 5. Eventos incluidos

| Tipo de evento                | Recurso         | Datos mínimos                                                                                    |
| ----------------------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| `RESERVATION_CREATED`         | `RESERVATION`   | Estado inicial y referencia del establecimiento.                                                 |
| `RESERVATION_STATUS_CHANGED`  | `RESERVATION`   | Estado anterior y estado nuevo, cuando el flujo de estados esté disponible en la base integrada. |
| `SPACE_ELEMENT_STATE_CHANGED` | `SPACE_ELEMENT` | Estado anterior, estado nuevo y sector.                                                          |

No se auditan consultas de lectura, intentos de autenticación, contraseñas, tokens, hashes,
credenciales, cuerpos HTTP completos ni datos personales del cliente.

## 6. Flujos alternativos y errores

| Situación                                                               | Comportamiento esperado                              |
| ----------------------------------------------------------------------- | ---------------------------------------------------- |
| Usuario sin JWT                                                         | Responde `401`.                                      |
| Rol distinto de `ADMIN`                                                 | Responde `403`.                                      |
| Recurso o evento de otro tenant usado como filtro                       | Devuelve una página vacía sin revelar su existencia. |
| Filtros o paginación inválidos                                          | Responde `400` con Problem Details.                  |
| No existen eventos para los filtros                                     | Responde `200` con una página vacía.                 |
| Falla la persistencia del evento                                        | Se revierte también la acción de negocio auditada.   |
| Se intenta modificar o borrar un registro por SQL del rol de aplicación | PostgreSQL rechaza la operación.                     |

## 7. Reglas de negocio

- **RN-1:** Un registro de auditoría es append-only: después de crearse no puede modificarse ni
  eliminarse desde el API ni mediante el rol de ejecución normal de la aplicación.
- **RN-2:** El tenant, actor, identificador e instante los decide el backend; nunca se aceptan
  desde el cliente.
- **RN-3:** La acción auditada y su evento se confirman o revierten en la misma transacción.
- **RN-4:** Toda consulta filtra explícitamente por tenant y además queda protegida por RLS.
- **RN-5:** Los resultados se ordenan por `occurred_at DESC, id DESC` para ofrecer un orden
  determinista.
- **RN-6:** La API es paginada y limita el tamaño máximo de página para evitar consultas sin
  límite sobre una tabla creciente.
- **RN-7:** Los detalles del evento se construyen con un conjunto permitido de claves; no se
  admiten secretos ni cargas arbitrarias entregadas por el cliente.
- **RN-8:** Los eventos históricos de `space_element_state_change` se migran sin perder actor,
  instante, recurso ni transición.
- **RN-9:** Los logs estructurados de la aplicación no sustituyen la bitácora de negocio.

## 8. Criterios de aceptación

- [x] **CA-1:** Dada una reserva creada correctamente, cuando finaliza la transacción, entonces
      existe exactamente un evento `RESERVATION_CREATED` con tenant, actor, instante y recurso.
- [x] **CA-2:** Dado un cambio válido de estado de `SpaceElement`, cuando se confirma, entonces
      se registra `SPACE_ELEMENT_STATE_CHANGED` con estado anterior y nuevo.
- [x] **CA-3:** Dada una acción que falla o se revierte, cuando termina la transacción, entonces
      no queda un evento huérfano ni una escritura parcial.
- [x] **CA-4:** Dado un `ADMIN` autenticado, cuando consulta el histórico, entonces recibe una
      página ordenada de eventos pertenecientes únicamente a su tenant.
- [x] **CA-5:** Dado un filtro por tipo de recurso, evento, identificador o intervalo de fechas,
      cuando se consulta, entonces la respuesta contiene solo los registros coincidentes.
- [x] **CA-6:** Dado un usuario anónimo o con rol `MANAGER`, `STAFF` o `SUPER_ADMIN`, cuando
      consulta la bitácora de esta historia, entonces recibe `401` o `403` según corresponda.
- [ ] **CA-7:** Dado un registro existente, cuando el rol normal de la aplicación intenta
      actualizarlo o eliminarlo, entonces PostgreSQL rechaza la operación y el registro no cambia.
- [x] **CA-8:** Dados dos tenants con eventos, cuando cada administrador consulta, entonces
      ninguno puede observar ni inferir los registros del otro.
- [ ] **CA-9:** Dados registros históricos de HU-3.01, cuando se aplica la nueva migración,
      entonces siguen disponibles en la consulta general con los mismos datos de trazabilidad.
- [x] **CA-10:** Dada la vista de auditoría, cuando carga, filtra, pagina o recibe un error,
      entonces presenta estados comprensibles, accesibles y conserva los filtros útiles.
- [ ] **CA-11:** Dado cualquier evento persistido o devuelto, cuando se inspeccionan sus datos,
      entonces no contiene contraseñas, hashes, JWT, credenciales ni datos personales innecesarios.

## 9. Fuera de alcance

- Exportación CSV/PDF y reportes analíticos.
- Retención, archivado o purga automática de auditoría.
- Auditoría de lecturas, login, configuración de tenants, pagos o cambios fuera de reservas y
  `SpaceElement`.
- Edición, corrección o eliminación manual de eventos.
- Vista global de auditoría para `SUPER_ADMIN`.
- Recolección centralizada de logs, métricas o trazas distribuidas.
- Implementar el ciclo de estados de reserva si HU-5.02 todavía no está integrado; HU-5.03
  conectará ese evento cuando el caso de uso exista en la rama base.

## 10. Impacto multi-tenant y seguridad

- La tabla general lleva `tenant_id NOT NULL`, índice `(tenant_id, id)` y RLS forzada.
- Todas las escrituras y consultas incluyen el `tenant_id` obtenido del contexto autenticado.
- Los filtros no permiten cambiar el tenant de la consulta.
- El endpoint solo expone `GET`; no existen operaciones normales de creación, edición o borrado.
- El rol runtime dispone de `SELECT` e `INSERT`, pero no de `UPDATE` ni `DELETE` sobre la tabla.
- La migración conserva y transforma el histórico específico de HU-3.01 antes de retirar su
  almacenamiento anterior.

## 11. Trazabilidad Jira

| Subtarea                                                     | Entrega                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| [MAP-222](https://matiasmv2005.atlassian.net/browse/MAP-222) | Entidad `AuditLog` inmutable y persistencia general.    |
| [MAP-223](https://matiasmv2005.atlassian.net/browse/MAP-223) | Registro de eventos de `Reservation` y `SpaceElement`.  |
| [MAP-224](https://matiasmv2005.atlassian.net/browse/MAP-224) | Contrato y endpoint paginado de histórico.              |
| [MAP-225](https://matiasmv2005.atlassian.net/browse/MAP-225) | Vista de auditoría para `ADMIN`.                        |
| [MAP-226](https://matiasmv2005.atlassian.net/browse/MAP-226) | Integración, inmutabilidad, autorización y aislamiento. |
