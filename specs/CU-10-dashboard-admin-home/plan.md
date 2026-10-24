# CU-10 — Plan de implementación

## 1. Qué se toca

**v7 (estado actual)** — lo que añade la v7 (ocupación en vivo):

- `packages/api-contract/openapi.yaml` — nuevo `GET /element-states/summary` (`operationId: summarizeSpaceElementStates`, schema `ElementStateSummary` con `total` + `byState` de cinco claves obligatorias).
- `apps/backend/modules/operations/operations-domain/.../state/SpaceElementStateSummaryRepository.java` — puerto `Map<SpaceElementState, Long> countByState(TenantId)`.
- `apps/backend/modules/operations/operations-application/.../state/` — `SummarizeSpaceElementStates` (caso de uso `@Transactional(readOnly = true)`) y `SpaceElementStateSummaryResult` (rellena las cinco claves con 0 y suma el total).
- `apps/backend/modules/operations/operations-infrastructure/.../state/JdbcSpaceElementStateSummaryRepository.java` — un solo `group by state` con `tenant_id` explícito + `SET LOCAL` + `deleted_at is null`.
- `apps/backend/modules/operations/operations-infrastructure/.../state/SpaceElementStateController.java` — `GET /api/v1/element-states/summary`.
- `apps/console/src/app/features/home/model/home-store.ts` — señales del resumen, % de ocupación, suscripción STOMP por establecimiento y refresco debounced.
- `apps/console/src/app/features/home/data/home-data.ts` — llamada a `operationsService.summarizeSpaceElementStates()`.
- `apps/console/src/app/features/home/ui/` — nuevo panel "Ocupación en vivo" y KPI "% de ocupación"; salen las tarjetas de "Plantillas", "Perfiles completos" y "Vertical principal".
- `apps/console/src/app/core/strings.ts` — claves del panel y del KPI.

**v4 (base):**

- `packages/api-contract/openapi.yaml` — nuevo `GET /reservations` (`operationId: listReservations`, array plano de `Reservation`).
- `apps/backend/modules/reservations/reservations-domain/.../ReservationRepository.java` — puerto `List<Reservation> findAll(TenantId)`.
- `apps/backend/modules/reservations/reservations-application/.../ListReservations.java` — caso de uso `@Transactional(readOnly = true)`.
- `apps/backend/modules/reservations/reservations-infrastructure/.../JdbcReservationRepository.java` — SQL con `tenant_id` explícito + `SET LOCAL` + `left join lateral` para `spaceElementIds`.
- `apps/backend/modules/reservations/reservations-infrastructure/.../ReservationController.java` — `GET /api/v1/reservations` (el POST conserva su URL).
- `apps/backend/bootstrap/.../SecurityConfig.java` — el GET exige ADMIN/MANAGER/STAFF, igual que el POST.
- `apps/console/src/app/features/home/ui/` — shell + 4 componentes (`kpi-card`, `growth-chart`, `distribution-panel`, `reservations-panel`).
- `apps/console/src/app/features/home/model/home-store.ts` — ViewModel con signals y computeds.
- `apps/console/src/app/features/home/data/home-data.ts` — llamadas api-client, cada una con `catchError(() => of(null))`.
- `apps/console/src/app/core/strings.ts` — claves nuevas (`chartData*`, `kpiReservations*`, `reservationsGrowth*`, `payments*`).
- `apps/console/design/home-dashboard/design-components.md` + `design-guidelines.md` — specs de los bloques nuevos y de la tabla accesible del gráfico.
- **Backend: sí cambia** (la v1-v3 no cambiaban nada). Solo lectura: sin migración, sin tabla, sin dependencia nueva.

## 2. Cómo (patrones)

| Patrón                                           | Dónde se aplica                          | Por qué aquí                                                                                                                   | Alternativa descartada                                                                  |
| ------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| MVVM en tres capas (`ui`/`model`/`data`)         | `features/home/`                         | Regla dura de la zona (`apps/console/AGENTS.md`); el archivo plano de 1888 líneas no la cumplía                                | Un solo archivo — la v1-v3 lo hicieron, y la zona exige las tres capas                  |
| Signal store + `computed` puro                   | `model/home-store.ts`                    | Testeable sin renderizar; la zona prohíbe `BehaviorSubject`                                                                    | RxJS en el componente — no reactivo en zoneless                                         |
| `forkJoin` + `catchError` por fuente             | `data/home-data.ts`                      | Un 403 (p. ej. `/people` para SUPER_ADMIN) no puede tumbar el panel                                                            | Un único `catchError` global — pierde la degradación por bloque                         |
| Agregación en cliente sobre arrays planos        | `model/home-store.ts`                    | Es el patrón ya probado del v3 con `listEstablishments`; no requiere endpoint de métricas                                      | Endpoint de métricas agregado — más backend del que el caso necesita                    |
| SVG inline para los gráficos                     | `ui/growth-chart/`                       | `design-components.md` lo fija: "Sin librerías de charts"; el repo ya resolvía el chart a mano                                 | Chart.js / ngx-charts — dependencia nueva para lo que ya hacía ~80 líneas               |
| Tabla visualmente oculta junto al SVG            | `ui/growth-chart/`                       | `design-guidelines.md`: el SVG no puede ser la única vía de acceso al dato                                                     | Solo `aria-label` con los valores — announces como un bloque, no navegable              |
| `@Transactional(readOnly = true)` en la lectura  | `ListReservations`                       | `SET LOCAL app.tenant_id` es de ámbito transaccional: sin transacción la RLS cierra en falso y la lista sale vacía en silencio | Lectura sin transacción — lista vacía sin error, el peor fallo posible                  |
| `left join lateral` + `array_agg`                | `JdbcReservationRepository`              | Los `spaceElementIds` vienen en la misma consulta; una consulta por reserva sería N+1                                          | Segunda consulta por reserva — N+1 sobre el array que devuelve el panel                 |
| Token `--mapit-color-error-container`            | `libs/ui-kit/styles/_tokens.scss`        | El valor ya estaba documentado en `libs/ui-kit/DESIGN.md`; faltaba el token y se usaba un hex suelto                           | Dejar el hex — prohibido por `design-guidelines.md`                                     |
| Endpoint de agregado con un solo `group by`      | `JdbcSpaceElementStateSummaryRepository` | Los cinco buckets y el total salen de la misma consulta; el total es la suma de los buckets, no una segunda consulta           | Una consulta por estado (5 viajes) o dos consultas (buckets + total)                    |
| Resultado con las cinco claves siempre presentes | `SpaceElementStateSummaryResult`         | El cliente no tiene que tratar claves ausentes: un estado sin elementos es 0, no `undefined`                                   | Mapear solo los estados presentes — el cliente tendría que fillar los huecos            |
| Delta en local sobre el evento STOMP             | `model/home-store.ts`                    | El evento trae `previousState` y `state`: restar uno y sumar otro actualiza el panel sin volver a pedir nada                   | Recargar el resumen en cada evento — 1 petición por cambio de estado                    |
| Refresco debounced para reconciliar la deriva    | `model/home-store.ts`                    | Un elemento creado después del snapshot no estaba en el resumen; un refresco a ≈1 s corrige la cuenta sin castigar cada evento | Confiar solo en el delta — el conteo puede quedar desfasado sin avisar                  |
| Suscripción por establecimiento (N topics)       | `model/home-store.ts`                    | Los topics del backend son por establecimiento; el panel ya conoce la lista de establecimientos del tenant                     | Un topic nuevo por tenant en el backend — trabajo extra para un caso que no lo pide aún |
| `computed` para el % de ocupación                | `model/home-store.ts`                    | El porcentaje se deriva de dos señales; no es estado, no necesita recomputarse al vuelo                                        | Recalcularlo en el template en cada ciclo de detección                                  |

## 3. Contrato

- `tenants.service.listTenants({size, status})` → `TenantPage` con `totalElements`.
- `establishments.service.listEstablishments()` → `Array<Establishment>` (conteo y distribución por `type` en cliente).
- `reservations.service.listReservations()` → `Array<Reservation>` (nuevo en v4: total, delta semanal y serie de 8 semanas en cliente).
- `people.service.searchPeople()` → `Array<Person>` (total y delta semanal en cliente).
- `openapi.yaml` es la fuente de verdad: se editó primero y `pnpm api:gen` regeneró el cliente (`pnpm api:check` en CI verifica que no diverjan).
- **v7:** `operations.service.summarizeSpaceElementStates()` → `Observable<ElementStateSummary>` con `total: number` y `byState: ElementStateSummaryByState` (las cinco claves numéricas, siempre presentes).
- **No hay codegen de interfaces Java**: el comentario del contrato que lo anuncia no está cableado en el build. El endpoint de Java se implementó contra el mismo modelo, revisado a mano.

## 4. Tests

- `home.spec.ts` — 19 tests: los del v1-v3 (retargetizados al store) + los de la v4 (serie semanal de reservas y personas, delta contra la semana anterior real, el caso "sin semana anterior → N nuevas esta semana" sin `+100 %` inventado, 0 % real ≠ "Sin datos", estado "—" de los slots sin fuente, la nota con la flag apagada y encendida, aislamiento de fallos de `/reservations` y `/people`, y la geometría del gráfico).
- `ReservationControllerTest` (backend) — el GET devuelve la lista; sin tenant se rechaza antes de tocar el repositorio.
- `ReservationListingIntegrationTest` (backend, Testcontainers) — con la app conectando como `mapit_app` (NOBYPASSRLS, como producción): solo aparecen las reservas del tenant actual, ordenadas de más reciente a más antigua, 401 sin token, y una aserción que prueba que la RLS está activa (para que la suite no pueda quedar en verde por falso).
- `ReservationPersistenceIsolationTest` (preexistente) — cubre el aislamiento de la tabla `reservation`; no se duplica.
- **v7 — `SummarizeSpaceElementStatesTest`** (backend, unit): resuelve el tenant y delega; el resultado trae las cinco claves con 0 cuando faltan y el total es la suma; sin tenant se rechaza (falla en cerrado).
- **v7 — `SpaceElementStateSummaryIntegrationTest`** (backend, Testcontainers, app como `mapit_app` con la RLS real): cada estado cae en su bucket, un estado ausente sale como 0, los elementos de otro tenant **no** aparecen (en los dos sentidos), los dados de baja no se cuentan y sin token hay 401.
- **v7 — `home.spec.ts`** (frontend): el resumen carga y `conteoPorEstado` trae las cinco claves; el % es `OCCUPIED / operativas × 100` y `null` con 0 operativas; un evento con `previousState` mueve los conteos y uno sin `previousState` dispara el refresco; el panel aísla su fallo.
