# ADR-0009 — WebSocket STOMP con outbox y broker simple

- **Estado:** Aceptado
- **Fecha:** 2026-09-17
- **Deciden:** equipo MapIt · MAP-103 / HUT-01

## Contexto

HU-3.02 necesita recibir cambios de estado en tiempo real sin acoplar los casos de uso a STOMP,
sin mezclar tenants y sin perder eventos cuando el proceso se reinicia. El proyecto todavía no
necesita operar un broker externo, pero la abstracción no debe impedir sustituirlo después.

## Decisión

Se define un puerto puro `RealtimeEventPublisher`. La implementación escribe un outbox PostgreSQL
en la misma transacción del cambio de negocio; un dispatcher publica luego al simple broker en
memoria de Spring. La capa WebSocket autentica el frame STOMP `CONNECT` con Bearer JWT y autoriza
cada `SUBSCRIBE` mediante un puerto transversal que implementa `spaces`.

El contrato v1 usa un envelope versionado, `eventId` y `aggregateVersion`. La entrega es
at-least-once: el evento se marca publicado solo después del envío y el consumidor deduplica.
La flag `realtime.websocket` pausa tanto el dispatcher como las conexiones del cliente.

## Alternativas consideradas

| Opción                                                              | Por qué no                                                                                                     |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Publicar directamente desde el caso de uso                          | Una caída entre el commit y el envío pierde el evento y acopla negocio a transporte.                           |
| `@TransactionalEventListener(AFTER_COMMIT)` para escribir el outbox | El cambio y la escritura del outbox dejan de ser atómicos; un fallo después del commit pierde la notificación. |
| RabbitMQ/Redis desde HUT-01                                         | Agrega operación y configuración externa antes de que exista una necesidad multi-instancia.                    |
| SockJS                                                              | El contrato elegido requiere WebSocket nativo; fallback de negocio es polling, no otro transporte oculto.      |
| Tenant en el topic o payload público                                | Duplica una autoridad que debe provenir del JWT y facilita errores de aislamiento.                             |

## Consecuencias

Se obtiene durabilidad, testabilidad y un punto único de sustitución del broker. El simple broker
no distribuye mensajes entre instancias: antes de escalar horizontalmente se debe sustituir el
adaptador por uno con fan-out distribuido. At-least-once puede entregar duplicados, por lo que el
contrato obliga a usar `eventId` y `aggregateVersion`. Las filas publicadas se retienen y requieren
una limpieza configurable; el replay manual queda como operación futura.
