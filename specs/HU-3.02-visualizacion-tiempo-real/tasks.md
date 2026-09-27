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
