# Tareas — HU-3.02 Visualización en Tiempo Real

## MAP-146 — Emitir evento al cambiar estado

- [x] Crear el puerto `SpaceElementRealtimeContextRepository` en `operations-domain`.
- [x] Implementar el adaptador JDBC (establecimiento del sector y versión por auditoría).
- [x] Publicar `space-element.state.changed.v1` desde `UpdateSpaceElementState` tras auditar.
- [x] Test unitario: cambio publica payload completo; mismo estado e inválido no publican.
- [x] Test de integración: el cambio escribe una fila en `realtime_event_outbox` con versión
      creciente.

## MAP-148 — Cliente STOMP en Angular

- [x] Operador `dedupeRealtimeEvents` en `libs/realtime` con tests.
- [x] Servicio `SpaceElementsRealtime` en la capa `data` de `spaces`: conecta con la primera
      suscripción, desconecta con la última, expone estado de conexión.
- [x] Tests del servicio con cliente STOMP falso (recepción de evento, desconexión).

## MAP-149 — Suscripción a rooms

- [x] Resolver `establishmentId` desde el store o el query param del enlace de sectores.
- [x] `SpacesStore.watchSectorLive` + `effect`/`onCleanup`: cambiar de sector cancela la sala anterior.
- [x] Test: solo se suscribe a la sala del sector actual; al cambiar no hay duplicados.

## MAP-150 — Vista reactiva

- [x] `applyRealtimeStateChange` inmutable con control de `aggregateVersion`.
- [x] Indicador de conexión en la lista y `data-state` por elemento para pruebas.
- [x] Sondeo HTTP de respaldo cuando no hay conexión.
- [x] Tests del store: aplica evento, ignora duplicado/antiguo, sondeo con flag apagada.

## MAP-151 — E2E de latencia

- [ ] Sembrar datos por API real y abrir la vista del sector.
- [ ] Medir `t0` (antes del PATCH) y `t1` (MutationObserver sobre `data-state`).
- [ ] Fallar si alguna muestra no llega o `p95 ≥ 2000 ms`; adjuntar JSON de resultados.

## MAP-147 — Medición y evidencia

- [ ] Ejecutar el E2E en condiciones documentadas (máquina, stack, N).
- [ ] Registrar p50, p95 y máximo en `latency.md`.

## Notas de ejecución

### MAP-146

- Rama `feat/Trigramador69/MAP-146-emitir-evento-cambio-estado`, apilada sobre la rama raíz de
  HU-3.02, que a su vez parte de `chris799-hub/map-144-pruebas-integracion-hu-3-01` (HU-3.01 aún
  no está en `main`) con `main` integrado.
- Se reutiliza el puerto `RealtimeEventPublisher` y el outbox de HUT-01; el caso de uso no
  conoce STOMP. No hay migraciones ni cambios de contrato.
- `SpaceElementRealtimeContextRepository` resuelve `establishmentId` (sector → planta) y
  `aggregateVersion` (conteo de la bitácora) sin importar el módulo `spaces` ni tocar
  `OperationalSpaceElement`.
- Tests: `UpdateSpaceElementStateTest` (payload completo, sin evento en estado repetido o
  transición inválida, versiones 1 → 2) y
  `SpaceElementStateIntegrationTest#cada_cambio_escribe_el_evento_v1_en_el_outbox_con_version_creciente`
  contra PostgreSQL real. `test` + `integrationTest` completos en verde (42 suites).

### MAP-148

- No se reescribe el cliente: `RealtimeClient` de HUT-01 ya resuelve STOMP, JWT en `CONNECT`,
  backoff 250 ms → 30 s y kill switch. La HU pedía SockJS; se mantiene WebSocket nativo porque
  es lo que expone el servidor (ver spec §4).
- `dedupeRealtimeEvents` (lib) guarda la última `aggregateVersion` por elemento: cubre la
  entrega at-least-once y la doble sala establecimiento/sector que el contrato deja al cliente.
- `SpaceElementsRealtime` (capa `data`) cuenta vistas: conecta con la primera y desconecta con
  la última, diferido una microtarea para que un cambio de sector con `switchMap` no cierre y
  reabra el socket (y no compita con el `disconnect()` asíncrono del cliente).
- Tests: `dedupe.spec.ts` (3) y `space-elements-realtime.spec.ts` (3).

### MAP-149

- La sala se calcula con el `establishmentId` del `SpacesStore` o, al entrar por URL, del query
  param que ahora añade el enlace de `sector-list` (misma convención de la consola: el contexto
  viaja en la URL). No se envía tenant; el servidor autoriza la sala con el JWT (HUT-01) y aquí
  no se duplica esa lógica: solo se rechazan identificadores que no son UUID.
- En lugar de `switchMap`, la vista usa `effect` con `onCleanup`: cambiar de sector ejecuta la
  limpieza (suelta la sala) antes de abrir la nueva. La suscripción va en `untracked` porque el
  cliente lee su estado de conexión al suscribirse y el effect no debe depender de él.
- `applyRealtimeStateChange` actualiza el elemento de forma inmutable y no toca nada si el
  evento no cambia el estado o no es de un elemento cargado.
- Tests: `space-elements-live-store.spec.ts` (5).

### MAP-150

- La vista de HU-2.03 (tabla tipo / (x, y) / estado) conserva su modelo; solo cambia el estado
  del elemento al llegar un evento. No se añade edición ni drag & drop.
- Indicador `role="status"` «En vivo» / «Actualización periódica» (`store.liveStatus`): en vivo
  exige sala abierta **y** socket `connected`.
- Sondeo de respaldo cada `LIVE_FALLBACK_POLL_MS` (10 s) solo mientras `liveStatus` es
  `polling` (flag `realtime.websocket` apagada, caída o sin establecimiento); recarga silenciosa
  para no parpadear el «Cargando…».
- `data-testid="space-element-state"` + `data-state` por fila: es el punto de observación del
  E2E de latencia (MAP-151).
- Tests: `space-elements-live-store.spec.ts` (8, con temporizadores falsos); suite de consola
  completa en verde (60).
