# Tareas — HU-3.02 Visualización en Tiempo Real

## MAP-146 — Emitir evento al cambiar estado

- [x] Obtener el `establishmentId` del elemento (el topic es por establecimiento): el
      adaptador JDBC lo resuelve con el join `sector → floor → establishment`, ya que la
      vista de dominio `OperationalSpaceElement` es la que lleva el dato.
- [x] Publicar `space-element.state.changed.v1` desde `UpdateSpaceElementState` tras auditar.
- [x] Test unitario: cambio publica payload completo; mismo estado e inválido no publican.
- [x] Test de integración: el cambio escribe una fila en `realtime_event_outbox` con versión
      creciente.

> **Implementado en la v7 de CU-10** (el panel "Ocupación en vivo" del dashboard). El hueco
> era real: el publicador del outbox existía y funcionaba, pero **solo lo usaban los tests** —
> el caso de uso del cambio de estado no encolaba nada, así que la tabla
> `realtime_event_outbox` quedaba vacía y el vivo no tenía nada que recibir. La versión del
> agregado es el **número de cambios registrados del elemento, contando este**: crece con la
> bitácora real, no con un contador inventado.

## MAP-148 — Cliente STOMP en Angular

- [ ] Operador `dedupeRealtimeEvents` en `libs/realtime` con tests.
- [ ] Servicio `SpaceElementsRealtime` en la capa `data` de `spaces`: conecta con la primera
      suscripción, desconecta con la última, expone estado de conexión.
- [ ] Tests del servicio con cliente STOMP falso (recepción de evento, desconexión).

## MAP-149 — Suscripción a rooms

- [ ] Resolver `establishmentId` desde el store o el query param del enlace de sectores.
- [ ] `SpacesStore.watchSector` con `switchMap`: cambiar de sector cancela la sala anterior.
- [ ] Test: solo se suscribe a la sala del sector actual; al cambiar no hay duplicados.

## MAP-150 — Vista reactiva

- [ ] `applyRealtimeStateChange` inmutable con control de `aggregateVersion`.
- [ ] Indicador de conexión en la lista y `data-state` por elemento para pruebas.
- [ ] Sondeo HTTP de respaldo cuando no hay conexión.
- [ ] Tests del store: aplica evento, ignora duplicado/antiguo, sondeo con flag apagada.

## MAP-151 — E2E de latencia

- [ ] Sembrar datos por API real y abrir la vista del sector.
- [ ] Medir `t0` (antes del PATCH) y `t1` (MutationObserver sobre `data-state`).
- [ ] Fallar si alguna muestra no llega o `p95 ≥ 2000 ms`; adjuntar JSON de resultados.

## MAP-147 — Medición y evidencia

- [ ] Ejecutar el E2E en condiciones documentadas (máquina, stack, N).
- [ ] Registrar p50, p95 y máximo en `latency.md`.

## Notas de ejecución

_Se completan al cerrar cada subtarea._
