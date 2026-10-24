# CU-10 — Tareas de ejecución

## Tareas (en orden)

### v1 — Completadas

1. [x] Añadir claves `adminDashboardHome` a `apps/console/src/app/core/strings.ts` (títulos, etiquetas de KPI, mensaje de error, reintento).
2. [x] Reescribir `apps/console/src/app/features/home/home.ts`: template con tarjetas KPI, distribución por tipo, accesos rápidos, estados loading/error; lógica con signals y `forkJoin`.
3. [x] Estilos con tokens de `libs/ui-kit/styles/_tokens.scss` (sin hardcodear colores ni px sueltos).
4. [x] Prueba unitaria Vitest: `home.spec.ts` que cubra CA-1, CA-2, CA-3, CA-4.
5. [x] `pnpm check` en verde (lint, typecheck, tests, build).

### v2 — Mejoras visuales dentro del contrato

6. [x] Añadir `percentByType` computed signal a `home.ts`: `countsByType[type] / Math.max(totalEstablishments(), 1) * 100`; redondear a entero.
7. [x] Añadir barra de progreso en cada fila `.item` de distribución: `div.progress-track > div.progress-bar` con `[style.width.%]="percentByType()[type]"`, `role="progressbar"`, `aria-valuenow`, `aria-valuemax="100"`.
8. [x] Añadir dots decorativos al `.hero-decor`: SVG `5×5` con `aria-hidden="true"` usando `<circle>` repetidos o `CSS radial-gradient` como `background-image` en un `div` adicional.
9. [x] Reemplazar texto de loading por 2 skeleton cards: `div.card.kpi.skeleton` en el estado `loading()` con `@keyframes shimmer` en estilos; añadir `@media (prefers-reduced-motion: reduce)` que desactiva la animación.
10. [x] Ajustar columna lateral en `.layout`: de `20rem` a `22rem`.
11. [x] Actualizar `apps/console/design/home-dashboard/design-components.md` con specs de barra de progreso, dots y skeleton.
12. [x] Nuevo test CA-6 en `home.spec.ts`: `percentByType()` correcto con 3 RESTAURANT + 1 HOTEL.
13. [x] `pnpm check` / `ng build console` en verde.

### v3 — Alineación a imagen objetivo y 4 KPIs funcionales

14. [x] Extraer y actualizar la especificación de diseño (`design.md`, `design-components.md`, `design-guidelines.md`) con la paleta Royal Blue (`#2563EB`) y Sidebar Dark (`#0B132B`).
15. [x] Actualizar tokens compartidos en `libs/ui-kit/styles/_tokens.scss` y `libs/ui-kit/DESIGN.md`.
16. [x] Aplicar variables de sidebar oscuro (`--mapit-sidebar-*`) en `apps/console/src/app/layout/sidebar/sidebar.scss`.
17. [x] Implementar 4 KPIs funcionales en `home.ts` con datos reales de la API (Total negocios, Tenants/Plantillas, Vertical líder con % predominante, y Cobertura/configuración activa).
18. [x] Añadir panel de Negocios recientes en `home.ts` consumiendo datos reales de `listEstablishments()`.
19. [x] Registrar todas las claves de texto en `apps/console/src/app/core/strings.ts` (cero texto hardcodeado).
20. [x] Ampliar `home.spec.ts` a 6 pruebas unitarias que validan la lógica de `leadingVertical`, `percentByType` y tolerancia a errores.
21. [x] Validaciones de calidad: `fe:lint` limpio (0 errores, 0 warnings), `fe:typecheck` limpio y build de consola exitoso.

### v4 — Métricas de reservas y pagos, y la pantalla en capas

22. [x] Contrato: añadir `GET /reservations` a `packages/api-contract/openapi.yaml` (`operationId: listReservations`, array plano de `Reservation`, techo documentado en la descripción). `pnpm api:lint` + `pnpm api:gen`.
23. [x] Backend: puerto `findAll(TenantId)` en `reservations-domain`, caso de uso `ListReservations` (`@Transactional(readOnly = true)`), adaptador JDBC con `tenant_id` explícito + `SET LOCAL` + `left join lateral` para `spaceElementIds`, y `GET /api/v1/reservations` en `ReservationController` (el POST conserva su URL). Regla de rol en `SecurityConfig`.
24. [x] Backend: test de integración `ReservationListingIntegrationTest` con la app como `mapit_app` (NOBYPASSRLS) que prueba que solo salen las reservas del tenant actual, el orden, el 401 y que la RLS está activa.
25. [x] Reestructurar `features/home/` en `ui/` + `model/` + `data/` sin cambiar un píxel: 1888 líneas en un archivo → shell (1023) + store (287) + data (53) + spec.
26. [x] Extraer `ui/kpi-card/` (se repite 5 veces) y `ui/growth-chart/` (se usa 2 veces, con la geometría como función pura testeable).
27. [x] Extraer `ui/distribution-panel/` y `ui/reservations-panel/`: necesario para que ningún componente pase el budget de estilos de 12 kB (el shell bajó de 16.78 kB a 10.17 kB). `angular.json` no se tocó.
28. [x] KPI de reservas con la regla de delta (semana anterior = 0 → "N nuevas esta semana", nunca un porcentaje inventado) y 2º gráfico de reservas (8 semanas desde `createdAt`).
29. [x] Bloque "Reservas y pagos": "Personas registradas" real; "Pagos QR", "Ingresos" y "Tasa de conversión" en "—" / "Sin datos" con la nota de CU-17 y la rama real detrás de la flag `payments.qr`.
30. [x] Quitar "Negocios recientes" del split (tercera copia de la misma lista) y poner su sitio el gráfico de reservas. Motivo documentado en `design-components.md`.
31. [x] Fila de KPIs de 5 sin huérfanas (5 → 3+2 → 2 → 1) y split con dos gráficos del mismo componente.
32. [x] Accesibilidad: cada gráfico lleva tabla visualmente oculta con el valor de cada semana (CA-10). Lo detectó `web-design-guidelines` al revisar el gráfico de reservas, que no tenía alternativa textual.
33. [x] Limpieza: ruta rota `/templates` → `/spaces/templates`; computed muerto `percentByType`; bloque muerto `STRINGS.home`; hex `#fee2e2` → token `--mapit-color-error-container`.
34. [x] `data-testid` en los anclas reales (KPIs, paneles, accesos rápidos) y renombrado `home-kpi-plantillas` → `home-kpi-tenant-plantillas` (ese slot muestra tenants o plantillas según el rol).
35. [x] `impeccable` (Operate) sobre la pantalla y `extract-design-system` contra los tokens: 34 tokens usados, 0 indefinidos, 0 hex. Preflight anti-genérico de `design-taste-frontend` corrido y reportado (sus 4 patrones son los que exige `DESIGN.md`; ninguno aplicado). `web-design-guidelines` de cierre.
36. [x] `pnpm check` en verde (lint, typecheck, tests, build) y `pnpm be:test` + `pnpm be:it` en verde.

### v5 y v6 — Se retiran la tabla y el panel de distribución

37. [x] Quitar el panel "Todos los negocios" (tabla): el conteo ya está en el KPI de total y el detalle en `/establishments`. Con ella sale `p-table` de PrimeNG y su dependencia (y con ellos el banner de licencia de PrimeUI); el bundle inicial baja de 863 kB a 690 kB.
38. [x] Quitar el panel "Distribución de negocios" (barras por vertical + donut "Salud del perfil"): el reparto por vertical ya está en el KPI "Vertical principal" y la completitud en el KPI "Perfiles completos". Con él sale el componente `mapit-distribution-panel`, los computeds `barMax`/`barWidths`/`barRows`/`coverageSummary` y sus strings.
39. [x] Solo se piden `/reservations` y `/people` a los roles que pueden leerlos (ADMIN, MANAGER, STAFF): pedírselas a un SUPER_ADMIN solo producía un 403 por petición.
40. [x] Corregida la concordancia: "1 nueva esta semana" (no "1 nuevas").

### v7 — Ocupación en vivo: salen tres KPIs, entra el estado de los elementos

41. [x] Contrato: `GET /element-states/summary` en `packages/api-contract/openapi.yaml` (`operationId: summarizeSpaceElementStates`, schema `ElementStateSummary` con `total` + `byState` de cinco claves obligatorias). `pnpm api:lint` + `pnpm api:gen` + `pnpm api:check`.
42. [x] Backend: puerto `countByState(TenantId)` en `operations-domain`, caso de uso `SummarizeSpaceElementStates` (`@Transactional(readOnly = true)`) y `SpaceElementStateSummaryResult` (rellena las cinco claves con 0, suma el total), adaptador JDBC con un solo `group by state` + `tenant_id` explícito + `SET LOCAL` + `deleted_at is null`, y `GET /api/v1/element-states/summary` en `SpaceElementStateController`. Sin migración, sin dependencia nueva.
43. [x] Backend: `SummarizeSpaceElementStatesTest` (unit) y `SpaceElementStateSummaryIntegrationTest` (Testcontainers con la RLS real: buckets, estado ausente como 0, aislamiento entre tenants, baja lógica excluida, 401 sin token). `pnpm be:fmt` / `be:lint` / `be:test` / `be:it` en verde.
44. [x] Store: señales del resumen, `% de ocupación` (`OCCUPIED / (total − OUT_OF_SERVICE) × 100`, `null` sin operativas), estado de la conexión realtime, suscripción STOMP por establecimiento, delta local con `previousState` y refresco debounced; y retirada de los miembros muertos de "Plantillas", "Perfiles completos" y "Vertical principal". El panel distingue "cargando" de "fallido" (`resumenCargando` / `resumenError`): sin eso, un resumen lento pintaba un error falso durante un instante.
45. [x] UI: KPI "% de ocupación" y panel "Ocupación en vivo" con las cinco filas en los tokens `--mapit-state-*`; fuera las tarjetas de "Plantillas", "Perfiles completos" y "Vertical principal" (se queda "Tenants registrados" para el SUPER_ADMIN). El panel es el **primer consumidor** de `--mapit-state-out-of-service` y dice siempre si los datos son en vivo o una instantánea.
46. [x] Docs: `apps/console/design/home-dashboard/design-components.md`, `apps/console/design/dashboard-patterns.md` (patrón 9, "panel de estado en vivo") y `libs/ui-kit/DESIGN.md` (los cinco tokens de estado y su uso compartido con el mapa).
47. [x] `pnpm check` en verde (formato, lint, tipos, tests, build, contrato API y backend con ArchUnit). Bundle inicial de la consola: 690,51 kB.
48. [x] **Autorización STOMP del SUPER_ADMIN**: el panel en vivo era imposible para el rol de plataforma — `canSubscribe` solo admitía `{ADMIN, MANAGER, STAFF}` y el SUPER_ADMIN ya leía los mismos datos por HTTP. Se amplía el conjunto de roles (sin tocar el aislamiento por tenant).
49. [x] **Hueco de HU-3.02 (MAP-146)**: el caso de uso del cambio de estado **no encolaba el evento** en el outbox (el publicador solo lo usaban los tests), así que el vivo no tenía nada que recibir. Se implementa la publicación dentro de la misma transacción, con la versión de agregado que significa algo.
50. [x] **Prueba en vivo real**: con el backend de dev y la consola levantados, un `PATCH` de estado (como ADMIN) mueve el panel **sin recargar** (Disponible 5→4, Ocupado 4→5) y el outbox registra el evento con su `previousState` y su `state`. El chip dice "En vivo" y el panel lo dice siempre con verdad.

## Notas de ejecución

1. strings.ts: añadido bloque `adminDashboardHome` con todas las claves de texto (cero hardcode en el componente).
2. home.ts: sustituido el placeholder de andamiaje por el dashboard real. Señales + forkJoin para cargar tenants (listTenants, paginado) y establecimientos (listEstablishments, array, conteo en cliente). Estilos solo con tokens de libs/ui-kit/styles/_tokens.scss. No se toca el shell ni el sidebar.
3. home.spec.ts: 2 pruebas (KPIs + distribución CA-1/CA-2, error y reintento CA-3).
4. Verificación: pnpm fe:typecheck verde, eslint --max-warnings=0 limpio, prettier limpio, 2 tests Vitest verdes.
5. v4 — el contrato manda y no hay codegen de Java: `openapi.yaml` → `pnpm api:gen` → implementación. El comentario del contrato que anuncia "interfaces Java que los controllers deben implementar" no está cableado en el build: el endpoint de Java se implementó contra el mismo modelo revisado a mano, y el contrato sigue siendo la fuente de verdad para el cliente TS.
6. v4 — `SET LOCAL app.tenant_id` es de ámbito transaccional. Sin `@Transactional` la RLS cierra en falso y el listado de reservas salía **vacío y sin error**: el peor fallo posible en un panel. El test de integración, que conecta como `mapit_app` (NOBYPASSRLS, como producción), es lo que lo detecta.
7. v4 — `GET /people` exige ADMIN/MANAGER/STAFF (CU-11). Un SUPER_ADMIN recibe 403 y el slot "Personas registradas" degrada a "Sin datos" sin romper el panel. No se aflojó la autorización: es una decisión de seguridad, no del panel.
8. v4 — el a11y del gráfico nuevo: el SVG con `aria-label` no es la única vía de acceso al dato. Cada serie lleva ahora una tabla visualmente oculta con el valor de cada semana, como exige `design-guidelines.md`.
9. v4 — el budget de estilos (12 kB por componente) estaba roto desde el rediseño en curso, no desde este trabajo: el shell llegó a 16.78 kB. Extraer componentes lo resolvió sin tocar `angular.json` (shell: 10.17 kB).
10. v7 — el endpoint de la v7 no es un "métricas" genérico: cuenta `space_element` vivos por estado en una sola consulta. El total es la suma de los cinco buckets, no una segunda consulta. Las cinco claves están siempre presentes porque el cliente no debe tener que distinguir "0 elementos" de "estado ausente".
11. v7 — la primera suscripción STOMP del frontend. La librería, el broker y el evento `space-element.state.changed.v1` ya existían y estaban testeados, pero ninguna app los consumía: el mapa de public-web es un mock. El panel es el primer consumidor real, y por eso su ciclo de vida (suscribir, re-suscribir si cambia la lista de establecimientos, desuscribir al destruir) va cubierto por tests con un cliente falso, sin abrir un socket real.
12. v7 — el snapshot manda, el evento es el aviso. El delta en local (restar el estado anterior, sumar el nuevo) hace el panel inmediato; un refresco debounced a ≈1 s reconcilia la deriva (un elemento creado después del snapshot no estaba en el resumen). Si el volumen de eventos lo pide, el snapshot pasa a ser la fuente y el evento solo el aviso.
13. v7 — vocabulario: el panel dice "elementos", no "mesas". `space_element.type` incluye `TABLE | BAR | SECTOR_ZONE | STAGE | SEAT | ROOM | DECOR`, y las reglas de qué tipos son reservables en cada vertical son las CU-19…22, sin implementar. Decir "mesas disponibles: 18" contando decorados y escenarios sería mentir.
14. v7 — dos ceros inventados que también salieron: el SUPER_ADMIN no puede leer las reservas ni las personas (403, no se piden), y el dashboard pintaba "Reservas 0" y "Personas registradas 0" como si fueran mediciones. Ahora ambos slots dicen "—" y "Sin datos", que es el patrón que ya usaban los slots de pagos (`design-guidelines.md` → «Don't: Mostrar "Sin datos" como si fuera un cero»). Un 0 que no se midió es peor que un hueco.
15. v7 — el vivo no era un problema de frontend: al probarlo de verdad aparecieron **tres huecos de backend**. (a) `canSubscribe` solo admitía los roles operativos, así que el SUPER_ADMIN no podía entrar en ninguna sala aunque leyera los mismos datos por HTTP. (b) El caso de uso del cambio de estado no encolaba nada en el outbox: el publicador existía y funcionaba, pero solo lo usaban los tests, y la tabla quedaba vacía. (c) El panel no distinguía "cargando" de "fallido" y pintaba un error falso durante un instante. Los tres están corregidos y con tests; el (a) y el (b) son de CU-09/HU-3.02, que los tenía pendientes.
16. v7 — la prueba en vivo, tal cual se puede repetir: backend de dev + consola, login como SUPER_ADMIN (la vista), `PATCH` del estado de un elemento como ADMIN del tenant (el SUPER_ADMIN no puede cambiar estados: es una regla de seguridad que no se toca), y la lectura de los contadores del panel antes y después. Con eso el panel pasó de "Disponible 5 / Ocupado 4" a "Disponible 4 / Ocupado 5" sin recargar la página.

Decisiones: se descartaron "usuarios registrados" (no existe listUsers) y los gráficos de series temporales dedicadas. El conteo de establishments se hace en cliente sobre el array; techo conocido: paginar si supera cientos de filas. Desde la v4 también son techo conocido `listReservations()` y `searchPeople()`: arrays planos sin paginar, pensados para agregados. Desde la v7 el tiempo real entra solo para la ocupación (el resto del dashboard sigue por HTTP) y el techo son las N suscripciones STOMP, una por establecimiento del tenant.
