# HU-3.01 — Actualización de Estado

## 1. Contexto

El personal necesita mantener el mapa operativo alineado con la situación real del
establecimiento. HU-2.03 crea los `SpaceElement`; esta historia permite cambiar su estado
sin romper el aislamiento por tenant y deja preparada la publicación posterior por WebSocket.

Fuente funcional: [MAP-104](https://matiasmv2005.atlassian.net/browse/MAP-104).

## 2. Actores

| Rol   | Permiso                                     |
| ----- | ------------------------------------------- |
| ADMIN | Cambiar el estado de elementos de su tenant |
| STAFF | Cambiar el estado de elementos de su tenant |

Los demás roles no pueden ejecutar la operación.

## 3. Flujo principal

1. El actor autenticado selecciona un elemento de un sector.
2. Solicita uno de los estados operativos admitidos.
3. El backend obtiene el tenant exclusivamente del JWT.
4. El dominio valida la transición.
5. La operación persiste el nuevo estado y su auditoría en una sola transacción.
6. La API devuelve el estado persistido y el frontend actualiza la vista.

## 4. Estados

`AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING` y `OUT_OF_SERVICE`.

La matriz de transiciones se centraliza en el dominio en MAP-126. Enviar el mismo estado
es idempotente y no crea un cambio adicional.

## 5. Contrato REST

`PATCH /api/v1/sectors/{sectorId}/elements/{elementId}/state`

El cuerpo solo contiene `state`. El tenant y el actor nunca se aceptan desde el cliente.

## 6. Reglas de negocio

- El elemento debe existir, estar activo y pertenecer al sector y tenant autenticados.
- Un identificador inexistente o de otro tenant responde igual: `404`.
- Solo ADMIN y STAFF pueden cambiar estados.
- El cambio y su auditoría deben ser atómicos.
- La lógica no depende de STOMP; la publicación se realiza mediante un puerto.

## 7. Criterios de aceptación

- [ ] **CA-1:** Dado un ADMIN o STAFF autenticado, cuando solicita una transición válida
      sobre un elemento de su tenant, entonces recibe `200` y el estado queda persistido.
- [ ] **CA-2:** Dado un elemento inexistente, dado de baja, de otro sector o de otro tenant,
      cuando se intenta cambiar su estado, entonces responde `404` sin filtrar su existencia.
- [ ] **CA-3:** Dado un actor sin el rol permitido, cuando invoca el endpoint, entonces
      responde `403`; sin JWT responde `401`.
- [ ] **CA-4:** Dada una transición inválida, cuando se solicita, entonces responde `409`
      con Problem Details y no modifica el elemento.
- [ ] **CA-5:** Dado un cambio exitoso, entonces se registra actor, fecha, estado anterior
      y nuevo estado de forma persistente y consultable.
- [ ] **CA-6:** Dado el control de Staff, cuando la API confirma el cambio, entonces la
      interfaz muestra el nuevo estado; ante error conserva el anterior e informa el fallo.

## 8. Fuera de alcance

- Propagación WebSocket al cliente, cubierta por HU-3.02.
- Reservas y reglas temporales de ocupación.
- Edición de tipo, coordenadas o geometría del elemento.

## 9. Multi-tenant

El tenant sale del claim `tenant` del JWT. Las consultas incluyen `tenant_id` y PostgreSQL
RLS actúa como segunda barrera. Nunca se recibe `tenant_id` por body, path ni encabezado.
