# Evidencia de latencia — HU-3.02 (MAP-147)

**Resultado: cumple.** p95 = **287 ms** sobre 150 muestras, umbral 2000 ms.

## 1. Métrica

Latencia de propagación extremo a extremo de un cambio de estado de `SpaceElement`:

| Punto | Dónde                                                                             | Cómo                                     |
| ----- | --------------------------------------------------------------------------------- | ---------------------------------------- |
| `t0`  | Navegador, justo antes de enviar `PATCH /sectors/{s}/elements/{e}/state`          | `performance.now()`                      |
| `t1`  | Navegador, cuando la celda del elemento en la vista muestra el nuevo `data-state` | `MutationObserver` + `performance.now()` |

Latencia = `t1 − t0`. Ambos puntos usan el mismo reloj, así que no hay desfase entre máquinas.
El `PATCH` se envía con `fetch` desde la página pero **fuera de la app**: la vista no sabe que
hubo un cambio y solo se entera por el WebSocket.

El intervalo incluye todo el camino real: HTTP → caso de uso (estado + auditoría + outbox en una
transacción) → dispatcher del outbox → simple broker STOMP → `RealtimeClient` → deduplicación →
`SpacesStore` → render de Angular.

**Criterio de cumplimiento:** todas las muestras llegan y **p95 < 2000 ms**. Se usa p95 y no la
media para que unas pocas muestras lentas no queden escondidas; se reportan también p50, p99 y
máximo.

## 2. Condiciones de prueba (reproducibles)

| Parámetro             | Valor                                                                |
| --------------------- | -------------------------------------------------------------------- |
| Fecha                 | 2026-09-27                                                           |
| Máquina               | Portátil, AMD Ryzen 7 5825U, 15 GB RAM, Windows 11 Home              |
| Stack                 | Todo local: backend `bootRun`, consola `ng serve` (:4200), Docker    |
| Base de datos         | PostgreSQL 17.11 (contenedor `mapit-postgres`), BD limpia            |
| Navegador             | Chromium headless de Playwright 1.62.1, proyecto `console`           |
| Dispatcher del outbox | `mapit.realtime.outbox.poll-interval-ms = 250` (valor por defecto)   |
| Flag                  | `realtime.websocket` activa (el test exige el indicador «En vivo»)   |
| Carga                 | Un cliente, un elemento, cambios secuenciales `AVAILABLE ↔ OCCUPIED` |

Comando:

```bash
pnpm dev                                    # stack completo
cd apps/e2e
E2E_LATENCY_SAMPLES=50 npx playwright test tests/console/realtime-latency.spec.ts --project=console
```

El test adjunta `latencia-hu-3.02.json` (muestras crudas y percentiles) al reporte de Playwright.

## 3. Resultados

| Corrida   | Muestras | p50 (ms) | p95 (ms) | Máx. (ms) | Mín. (ms) | Media (ms) |
| --------- | -------- | -------- | -------- | --------- | --------- | ---------- |
| 1         | 50       | 272      | 294      | 308       | 256       | 274        |
| 2         | 50       | 275      | 286      | 302       | 170       | 275        |
| 3         | 50       | 275      | 288      | 296       | 96        | 273        |
| **Total** | **150**  | **274**  | **287**  | **308**   | 96        | 274        |

p99 del total: 302 ms. Todas las muestras llegaron (150/150).

### Lectura

- La latencia está dominada por el intervalo de sondeo del dispatcher del outbox (250 ms): el
  evento espera, en el peor caso, un ciclo completo antes de salir al broker. El resto del camino
  (HTTP, transacción, STOMP, render) suma unos 20–50 ms.
- Las muestras mínimas (96 ms, 170 ms) son el primer cambio de cada corrida, cuando el PATCH cae
  justo antes de un ciclo del dispatcher.
- Margen frente al umbral: p95 de 287 ms es ~7 veces menor que 2000 ms.

## 4. Control negativo: el test falla cuando se incumple

Para comprobar que el test no da falsos positivos, se levantó el backend con el dispatcher
ralentizado (`REALTIME_OUTBOX_POLL_MS=3000`) y se ejecutó con 20 muestras:

```text
p50 3032 ms · p95 3045 ms · máx. 3051 ms
Error: p95 3045 ms ≥ 2000 ms   → 1 failed
```

El test detecta el incumplimiento y falla, como se espera.

## 5. Límites de la evidencia

- Un solo cliente y un solo nodo backend (simple broker en memoria, como fija HUT-01). No mide
  concurrencia de muchos clientes ni despliegue multi-instancia.
- Todo en la misma máquina: no incluye latencia de red real. En producción se suma el RTT del
  cliente al servidor.
