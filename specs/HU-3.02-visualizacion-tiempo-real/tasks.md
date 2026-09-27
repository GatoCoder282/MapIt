# Tareas — HU-3.02 Visualización en Tiempo Real

## MAP-146 — Emitir evento al cambiar estado

- [ ] Crear el puerto `SpaceElementRealtimeContextRepository` en `operations-domain`.
- [ ] Implementar el adaptador JDBC (establecimiento del sector y versión por auditoría).
- [ ] Publicar `space-element.state.changed.v1` desde `UpdateSpaceElementState` tras auditar.
- [ ] Test unitario: cambio publica payload completo; mismo estado e inválido no publican.
- [ ] Test de integración: el cambio escribe una fila en `realtime_event_outbox` con versión
      creciente.

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
