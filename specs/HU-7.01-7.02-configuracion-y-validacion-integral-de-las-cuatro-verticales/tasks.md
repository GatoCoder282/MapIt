# Tareas — HU-7.01/7.02 Configuración y validación integral de las cuatro verticales

## MAP-232 — Definir y resolver vertical por establecimiento/Tenant con Unleash

- [ ] Contrato: `VerticalProfile`, `GET /establishments/{id}/vertical-profile`, `GET /sectors/{id}/vertical-profile`, `403 vertical-disabled` en `createEstablishment`; `pnpm api:lint` y `pnpm api:gen`.
- [ ] `shared-kernel/vertical`: catálogo, perfil, modo de reserva, gate y excepción.
- [ ] `FeatureFlagPort.isEnabledFor` con contexto de tenant en Unleash; defaults `true` en los 3 sitios.
- [ ] `spaces`: gate en el alta de establecimiento y lectura del perfil por establecimiento/sector.
- [ ] `bootstrap`: advice `403 vertical-disabled`.
- [ ] Tests: catálogo y gate (unit); perfil A/B, `404` cruzado y `403` con flag apagada (IT).

## MAP-247 — Configurar catálogo de elementos y plantillas para las cuatro verticales

- [ ] `SpaceElementTypePolicy` delega en el catálogo; actualizar su test.
- [ ] Console: la biblioteca del editor filtra tipos base y plantillas por `allowedElementTypes`.
- [ ] Tests: política (unit) y biblioteca filtrada (Vitest).

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
