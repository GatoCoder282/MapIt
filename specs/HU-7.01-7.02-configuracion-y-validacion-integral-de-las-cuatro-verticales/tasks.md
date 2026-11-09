# Tareas — HU-7.01/7.02 Configuración y validación integral de las cuatro verticales

## MAP-232 — Definir y resolver vertical por establecimiento/Tenant con Unleash

- [x] Contrato: `VerticalProfile`, `GET /establishments/{id}/vertical-profile`, `GET /sectors/{id}/vertical-profile`, `403 vertical-disabled` en `createEstablishment`; `pnpm api:lint` y `pnpm api:gen`.
- [x] `shared-kernel/vertical`: catálogo, perfil, modo de reserva, gate y excepción.
- [x] `FeatureFlagPort.isEnabledFor` con contexto de tenant en Unleash; defaults `true` en los 3 sitios.
- [x] `spaces`: gate en el alta de establecimiento y lectura del perfil por establecimiento/sector.
- [x] `bootstrap`: advice `403 vertical-disabled`.
- [x] Tests: catálogo y gate (unit); perfil A/B, `404` cruzado y `403` con flag apagada (IT).

## MAP-247 — Configurar catálogo de elementos y plantillas para las cuatro verticales

- [x] `SpaceElementTypePolicy` delega en el catálogo; actualizar su test.
- [x] Console: la biblioteca del editor filtra tipos base y plantillas por `allowedElementTypes`.
- [x] Tests: política (unit) y biblioteca filtrada (Vitest).

## MAP-233 — Aplicar reglas de reservas por turno, evento/noche y estadía

- [x] Contrato: `endDate` en mapa público, petición y respuesta pública; `403` en las dos creaciones de reserva.
- [x] `BookingWindowPolicy` y `PublicReservationTimeRange` con `endDate` y paso nocturno.
- [x] `CreateReservation`: gate, ventana y reservables por vertical.
- [x] Mapa y lista públicos con reservables por vertical y perfil en la respuesta.
- [x] Tests: política por modo (unit); reglas de las cuatro verticales, 409 y 403 (IT).

## MAP-234 — Adaptar frontend a terminología y formularios de las cuatro verticales

- [x] `STRINGS.verticals` en Console y Public Web.
- [x] Public Web: buscador y reserva por modo (turno, noche, evento, estadía).
- [x] Console: asistente con verticales habilitadas; formulario de reserva interna por vertical.
- [x] Tests de stores (Vitest).

## MAP-248 — Integrar las cuatro verticales con mapa, disponibilidad y reservas

- [x] `endDate` en rutas públicas disponibilidad → reserva → checkout; rango de días en confirmación.
- [x] Verificar pago MOCK sin cambios cuando la política lo habilita.

## MAP-235 — Validar integración, contratos, aislamiento multi-tenant y regresiones

- [x] IT de aislamiento tenant/establishment del perfil y de la reserva por vertical.
- [x] Regresión HU-6.01/6.02/6.03 (`PublicAvailability*`, `PublicReservation*`, `PublicPaymentFlow*`).
- [x] `pnpm api:check`, `pnpm check`, `pnpm be:test`, `pnpm be:it`, `pnpm fe:test`.

## MAP-249 — E2E y aceptación reproducible de Restaurante, Discoteca, Salón y Hotel

- [x] `apps/e2e/tests/public-web/verticals.spec.ts`: una reserva pública por vertical y negativos por API.
- [x] Playwright local de `public-web` (desktop y móvil) y `console` en verde.
- [ ] Captura de los checks de CI en verde adjunta a cada PR (pendiente: requiere los PR abiertos).

## Notas de ejecución

### Preparación

- MAP-231 consolida HU-7.01 y HU-7.02 (MAP-239 sustituida). Subtareas: MAP-232, MAP-233,
  MAP-234, MAP-235, MAP-247, MAP-248, MAP-249. Lectura de Jira el 29/10/2026.
- `main` en `65f5206`: MAP-229 (pago QR) ya mergeado (#52), así que el tramo de pago no está
  bloqueado aunque Jira lo muestre en QA.
- La vertical ya estaba persistida por establecimiento (`establishment.type`, `NOT NULL` + `CHECK`
  desde V5) y era inmutable (RN-3 de CU-04): la decisión tenant vs establecimiento no necesita
  migración (spec D1).
- `vertical.hotel` y `vertical.event-hall` existían en los tres sitios pero ningún código las leía.

### MAP-232 — Resolución y habilitación

- Contrato: `VerticalProfile`, `BookingMode`, `GET /establishments/{id}/vertical-profile`,
  `GET /sectors/{id}/vertical-profile` y la respuesta `VerticalDisabled` (403) en
  `createEstablishment`. `pnpm api:lint` sin errores (las 2 advertencias de `/health` y
  `/demo-items` ya estaban en `main`).
- `shared-kernel/vertical`: `Vertical`, `BookingMode`, `VerticalProfile`, `VerticalCatalog`,
  `VerticalGate`, `VerticalDisabledException`. `bootstrap/VerticalWiring` publica el gate y
  traduce la excepción a `403 https://mapit.local/problems/vertical-disabled` con `vertical`.
- `FeatureFlagPort.isEnabledFor(flag, tenant)` es un método por defecto: los diez IT que
  sustituyen el puerto por un doble siguen compilando y, como solo usan restaurantes, no
  cambian de comportamiento. Unleash lo implementa con `UnleashContext` (`tenantId`).
- Las rutas de establecimientos siguen abiertas con `DemoTenantContext` (temporal de CU-04):
  un anónimo cae en el tenant demo y recibe 404 por un establecimiento ajeno, no 401.
- El backend serializa nulos con `default-property-inclusion: non_null`; el perfil declara
  `@JsonInclude(ALWAYS)` porque el contrato exige los campos nulos según el modo.
- El proxy de Unleash del navegador no recibe el tenant: en Console la flag solo deshabilita la
  opción del selector; quien decide es el backend (403) y la UI muestra el motivo.
- Verificación: `pnpm be:test` verde; `VerticalProfileIntegrationTest` (6 casos) verde con
  Testcontainers; `ng test libs` de flags (7) verde; `pnpm fe:typecheck` y ESLint de los
  archivos tocados sin avisos.

### MAP-247 — Catálogo de elementos y plantillas

- Matriz de tipos admitidos y reservables documentada en spec D4/D5. `SpaceElementTypePolicy`
  deja de declarar la matriz y la traduce desde `VerticalCatalog`; dos tests nuevos fallan si
  el catálogo nombra un tipo que spaces no conoce o deja una vertical sin tipos.
- Las plantillas siguen siendo del tenant (MAP-191), sin columna de vertical: se filtran por el
  tipo que admite la vertical del sector abierto. No se migran datos ni se tocan plantillas
  existentes; una plantilla `TABLE` sigue existiendo, solo que el editor de un hotel no la ofrece.
- Console: `MapEditorStore` carga `GET /sectors/{id}/vertical-profile` junto con los elementos;
  `ElementLibraryComponent` oculta categorías sin tipos admitidos. Si el perfil falla, no filtra
  y el backend sigue respondiendo 400 a un tipo incompatible (RN-4 de HU-2.03).
- Verificación: `spaces-domain` y `spaces-application` verdes; `ng test console` del editor
  (37 tests, 4 nuevos) verde; ESLint sin avisos.

### MAP-233 — Reglas de reserva por vertical

- `BookingWindow` (interfaz sellada, Strategy): `Hourly` para turno/noche/evento y `Stay` para
  estadía. El fin semiabierto a las 00:00 cuenta como el mismo día (un turno 20:00–00:00 vale).
- `CreateReservation` sigue siendo el único servicio para staff y público: resuelve vertical y
  zona con `ReservationResourceRepository.findVenue`, aplica gate → ventana → bloqueo →
  reservables de la vertical → solape 409. La ventana se valida antes de bloquear filas.
- `ReservationResource.isReservable()` (solo «no DECOR») se conserva para pago y llegada, que
  revalidan una reserva ya creada con las reglas de su vertical.
- Público: `endDate` opcional en petición y mapa; `PublicReservationTimeRange` pasa al día
  siguiente solo si la vertical admite noches. Respuestas con `endDate`; el mapa con `vertical`
  y `selectable` según tipos reservables y flag. Nuevo `GET …/vertical-profile` público para que
  el portal adapte el formulario antes de buscar.
- `VerticalProfileView` (shared kernel) es la forma publicada única del perfil para spaces y
  reservations; bootstrap le aplica el mixin de nulos explícitos.
- Regresión: `PublicAvailabilityIntegrationTest` tenía una `SEAT` en un restaurante insertada
  por SQL (el editor nunca la habría permitido); pasa a `SECTOR_ZONE` y conserva el caso de
  frontera. Los fixtures TS de mapa y reserva incluyen `endDate` y `vertical`.
- Verificación: `pnpm be:test` verde (incluye `BookingWindowTest` y 6 casos nuevos de
  `CreateReservationTest`); IT de `reservations.*` y `payments.*` (74) verdes;
  `VerticalReservationIntegrationTest` (9) y `VerticalProfileIntegrationTest` (6) verdes;
  `ng test public-web` (119) verde.

### MAP-234 — Terminología y formularios

- `STRINGS.verticals` (Public Web) y `STRINGS.reservations.form.verticals` (Console) solo
  nombran: los límites (`{hours}`, `{start}`, `{end}`, `{min}`, `{max}`) se rellenan con el
  perfil del backend, así que cambiar la regla en `VerticalCatalog` no exige tocar textos.
- Public Web: `AvailabilityStore` pide `GET …/vertical-profile` al entrar y adapta el formulario
  (hotel: llegada/salida con las horas de check-in/out ocultas; discoteca y salón: aviso de fin
  al día siguiente). `validVerticalInterval` replica `BookingWindow` para no enviar búsquedas que
  solo pueden volver con 400; sin perfil conserva la regla anterior del mismo día. El perfil que
  trae el mapa reemplaza al inicial (refleja la flag en ese momento).
- Console: el formulario de reserva interna carga el perfil del establecimiento elegido; filtra
  elementos por `reservableElementTypes` (antes `TYPE_DEFAULTS`, que excluía las zonas de la
  discoteca), muestra la etiqueta del elemento en vez de solo su tipo, pide días en hotel y
  traduce el 403. Cambiar de establecimiento limpia el intervalo porque cambia su forma.
- `ReservationsApi.listReservableElements` ya no decide reservabilidad: solo descarta
  decoración y fuera de servicio; su test se actualizó en consecuencia.
- Verificación: `ng test public-web` (131) y specs de reservas de Console (24) verdes;
  `ng build` de ambas apps sin errores (public-web mantiene el aviso de presupuesto inicial
  de 400 kB, por debajo del error de 800 kB); ESLint y `pnpm fe:typecheck` limpios.

### MAP-248 — Integración mapa → disponibilidad → reserva → pago

- El enlace «Continuar» lleva `endDate` siempre que el backend resolvió un fin en otro día
  (salida de hotel o noche de madrugada). Así la página de reserva no depende de volver a
  deducirlo antes de tener el perfil; sin perfil se acepta un `endDate` explícito.
- `BookingStore` toma el perfil del mapa, envía `endDate` en `createPublicReservation`, muestra el
  día de fin resuelto, bloquea la confirmación con la vertical apagada y traduce el 403.
- Checkout, recibo e historial ya formateaban `startsAt`/`endsAt` con `formatRange`, así que
  una estadía de varios días se muestra sin cambios. El pago QR MOCK de MAP-229 no cambia.
- `PublicPaymentFlowIntegrationTest` suma una estadía de hotel: mismo checkout (120 BOB),
  pago MOCK confirmado y la habitación sigue `AVAILABLE` (pagar no es check-in).
- Verificación: `ng test public-web` (134) verde; `PublicPaymentFlowIntegrationTest` verde;
  `ng build public-web`, ESLint y `pnpm fe:typecheck` limpios.

### MAP-235 — Validación de integración, contratos y aislamiento

- `UnleashFeatureFlagAdapterTest`: la flag de vertical se evalúa con `UnleashContext`
  (`tenantId`) y, si Unleash no la conoce (servidor caído), devuelve el default encendido.
- `VerticalReservationIntegrationTest` suma una carrera: dos estadías solapadas sobre la misma
  habitación lanzadas a la vez dejan una sola reserva (`201` + `409`), gracias al bloqueo de
  HU-5.01 que la estrategia de ventana no altera.
- Cobertura ya existente que se reutiliza: elemento incompatible por vertical → 400
  (`SpaceElementApiIntegrationTest`, CA-7), aislamiento de `establishment` por RLS y regresión
  de HU-6.01/6.02/6.03 (`PublicAvailability*`, `PublicReservation*`, `PublicPaymentFlow*`).
- `pnpm check` (29/10/2026): formato, lint, tipos, tests frontend (console 300, public-web 134,
  libs) y build frontend verdes. Contrato y backend fallaron en la primera pasada por causas
  locales y se corrigieron: la huella de `api:gen` era anterior al prettier del hook de commit
  (`pnpm api:gen` → `pnpm api:check` sincronizado) y faltaba `pnpm be:fmt` en el test nuevo
  (`gradle build` verde después).
- `pnpm be:it`: 191 tests de integración, 0 fallos, 0 omitidos (13 min 54 s con Docker local).
  `pnpm be:test`: 439 unitarios + ArchUnit, 0 fallos.

### MAP-249 — E2E y aceptación reproducible

- `verticals.spec.ts` crea por API real su empresa (fixture de CU-25 con Mailpit), un
  establecimiento por vertical con piso, sector y elemento etiquetado, y reserva desde el portal
  anónimo: restaurante (Mesa 4, 19:00–21:00), discoteca (Zona VIP, 23:00–04:00 con salida al día
  siguiente), salón (Fila A · 1, 18:00–23:00) y hotel (Habitación 101, dos noches sin pedir
  horas). Comprueba que el navegador no envía credenciales. Negativos por API: solape 409,
  escenario 400, elemento de otro tenant 404 y perfil público que no cruza tenants.
- Ejecución local (29/10/2026): el backend del stack de desarrollo no arranca contra la BD local
  por un checksum de Flyway ya existente (el mismo V12 que registró el PR #51; esta pila no añade
  migraciones), y el build Docker de `pnpm infra:full` falló por un corte SSL al bajar Gradle.
  Para no reparar ni borrar la BD local, el E2E corrió con el `bootJar` contra un Postgres 17
  desechable, Unleash y Mailpit locales, y el build de `public-web` servido estático en `:4300`.
- Unleash local tenía `vertical.hotel` y `vertical.event-hall` apagadas (sembradas con el
  `flags.json` anterior); `pnpm db:seed:flags` las alineó con `flags.json`. **Cualquier Unleash
  ya sembrado (staging, otros equipos) debe encenderlas igual**: si no, hoteles y salones
  responden 403 `vertical-disabled`, que es el comportamiento definido con la flag apagada.
- Resultados: `verticals.spec.ts` 10/10 (public-web + public-web-mobile); todos los E2E de
  `public-web` 26/26 en dos corridas seguidas (la primera corrida en frío tuvo fallos
  intermitentes por carga que no se repitieron); `console` 10/12 con `home-visual` intermitente
  en paralelo y 3/3 aislado. CI ejecuta con `workers: 1` y 2 reintentos.
- Flag apagada (CA-3, CA-13) y Unleash caído (CA-4) se verifican en IT y unitarios: el Unleash de
  CI arranca sin flags y usa los defaults del catálogo, así que no se apagan en el E2E.
- Pendiente fuera del código: captura de los checks verdes de CI en cada PR.
