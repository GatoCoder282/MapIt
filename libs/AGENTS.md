# Librerías compartidas — contexto para agentes

## Dónde estás

Código Angular compartido por `console` y `public-web`. Si algo lo necesitan las dos
apps, vive aquí. Si solo lo necesita una, va en su carpeta `features/`.

| Librería        | Qué es                                        | Regla propia                                                        |
| --------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| `ui-kit`        | design system: tokens y componentes base      | **puramente presentacional**: no conoce el api-client ni el dominio |
| `api-client`    | cliente generado del contrato + interceptores | `src/lib/generated/` **no se edita**                                |
| `auth`          | JWT, guards, sesión (CU-23, CU-24)            | solo la usa `console`                                               |
| `feature-flags` | toggles vía unleash-proxy                     | claves tipadas: una errata no compila                               |
| `realtime`      | WebSocket/STOMP (CU-09)                       | debe respetar el kill switch `realtime.websocket`                   |
| `map-engine`    | **puerto** del motor de mapa + adaptadores    | ver abajo                                                           |

## map-engine: la decisión pendiente

El motor de renderizado **no está decidido** (Konva propio vs. un SDK tipo Seats.io —
ADR-0006). Por eso:

- Las features programan contra `MapEnginePort`, nunca contra Konva.
- Hay una regla de ESLint que impide importar `konva` fuera de su adaptador.
- El modelo `MapLayout` es **nuestro**, no el de ningún proveedor. Si se adopta un SDK,
  se escribe un mapper en su adaptador y ni el backend, ni la BD, ni el contrato cambian.
- Si se evalúa un SDK externo: verificar que permita **persistir el layout en nuestra BD**.
  Algunos proveedores retienen los mapas en su nube, lo que incumpliría CU-08/RF05
  ("el mapa se persiste como estructura de datos, no como imagen").

## Reglas duras

1. **`ui-kit` no importa `api-client`.** Recibe datos por inputs, emite por outputs.
2. **Las libs no importan de `apps/`.** La dependencia va en un solo sentido.
3. Toda lib exporta su API pública por `src/index.ts`. Nada de imports profundos.
4. Una lib no debe conocer a otra salvo que sea evidente y esté documentado aquí.
