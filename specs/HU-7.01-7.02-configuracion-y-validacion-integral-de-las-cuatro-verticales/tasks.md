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

- [ ] Contrato: `endDate` en mapa público, petición y respuesta pública; `403` en las dos creaciones de reserva.
- [ ] `BookingWindowPolicy` y `PublicReservationTimeRange` con `endDate` y paso nocturno.
- [ ] `CreateReservation`: gate, ventana y reservables por vertical.
- [ ] Mapa y lista públicos con reservables por vertical y perfil en la respuesta.
- [ ] Tests: política por modo (unit); reglas de las cuatro verticales, 409 y 403 (IT).

## MAP-234 — Adaptar frontend a terminología y formularios de las cuatro verticales

- [ ] `STRINGS.verticals` en Console y Public Web.
- [ ] Public Web: buscador y reserva por modo (turno, noche, evento, estadía).
- [ ] Console: asistente con verticales habilitadas; formulario de reserva interna por vertical.
- [ ] Tests de stores (Vitest).

## MAP-248 — Integrar las cuatro verticales con mapa, disponibilidad y reservas

- [ ] `endDate` en rutas públicas disponibilidad → reserva → checkout; rango de días en confirmación.
- [ ] Verificar pago MOCK sin cambios cuando la política lo habilita.

## MAP-235 — Validar integración, contratos, aislamiento multi-tenant y regresiones

- [ ] IT de aislamiento tenant/establishment del perfil y de la reserva por vertical.
- [ ] Regresión HU-6.01/6.02/6.03 (`PublicAvailability*`, `PublicReservation*`, `PublicPaymentFlow*`).
- [ ] `pnpm api:check`, `pnpm check`, `pnpm be:test`, `pnpm be:it`, `pnpm fe:test`.

## MAP-249 — E2E y aceptación reproducible de Restaurante, Discoteca, Salón y Hotel

- [ ] `apps/e2e/tests/public-web/verticals.spec.ts`: una reserva pública por vertical y negativos por API.
- [ ] `pnpm e2e` (o CI) y captura de checks en verde en el PR.

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
