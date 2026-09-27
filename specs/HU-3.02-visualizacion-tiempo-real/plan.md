# Plan — HU-3.02 Visualización en Tiempo Real

## 1. Arquitectura

La historia une dos piezas existentes sin crear tablas ni endpoints:

```text
PATCH estado (HU-3.01)
  └─ UpdateSpaceElementState  ──publish──▶ RealtimeEventPublisher (shared-kernel, HUT-01)
                                              └─ JdbcRealtimeEventPublisher → realtime_event_outbox
RealtimeOutboxDispatcher (HUT-01, cada 250 ms) → simple broker → /topic/establishments/{e}/sectors/{s}
  └─ RealtimeClient (libs/realtime) → SpaceElementsRealtime (console, capa data)
        └─ SpacesStore.applyRealtimeStateChange → SpaceElementListComponent (solo lectura)
```

### Backend — `operations` (MAP-146)

- `UpdateSpaceElementState` recibe además `RealtimeEventPublisher` y un puerto nuevo
  `SpaceElementRealtimeContextRepository` (en `operations-domain`), y publica tras la auditoría,
  dentro de la misma `@Transactional`.
- El puerto resuelve lo que el evento necesita y el elemento operativo no tiene:
  - `establishmentId`: `sector → floor → establishment`, filtrando `tenant_id`.
  - `aggregateVersion`: número de cambios auditados del elemento (tabla de HU-3.01). Es
    monotónico porque la auditoría es append-only y el `UPDATE` previo bloquea la fila hasta el
    commit, así que dos cambios concurrentes del mismo elemento se serializan.
- Adaptador JDBC `JdbcSpaceElementRealtimeContextRepository` en `operations-infrastructure`,
  con `SET LOCAL app.tenant_id` como el resto de adaptadores del módulo.
- No se importa `spaces`: la consulta es SQL propio del módulo, igual que HU-3.01.

### Frontend (MAP-148 … MAP-150)

- `libs/realtime` ya tiene transporte, reconexión y salas. Se añade la **deduplicación**
  por `eventId` / `aggregateVersion` que el contrato asigna al consumidor, como operador puro
  reutilizable (`dedupeRealtimeEvents`).
- `apps/console/.../spaces/data/space-elements-realtime.ts`: servicio de la capa de datos que
  - abre la conexión (`connect`) mientras haya una vista suscrita y la cierra con la última;
  - expone `sectorEvents(establishmentId, sectorId)` como `Observable` ya deduplicado;
  - expone `connectionState` para que la vista muestre "En vivo" / "Sin conexión".
- `SpacesStore`:
  - `watchSector(sectorId)`: calcula la sala con el `establishmentId` del contexto
    seleccionado y usa `switchMap`, de modo que cambiar de sector cancela la sala anterior;
  - `applyRealtimeStateChange(event)`: actualiza de forma inmutable el elemento en
    `elementsBySectorState` si `aggregateVersion` es mayor que la última aplicada;
  - sondeo HTTP cada 10 s mientras la conexión no está `connected` (kill switch / caída).
- El `establishmentId` se toma del `SpacesStore` y, al entrar por URL directa, del query param
  `establishmentId` que añade el enlace desde la lista de sectores. Sin establecimiento
  conocido, no se suscribe y queda el sondeo.

### E2E y medición (MAP-151, MAP-147)

- `apps/e2e/tests/console/realtime-latency.spec.ts`: siembra tenant, ADMIN, establecimiento,
  planta, sector y elemento por la API real (patrón de `activation.spec.ts`), abre la vista y
  alterna el estado por `PATCH` N veces.
- Punto de inicio `t0`: instante justo antes de enviar el `PATCH` (reloj del navegador, vía
  `page.evaluate` → `fetch`). Punto de fin `t1`: un `MutationObserver` en la página registra el
  instante en que cambia `data-state` del elemento. Mismo reloj en ambos puntos; sin
  `waitForTimeout`.
- Se calcula p50/p95/máx., se adjunta el JSON al reporte de Playwright y el test falla si
  `p95 ≥ 2000 ms` o alguna muestra no llega.

## 2. Patrones de diseño aplicados

| Patrón               | Aplicación                                                            | Por qué aquí                                                                       | Alternativa descartada                                                           |
| -------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Observer / Pub-Sub   | El caso de uso publica por `RealtimeEventPublisher`; la vista observa | Es el patrón del catálogo para CU-09: el caso de uso no conoce STOMP ni al cliente | Llamar a `SimpMessagingTemplate` desde el caso de uso acoplaría dominio y broker |
| Transactional Outbox | El evento se escribe en la misma transacción que el cambio (HUT-01)   | Garantiza que no hay evento sin cambio ni cambio sin evento                        | Publicar tras el commit con un listener pierde eventos si el proceso cae         |
| Ports & Adapters     | `SpaceElementRealtimeContextRepository` + adaptador JDBC              | El caso de uso obtiene establecimiento y versión sin importar `spaces`             | Añadir campos a `OperationalSpaceElement` cambiaría el modelo de HU-3.01         |

No se añade ningún otro patrón: el frontend es un store de signals con un operador RxJS.

## 3. Contrato

Sin cambios en OpenAPI ni en el envelope v1 (`docs/api/realtime.md`). Solo se documenta en ese
archivo que HU-3.02 es el productor del evento y el consumidor de la sala de sector.

## 4. Persistencia

Sin migraciones. Se leen `sector`, `floor` y la auditoría de HU-3.01 con RLS y filtro por
`tenant_id`; se escribe en `realtime_event_outbox` mediante el adaptador de HUT-01.

## 5. Entregas por MAP

| MAP     | Rama                                                     | Entrega                                                |
| ------- | -------------------------------------------------------- | ------------------------------------------------------ |
| MAP-146 | `feat/Trigramador69/MAP-146-emitir-evento-cambio-estado` | Publicación del evento en el caso de uso + tests       |
| MAP-148 | `feat/Trigramador69/MAP-148-cliente-stomp`               | Servicio de datos, ciclo de conexión, deduplicación    |
| MAP-149 | `feat/Trigramador69/MAP-149-suscripcion-rooms`           | Sala por contexto, limpieza al cambiar de sector       |
| MAP-150 | `feat/Trigramador69/MAP-150-vista-posiciones-reactiva`   | Store reactivo, indicador en vivo y sondeo de respaldo |
| MAP-151 | `feat/Trigramador69/MAP-151-e2e-latencia`                | E2E de latencia contra el stack real                   |
| MAP-147 | `feat/Trigramador69/MAP-147-medicion-latencia`           | Ejecución, percentiles y evidencia en `latency.md`     |
