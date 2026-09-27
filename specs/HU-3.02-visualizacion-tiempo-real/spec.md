# HU-3.02 — Visualización en Tiempo Real

## 1. Contexto

Como usuario operativo, quiero ver en tiempo real los cambios de estado de los `SpaceElement`
de un establecimiento para disponer de una vista actualizada sin refrescar manualmente.

HU-3.01 ya cambia y audita el estado; HUT-01 (MAP-103) dejó el canal STOMP, el outbox, las salas
autorizadas y un `RealtimeClient` base. Esta historia **conecta ambos extremos**: el cambio de
estado publica el evento y la vista de elementos del sector lo refleja sin recarga.

Fuente funcional: HU-3.02 (Sprint 2, Épica E03), subtareas MAP-146 a MAP-151.
Contrato de tiempo real: [`docs/api/realtime.md`](../../docs/api/realtime.md).

## 2. Actores

| Rol     | Permiso                                                |
| ------- | ------------------------------------------------------ |
| ADMIN   | Ver en vivo los elementos de los sectores de su tenant |
| MANAGER | Ver en vivo los elementos de los sectores de su tenant |
| STAFF   | Ver en vivo los elementos de los sectores de su tenant |

La autorización de salas ya la resuelve HUT-01 (`JdbcRealtimeRoomAccessAdapter`); esta
historia no la duplica.

## 3. Flujo principal

1. El usuario abre la vista de elementos de un sector (`/spaces/sectors/:sectorId/elements`).
2. La vista carga los elementos por HTTP (HU-2.03) y el cliente se suscribe a la sala del
   sector `/topic/establishments/{establishmentId}/sectors/{sectorId}`.
3. Otro usuario (u otra pestaña) cambia el estado de un elemento (HU-3.01).
4. El caso de uso escribe el evento `space-element.state.changed.v1` en el outbox, en la
   misma transacción del cambio.
5. El dispatcher lo publica en las salas del establecimiento y del sector.
6. La vista recibe el evento y actualiza el estado del elemento sin recargar.

## 4. Decisiones de alcance

- **STOMP sobre WebSocket nativo, sin SockJS.** La HU menciona SockJS, pero el contrato de
  HUT-01 fija WebSocket nativo y la HU exige compatibilidad con esa infraestructura. Añadir
  SockJS obligaría a cambiar el endpoint del servidor y romper el contrato v1.
- **Se propaga el estado, no la posición.** El envelope v1 solo transporta estado. Las
  coordenadas cambian por edición (HU-2.03 / HU-4.01); publicar movimientos exigiría un
  evento nuevo versionado (`space-element.moved.v1`), fuera de esta historia.
- **La vista "de posiciones"** es la lista de elementos del sector de HU-2.03 (tipo, `x`, `y`,
  estado). Se conserva su modelo y no se añade edición ni drag & drop.
- **Kill switch `realtime.websocket` apagado ⇒ sondeo.** La vista recarga periódicamente por
  HTTP, como exige el contrato de HUT-01.

## 5. Contrato del evento (sin cambios)

Se usa el envelope v1 de `docs/api/realtime.md` tal cual: `eventId`, `eventType`,
`schemaVersion`, `occurredAt`, `establishmentId`, `sectorId`, `aggregateVersion` y `payload`
con `spaceElementId`, `previousState` y `state`. No se modifica OpenAPI.

## 6. Reglas de negocio

- El evento se publica **solo** si el estado cambió; repetir el estado actual (idempotente en
  HU-3.01) no publica nada.
- Cambio de estado, auditoría y evento son atómicos: si la transacción falla, no hay evento.
- `aggregateVersion` crece por elemento; el cliente descarta duplicados (mismo `eventId`) y
  versiones anteriores o iguales a la última aplicada.
- El cliente nunca envía `tenantId`; la sala se deriva del establecimiento y sector que el
  usuario ya tiene abiertos, y el servidor la valida contra el JWT.
- Cambiar de sector cancela la suscripción anterior; no quedan suscripciones duplicadas.
- Los componentes no llaman HTTP ni STOMP directamente: consumen el store / servicio de datos.

## 7. Criterios de aceptación

- [ ] **CA-1 (MAP-146):** Dado un elemento en `AVAILABLE`, cuando se cambia a `OCCUPIED`,
      entonces se escribe en el outbox un evento `space-element.state.changed.v1` con
      `spaceElementId`, `establishmentId`, `sectorId`, `previousState = AVAILABLE`,
      `state = OCCUPIED`, `occurredAt` y `aggregateVersion` positiva.
- [ ] **CA-2 (MAP-146):** Dado un cambio al mismo estado o una transición inválida, entonces
      no se escribe ningún evento.
- [ ] **CA-3 (MAP-146):** Dados dos cambios sucesivos del mismo elemento, entonces el segundo
      evento tiene una `aggregateVersion` mayor que el primero.
- [ ] **CA-4 (MAP-148):** Dado un usuario autenticado con la flag activa, cuando abre la vista,
      entonces el cliente conecta; al cerrar sesión o salir de la vista, desconecta; ante un
      corte, reintenta con el backoff de HUT-01.
- [ ] **CA-5 (MAP-149):** Dada la vista de un sector, entonces el cliente se suscribe
      exactamente a la sala de ese sector; al cambiar de sector, la suscripción anterior se
      cancela y no se reciben eventos del sector previo.
- [ ] **CA-6 (MAP-149):** Dado un usuario de otro tenant, cuando intenta suscribirse a la sala
      de un sector ajeno, entonces el servidor la rechaza (cubierto por HUT-01; se verifica
      que el cliente no construye salas con datos fuera de su contexto).
- [ ] **CA-7 (MAP-150):** Dado un evento recibido para un elemento visible, entonces la vista
      muestra el nuevo estado sin recarga; un evento duplicado o con versión anterior no la
      altera.
- [ ] **CA-8 (MAP-150):** Dada la flag `realtime.websocket` apagada, entonces la vista se
      actualiza por sondeo HTTP periódico y no abre WebSocket.
- [ ] **CA-9 (MAP-151):** Existe un E2E contra el stack real que cambia el estado por la API y
      espera el cambio en la vista de otra sesión sin esperas fijas; falla si la latencia
      supera 2 s.
- [ ] **CA-10 (MAP-147):** La latencia extremo a extremo se mide en N ≥ 20 muestras y se
      registran p50, p95 y máximo; se cumple si **p95 < 2000 ms**. La evidencia queda en
      `specs/HU-3.02-visualizacion-tiempo-real/latency.md`.

## 8. Fuera de alcance

- Edición, drag & drop y movimiento de elementos (HU-4.01).
- Evento de cambio de posición/geometría (requiere contrato v2 o evento nuevo).
- SockJS y broker externo (RabbitMQ/Redis); se mantiene el simple broker de HUT-01.
- Autorización de salas: ya implementada en HUT-01 / CU-24.
- Vista pública (`public-web`).

## 9. Impacto multi-tenant

No se crean tablas. El evento se escribe en `realtime_event_outbox` (HUT-01), que ya lleva
`tenant_id` y RLS. El `tenant_id` del evento sale del `TenantContext` (claim del JWT) y no se
publica en el envelope. La suscripción la autoriza el servidor con el JWT del `CONNECT`.
