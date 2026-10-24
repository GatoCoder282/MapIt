# CU-10 — Dashboard de administrador en home

## 1. Contexto

La pantalla `home` de `apps/console/src/app/features/home/home.ts` es un placeholder de andamiaje: solo verifica que los feature toggles funcionan y muestra datos de sesión. No es un dashboard real.

CU-10 sustituye ese placeholder por el dashboard del administrador de plataforma: métricas de tenants (totales, activos, suspendidos) y de establecimientos (conteo y distribución por tipo de negocio), más accesos rápidos a las secciones de administración.

No se crea una carpeta nueva de layout: la pantalla vive dentro del shell existente (`apps/console/src/app/layout/admin-shell.*`) y sigue el patrón ya probado de `apps/console/src/app/features/administration/dashboard/ui/dashboard.ts` (signal store + cliente de API generado directamente, sin importar de otras features).

### v2 — Mejoras visuales dentro del contrato

La revisión del diseño de referencia identificó tres mejoras que **sí tienen soporte en el contrato existente** y que elevan la calidad visual sin inventar datos ni añadir endpoints:

| Mejora                                      | Fuente de datos                                      | Tipo de cambio                                      |
| ------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| Barras de progreso en distribución por tipo | `countsByType / totalEstablishments` (ya en cliente) | Nuevo `computed` + markup + CSS                     |
| Dots decorativos en el hero                 | Sin datos — solo CSS                                 | CSS puro, `aria-hidden`                             |
| Skeleton de KPIs durante la carga           | `loading` signal (ya existe)                         | CSS `@keyframes shimmer` + `prefers-reduced-motion` |

Elementos descartados en v2: usuarios registrados, ubicaciones activas, reportes generados, mapa de distribución geográfica, establecimientos destacados con rating. Todos sin contrato; ver §7. (El gráfico de crecimiento y la actividad reciente, también descartados en v2, se añadieron después en v3 con datos derivados de `createdAt`.)

### v4 — Métricas de reservas y pagos

El administrador necesita ver la actividad real de su negocio (reservas) y, en cuanto entre el pago por QR (CU-17), el dinero que mueve. La v4 añade:

| Métrica              | Fuente de datos                                 | Tipo de cambio                         |
| -------------------- | ----------------------------------------------- | -------------------------------------- |
| KPI de reservas      | `reservations.service.listReservations` (nuevo) | Endpoint nuevo + `computed` en cliente |
| Gráfico de reservas  | `listReservations` + `createdAt`                | Segundo gráfico sobre el mismo patrón  |
| Personas registradas | `people.service.searchPeople` (ya existía)      | `computed` en cliente                  |
| Bloque de pagos QR   | Sin fuente todavía                              | Estado "Sin datos" + nota CU-17        |

El v4 también **reordena el panel principal**: el mini-listado "Negocios recientes" sale del split porque sus mismos datos ya están en el feed "Actividad reciente" del aside: era la misma lista mostrada por segunda vez. Su lugar lo ocupa el gráfico de reservas.

### v5 — La tabla de negocios sale del dashboard

El panel "Todos los negocios" se retira del resumen: el conteo ya está en el KPI de total, el reparto por vertical en el panel de distribución y el detalle en `/establishments`. Con él sale `p-table` de PrimeNG y su dependencia, que se quedan sin uso (y con ellos la licencia de PrimeUI y su banner). Los gráficos ECharts del v4 se mantienen: son la parte del dashboard que aporta datos nuevos.

El v4 reorganiza además el código: la pantalla deja de ser un archivo plano de 1888 líneas y pasa a las tres capas de la zona (`ui/` + `model/` + `data/`), con la tarjeta KPI, el gráfico y el panel de reservas como componentes con su propio estilo.

### v6 — El panel de distribución sale del dashboard

El panel "Distribución de negocios" (barras por vertical + donut de "Salud del perfil") se retira: el reparto por vertical ya está en el KPI "Vertical principal" (que lo nombra y lo pone en porcentaje) y la completitud del perfil en el KPI "Perfiles completos". Era el mismo desglose repetido en tres sitios. Con él sale el componente `mapit-distribution-panel` y el `conic-gradient` del donut.

El dashboard queda: hero → 5 KPIs → split con los dos gráficos de crecimiento → panel "Reservas y pagos".

### v7 — El panel de ocupación en vivo

El dashboard hablaba de tenants, negocios y reservas, pero no de **la mesa**: el producto es gestión de mesas y el panel no decía nada de cómo va el negocio ahora mismo. La v7 sustituye tres KPIs que no tenían sentido por el dato que faltaba.

**Salen** (no eran métricas de negocio):

| KPI que sale         | Por qué sale                                                                                                                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Plantillas" (ADMIN) | Las plantillas son un recurso de configuración, no una métrica. El slot además cambia de significado según el rol (plantillas vs tenants), así que la fila era ilegible. "Tenants registrados" **se queda** para el SUPER_ADMIN, donde sí significa algo. |
| "Perfiles completos" | Es calidad de datos (% de negocios con dirección) y con un solo negocio da 100 % siempre. Encaja en un aviso por negocio, no en la banda de métricas.                                                                                                     |
| "Vertical principal" | Con pocos negocios es "100 % del total": no dice nada. Ya era el resumen del panel de distribución que salió en la v6.                                                                                                                                    |

**Entra**:

| Métrica                   | Fuente de datos                                                               | Tipo de cambio                       |
| ------------------------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| KPI "% de ocupación"      | `GET /element-states/summary` (nuevo) + el bucket `OCCUPIED`                  | Endpoint nuevo + KPI                 |
| Panel "Ocupación en vivo" | `GET /element-states/summary` + evento STOMP `space-element.state.changed.v1` | Endpoint nuevo + panel + suscripción |

El backend sí cambia en la v7: un endpoint **de solo lectura y sin migración** (`GET /api/v1/element-states/summary`) que cuenta los `space_element` vivos del tenant agrupados por estado. Antes solo había formas de leer el estado por sector (`listSpaceElementsBySector`) o por piso (`getFloorLayout`): un agregado costaba N peticiones.

La v7 introduce además el **primer consumo de STOMP del frontend**: la consola ya estaba conectada (`provideRealtime` con el kill switch `realtime.websocket`), pero ninguna app suscribía a un topic. Los topics son **por establecimiento** (`/topic/establishments/{id}`), no hay topic por tenant, así que el panel se suscribe a uno por establecimiento del tenant.

El vocabulario del panel es **"elementos"**, no "mesas": `space_element.type` incluye `TABLE | BAR | SECTOR_ZONE | STAGE | SEAT | ROOM | DECOR`, y qué tipos son reservables según la vertical son las reglas de **CU-19…22, sin implementar**. Un tenant de eventos tiene escenarios y butacas, no mesas.

## 2. Actores

| Rol           | Permiso                                            |
| ------------- | -------------------------------------------------- |
| Super Admin   | Ver dashboard de toda la plataforma                |
| Administrador | Ver dashboard de los establecimientos de su tenant |

## 3. Flujo principal

1. El administrador abre la pantalla de inicio/home de la consola.
2. La vista carga, en paralelo: conteo de tenants (total / activos / suspendidos) y listado de establecimientos.
3. Muestra: tarjetas KPI, distribución de establecimientos por tipo (Restaurante, Discoteca, Salón de eventos, Hotel) y accesos rápidos (Tenants, Configuración, Perfil).
4. Ante error de API, muestra mensaje de error con botón de reintento.

## 4. Decisiones de alcance

- **Solo métricas que el contrato ya soporta:** `tenants.service.listTenants` (paginado, `totalElements`) y `establishments.service.listEstablishments` (array, conteo en cliente). Desde la v4, también `reservations.service.listReservations` (array, agregado en cliente) y `people.service.searchPeople` (array, agregado en cliente).
- **Descartados por falta de endpoint:** "usuarios registrados" (no existe `listUsers`: `GET /users` solo crea), reportes generados, ubicaciones activas, establecimientos destacados con rating, ingresos y tasa de conversión. Ver §7.
- **El backend sí cambia en la v4** (contradice el "sin cambios" de v1-v3): se añade `GET /reservations`, **solo lectura y sin migración** — la tabla `reservation` ya existía con `status`, `created_at`, `starts_at`, `ends_at` y RLS activa; lo que faltaba era la lectura. El contrato manda: `openapi.yaml` → `pnpm api:gen` → implementación.
- **El backend vuelve a cambiar en la v7**: `GET /element-states/summary`, también **solo lectura y sin migración** — la tabla `space_element` ya existía con `state` y `deleted_at`; lo que faltaba era el agregado por estado. Mismo camino: contrato → `api:gen` → implementación.
- **Tiempo real: sí en la v7, y solo para la ocupación.** La v7 introduce el primer consumo de STOMP del frontend (el panel de ocupación). El resto del dashboard sigue cargando por HTTP al montar.
- **No se toca el sidebar ni el topbar:** se reutiliza el shell existente. Cualquier cambio de navegación es tarea aparte.
- Todo texto visible sale de `STRINGS` en `apps/console/src/app/core/strings.ts` (cero texto hardcodeado).

## 5. Reglas de negocio

- El conteo de establishments se calcula en cliente sobre el array devuelto por `listEstablishments()` (filas vivas ya filtradas por la API; no hay campo de borrado lógico expuesto).
- La distribución por tipo usa `Establishment.type` (`RESTAURANT`, `NIGHTCLUB`, `EVENT_HALL`, `HOTEL`).
- Todo el texto visible es tipado vía `STRINGS`: una errata en una clave no compila.
- **Cada fuente de datos falla por separado:** `GET /tenants` exige rol `SUPER_ADMIN` (SecurityConfig), así que un ADMIN de tenant recibe 403; la vista lo tolera (`catchError → null`) y oculta solo la sección de KPIs de plataforma sin tumbar el resto. La petición de tenants solo se hace si `session.user().role === 'SUPER_ADMIN'`.
- **Los accesos rápidos solo apuntan a rutas accesibles para el rol** (`/establishments`, `/spaces/setup`, `/templates`, `/reservations/new`); el acceso a `/admin/dashboard` solo se muestra a SUPER_ADMIN (es lo que exige `roleGuard`).
- **% de ocupación = `OCCUPIED / (total − OUT_OF_SERVICE) × 100`**, con un decimal y `null` (se muestra "—") cuando no hay elementos operativos. Solo cuenta `OCCUPIED`: según la máquina de estados (`SpaceElementStateMachine`), `RESERVED` es "reservada pero no ocupada todavía" y no hay modelo de turnos, así que una mesa reservada para el futuro no está ocupada ahora. `CLEANING` es transitorio (sale de `OCCUPIED`) y no cuenta como ocupación.
- **El conteo en vivo se aplica en local**: el evento trae `previousState` y `state`, así que el panel resta uno del estado anterior y suma uno al nuevo. Si el evento **no** trae `previousState`, el panel vuelve a pedir el resumen (el delta local no sería fiable). Un refresco debounced (≈1 s) reconcilia la deriva: un elemento creado después del snapshot no estaba en el resumen.
- **Cada fuente de datos falla por separado, también la nueva:** si `GET /element-states/summary` falla, el resto del dashboard se muestra igual y solo el panel de ocupación queda sin dato.

## 6. Criterios de aceptación

- **[CA-1]** Dado un Super Admin autenticado, cuando abre la pantalla de inicio, entonces ve tarjetas con: total de tenants, tenants activos y tenants suspendidos, provenientes de `listTenants`.
- **[CA-2]** Dado establecimientos registrados, cuando abre el dashboard, entonces ve el conteo total de establecimientos (KPI "Total de negocios").
- **[CA-3]** Dado que la API falla al cargar, entonces se muestra un mensaje de error con un botón de reintento que vuelve a ejecutar ambas cargas.
- **[CA-4]** Todo texto visible de la pantalla proviene de `STRINGS` (sin strings hardcodeados en el componente).
- **[CA-5]** `pnpm check` en verde (lint, typecheck, tests, build).
- **[CA-6]** _(retirado en la v7)_ El KPI "Vertical principal" salió del dashboard: con pocos negocios era "100 % del total" y no informaba de nada.
- **[CA-7]** Dado reservas registradas, cuando abre el dashboard, entonces ve el total de reservas y, si la semana anterior tuvo reservas, su variación porcentual; si la semana anterior fue 0, ve el conteo neutro ("N nuevas esta semana") y **nunca** un porcentaje inventado.
- **[CA-8]** Dado que la API de reservas o la de personas falla, entonces el resto del dashboard se muestra igual y solo el bloque afectado queda sin dato: cada fuente aísla su error.
- **[CA-9]** Dado que todavía no existe endpoint de pagos ni columna de importe, entonces los slots "Pagos QR", "Ingresos" y "Tasa de conversión" muestran "—" y "Sin datos" con una nota que explica que se rellenan solos cuando llegue CU-17; en ningún caso se muestra un número inventado.
- **[CA-10]** Los valores numéricos de los dos gráficos son accesibles en texto: el SVG lleva `role="img"` y `aria-label`, y además cada serie tiene una tabla visualmente oculta con el valor de cada semana.
- **[CA-11]** Dado un tenant con elementos en varios estados, cuando abre el dashboard, entonces ve un panel "Ocupación en vivo" con las **cinco** filas (disponible, ocupada, reservada, en limpieza, fuera de servicio), cada una con su conteo y con el color que ya usa el mapa (`--mapit-state-*`), más el total de elementos. Las cinco filas están siempre presentes, con 0 cuando no hay elementos en ese estado.
- **[CA-12]** El KPI "% de ocupación" muestra `OCCUPIED / (total − OUT_OF_SERVICE) × 100` con un decimal; si no hay elementos operativos muestra "—" (nunca `NaN`, nunca `Infinity`, nunca un 0 inventado que aparente ocupación nula).
- **[CA-13]** Dado un evento STOMP `space-element.state.changed.v1` de un establecimiento del tenant, cuando llega, entonces el conteo de ese elemento se mueve en vivo (el estado anterior baja, el nuevo sube) sin recargar la página. Si el evento no trae `previousState`, el panel vuelve a pedir el resumen.
- **[CA-14]** Con la flag `realtime.websocket` apagada, el panel sigue mostrando el resumen por HTTP (snapshot), no se suscribe a ningún topic y no se rompe nada.
- **[CA-15]** El panel de ocupación aísla su fallo: si `GET /element-states/summary` falla, el resto del dashboard se muestra igual y el panel queda en estado "Sin datos" con opción de reintento.

## 7. Fuera de alcance

- Gráficos de evolución temporal **de un endpoint dedicado**: las series que hay se derivan en cliente de `createdAt` (v3 y v4).
- Métrica de "usuarios registrados" (no existe `listUsers` en el contrato; `GET /users` solo crea). "Personas registradas" es otra cosa: clientes del tenant (`GET /people`), no cuentas staff.
- Ingresos, tasa de conversión y pagos QR: no hay columna de importe en el modelo, ni denominador de visitas públicas, ni tabla ni endpoint de pagos. Es CU-17.
- Notificaciones en tiempo real (WebSocket/STOMP) **salvo la ocupación**: en la v7 el único flujo en vivo es el estado de los elementos. El feed de actividad, los gráficos y los KPIs siguen siendo de carga por HTTP.
- **No-shows** (reservas que el cliente no llegó): no hay modelo de check-in ni de inicio real, así que no se pueden contar. Sería un cambio de modelo, no un endpoint.
- **Duración media de ocupación, horas punta y tasa de rotación**: el dato existe en `space_element_state_change` (`previous_state`, `new_state`, `changed_at`), pero el endpoint actual es **por elemento** y no agregable. Queda para cuando haya un agregado.
- **Reglas por vertical** (qué tipos de elemento son reservables en restaurante, discoteca, salón de eventos u hotel): son las CU-19…22, sin implementar. Por eso el panel cuenta todos los elementos.
- Reestructuración del shell, sidebar o topbar.
- Paginar el listado de negocios: es preexistente y la v4 tampoco lo cambia.

## 8. Impacto multi-tenant

- No se crean tablas: `GET /reservations` es una lectura sobre la tabla `reservation` que ya existía (Flyway V17), con `tenant_id NOT NULL`, índice único `(tenant_id, id)` y RLS activa.
- El endpoint nuevo resuelve el tenant con `tenantContext.require()` (claim del JWT), filtra explícitamente por `tenant_id` en la SQL y activa el ámbito de sesión (`SET LOCAL app.tenant_id`) para que la RLS de PostgreSQL deje pasar sus filas. Doble aislamiento, como el resto.
- La consulta es de solo lectura y va dentro de una transacción: `SET LOCAL` es de ámbito transaccional, y sin ella la RLS cerraría en falso y el endpoint devolvería una lista vacía en silencio.
- Las consultas de tenants ya filtran por `tenant_id` en el backend; el cliente no envía `tenant_id` explícito.
- **El endpoint de la v7 (`GET /element-states/summary`) duplica el aislamiento, igual que el resto**: resuelve el tenant con `tenantContext.require()` (claim del JWT), filtra explícitamente por `tenant_id` en la SQL y activa el ámbito de sesión (`SET LOCAL app.tenant_id`) para que la RLS de PostgreSQL deje pasar sus filas. Es una lectura de la tabla `space_element`, que ya existía con `tenant_id NOT NULL`, índice `(tenant_id, id)` y RLS activa. Los elementos con `deleted_at` no se cuentan.
- **El consumo de STOMP no cruza tenants**: el panel se suscribe a los topics de los establecimientos **del propio tenant** (los que ya tiene cargados) y el backend publica en `/topic/establishments/{id}`. El token JWT viaja en el `CONNECT` de STOMP, igual que en HTTP.

## 9. Techo conocido (ponytail)

- `listEstablishments()` devuelve un array sin paginación: el conteo y la distribución se hacen en cliente. Si el listado crece a cientos de establecimientos, hay que pedir un endpoint paginado y mover el agregado al backend. `ponytail: conteo en cliente, paginación si supera cientos de filas.`
- `listReservations()` también devuelve un array plano y sin paginar, y su techo es más bajo: una reserva se crea por booking, así que el agregado crece mucho más rápido que el de negocios. Está pensado para métricas agregadas (totales, crecimiento semanal, reparto por estado); si un tenant acumula cientos de reservas hay que pedir una variante paginada. `ponytail: array plano para agregados en cliente, paginación cuando el volumen lo pida.`
- El conteo de personas y su delta semanal se derivan de `searchPeople()`, que devuelve todas las personas activas del tenant sin paginar. Mismo techo.
- **Una suscripción STOMP por establecimiento del tenant.** Los topics son por establecimiento (`/topic/establishments/{id}`) y no existe topic por tenant, así que el panel abre una suscripción por cada establecimiento que conoce. Con decenas de establecimientos es una sola conexión con N suscripciones; con cientos, el backend debería publicar un topic por tenant. `ponytail: N suscripciones (uno por establecimiento), topic por tenant si la plataforma crece a cientos.`
- **El resumen cuenta todos los elementos, no solo los reservables.** `space_element.type` incluye `TABLE | BAR | SECTOR_ZONE | STAGE | SEAT | ROOM | DECOR` y las reglas de qué tipos son reservables en cada vertical son las CU-19…22, sin implementar. Hasta entonces el agregado es de "elementos", no de "mesas". `ponytail: cuenta todos los elementos; filtrar por tipo reservable cuando existan las reglas por vertical (CU-19…22).`
- **El delta en vivo es local, no autoritativo.** El conteo se mueve en el cliente con el evento STOMP; un refresco debounced (≈1 s) reconcilia la deriva. Si el volumen de eventos por segundo es alto, el snapshot autoritativo pasa a ser la fuente y el evento solo el aviso. `ponytail: delta local + refresco debounced, snapshot autoritativo si el tráfico lo pide.`
