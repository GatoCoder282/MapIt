# Contrato de tiempo real — MAP-103 / HUT-01

Este documento es la fuente de verdad del canal WebSocket de MapIt. No forma parte de
`packages/api-contract/openapi.yaml`: OpenAPI describe HTTP/REST y este contrato describe
STOMP sobre WebSocket.

## Transporte y destinos

- Transporte: WebSocket nativo, sin SockJS.
- Handshake: `GET /ws`.
- Autenticación: encabezado nativo `Authorization: Bearer <JWT>` en el frame STOMP `CONNECT`.
  El navegador no necesita —ni puede de forma portable— enviar el Bearer en el handshake HTTP.
- Prefijo de publicación del servidor: `/topic`.
- Prefijo de mensajes de aplicación: `/app` (reservado; HUT-01 no acepta mensajes de clientes).
- Broker actual: simple broker en memoria de Spring. Es una implementación de una sola instancia;
  RabbitMQ/Redis queda detrás de este mismo puerto para una futura evolución multi-instancia.

Las salas permitidas son:

```text
/topic/establishments/{establishmentId}
/topic/establishments/{establishmentId}/sectors/{sectorId}
```

La suscripción se autoriza con el `tenant` y la identidad del JWT. El backend de `spaces` verifica
que el establecimiento/sector existe, está vivo y pertenece al tenant. No se acepta un `tenantId`
en el destino ni en el payload enviado por el cliente.

## Envelope v1

El servidor publica JSON con `eventType = space-element.state.changed.v1` y `schemaVersion = 1`:

```json
{
  "eventId": "018f2f7a-2c13-7a56-9e9a-000000000001",
  "eventType": "space-element.state.changed.v1",
  "schemaVersion": 1,
  "occurredAt": "2026-09-17T18:00:00Z",
  "establishmentId": "018f2f7a-2c13-7a56-9e9a-000000000010",
  "sectorId": "018f2f7a-2c13-7a56-9e9a-000000000011",
  "aggregateVersion": 4,
  "payload": {
    "spaceElementId": "018f2f7a-2c13-7a56-9e9a-000000000012",
    "previousState": "AVAILABLE",
    "state": "OCCUPIED"
  }
}
```

`sectorId` y `previousState` son opcionales. Los estados v1 son `AVAILABLE`, `OCCUPIED`,
`RESERVED`, `CLEANING` y `OUT_OF_SERVICE`. `tenantId` no se publica: es un dato interno del
outbox y del JWT.

`eventId` es único y `aggregateVersion` crece por elemento. La entrega es **at-least-once**:
un consumidor guarda el último `eventId` procesado y descarta duplicados o versiones anteriores.
El servidor publica un evento de sector tanto en la sala del establecimiento como en la sala del
sector; el cliente debe deduplicar cuando escucha ambas.

## Semántica de entrega

1. El caso de uso cambia el estado y escribe el evento en `realtime_event_outbox` dentro de la
   misma transacción.
2. Un dispatcher reclama lotes pequeños, publica al simple broker y marca `published_at`.
3. Un fallo deja la fila disponible para reintento con backoff exponencial acotado (250 ms a 30 s).
   No se descartan eventos automáticamente.
4. Las filas publicadas se retienen siete días por defecto; la limpieza es configurable y deja
   abierta la futura operación de replay/metricas.

La flag `realtime.websocket` es un kill switch de extremo a extremo. Apagada, el dispatcher no
reclama filas y el cliente no conecta ni reconecta; la UI debe usar su fallback de sondeo.

## Subtareas y ramas

MAP-103 se implementa como historia técnica habilitadora de HU-3.02. La secuencia de trabajo
queda apilada para que cada PR sea revisable de forma independiente y conserve la trazabilidad
con `GatoCoder282`:

| Orden | Jira             | Entrega                                          | Rama derivada                                                       | Base prevista |
| ----- | ---------------- | ------------------------------------------------ | ------------------------------------------------------------------- | ------------- |
| 0     | MAP-103 / HUT-01 | Infraestructura completa y contrato v1           | `feat/GatoCoder282/HUT-01-implementacion-infraestructura-websocket` | `main`        |
| 1     | MAP-122          | Envelope, destinos y documentación STOMP         | `feat/GatoCoder282/MAP-122-contrato-eventos-stomp`                  | rama HUT-01   |
| 2     | MAP-120          | Endpoint, autenticación CONNECT, broker y outbox | `feat/GatoCoder282/MAP-120-servidor-stomp`                          | MAP-122       |
| 3     | MAP-121          | Autorización de rooms por establecimiento/sector | `feat/GatoCoder282/MAP-121-rooms-establishment-sector`              | MAP-120       |
| 4     | MAP-123          | Cliente base, reconexión y pruebas end-to-end    | `feat/GatoCoder282/MAP-123-tests-client-reconexion`                 | MAP-121       |

La rama HUT-01 contiene la implementación integrada para validación local. Si se publican PRs
apilados, cada uno debe indicar su rama base, el siguiente PR y el enlace a MAP-103/HU-3.02;
solo el último apunta a `main`. No se crean ramas por archivo ni ramas paralelas que oculten el
orden de dependencias.

## Fuera de HUT-01

- No se implementa la actualización de estado de MAP-104/HU-3.01.
- No se implementa la vista completa de MAP-145/HU-3.02.
- No se agregan mensajes de cliente, drag & drop, reservas ni estado de negocio dentro del broker.
