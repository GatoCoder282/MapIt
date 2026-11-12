# Plan — HU-7.01/7.02 Configuración y validación integral de las cuatro verticales

## Enfoque

Un **catálogo de verticales** en `shared-kernel` declara, por cada uno de los cuatro valores de
`establishment.type`, su modo de reserva, su ventana temporal, sus tipos de elemento admitidos
y reservables y la flag que la habilita. Es la única fuente de esas reglas: `spaces` la usa para
el editor y el perfil de vertical; `reservations` para validar reservas y calcular qué elementos
son seleccionables en el mapa público. No hay servicios, tablas ni frontends por vertical: el
mismo `CreateReservation` aplica la estrategia del modo de reserva que corresponde.

Los frontends no repiten la matriz: leen el **perfil de vertical** que devuelve la API (staff por
establecimiento o sector, público dentro del mapa de disponibilidad) y solo deciden textos con
`STRINGS` indexados por vertical.

## Patrones de diseño aplicados

| Patrón            | Dónde                                                                              | Por qué aquí                                                                                                                                                                                                 | Alternativa descartada                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Strategy**      | `BookingMode` (`SHIFT`, `NIGHT`, `EVENT`, `STAY`) con su `BookingWindowPolicy`     | Es el patrón central de MapIt (catálogo de patrones): un motor de reservas, cuatro comportamientos de ventana. Cada modo valida su intervalo; `CreateReservation` no hace `switch` por vertical.             | Un `ReservationService` por vertical duplicaría persistencia, solapamiento y 409 (fuera de alcance explícito); un `if` por vertical en el caso de uso crecería con cada regla. |
| **Shared Kernel** | `com.mapit.shared.vertical.VerticalCatalog` en `shared-kernel`                     | Spaces y reservations deben coincidir exactamente en qué es reservable por vertical; con dos copias el editor podría ofrecer un elemento que la reserva rechaza. `SpaceDisplayName` ya sienta el precedente. | Duplicar la matriz en cada módulo con un test de coherencia: dos fuentes que mantener y un fallo que solo detecta CI.                                                          |
| **Specification** | `VerticalProfile.isReservable(type)` combinado con estado operativo y solapamiento | La elegibilidad de un elemento se compone (vertical ∧ estado ∧ sin solape) en creación y en el mapa público sin multiplicar consultas.                                                                       | Codificar la lista de tipos en el SQL del mapa público: una tercera copia de la regla.                                                                                         |
| **Adapter**       | `UnleashFeatureFlagAdapter.isEnabledFor(flag, tenant)` con `UnleashContext`        | La estrategia por tenant de Unleash necesita el tenant del recurso, también en rutas públicas sin JWT. El resto del backend sigue sin conocer Unleash.                                                       | Leer `TenantContext` dentro del adaptador: en rutas públicas el tenant sale del slug y no siempre está en contexto.                                                            |
| **Value Object**  | `VerticalProfile` (record inmutable) y `ReservationTimeRange` existente            | El perfil viaja entre capas y módulos sin poder modificarse; la ventana se valida sobre el VO de HU-5.01.                                                                                                    | Pasar mapas o strings sueltos entre módulos.                                                                                                                                   |

## Contrato API (`packages/api-contract/openapi.yaml`, antes que el código)

| Cambio                                                   | Detalle                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VerticalProfile` (schema nuevo)                         | `establishmentType`, `bookingMode` (`SHIFT`/`NIGHT`/`EVENT`/`STAY`), `enabled`, `allowedElementTypes[]`, `reservableElementTypes[]`, `allowsOvernight`, `maxDurationMinutes` (null en STAY), `minNights`/`maxNights` (solo STAY), `defaultStartTime`/`defaultEndTime` (solo STAY). |
| `GET /establishments/{establishmentId}/vertical-profile` | Staff, JWT. `200 VerticalProfile`; `404` si no es del tenant.                                                                                                                                                                                                                      |
| `GET /sectors/{sectorId}/vertical-profile`               | Staff, JWT. Para el editor, que trabaja por sector. `404` si no es del tenant.                                                                                                                                                                                                     |
| `PublicAvailabilityMap`                                  | `+ vertical: VerticalProfile`, `+ endDate`. Query `endDate` opcional.                                                                                                                                                                                                              |
| `PublicReservationCreateRequest`                         | `+ endDate` opcional (salida del hotel o fin explícito). Sin `endDate`, NIGHT/EVENT pasan al día siguiente si `endTime ≤ startTime`.                                                                                                                                               |
| `PublicReservation`                                      | `+ endDate` (día local del fin).                                                                                                                                                                                                                                                   |
| `403 vertical-disabled`                                  | En `createEstablishment`, `createReservation` y `createPublicReservation`.                                                                                                                                                                                                         |

Sin migraciones: no cambia el esquema.

## Backend

### MAP-232 — Resolución y habilitación

- `shared-kernel/vertical`: `Vertical`, `BookingMode`, `VerticalProfile`, `VerticalCatalog`,
  `VerticalGate` (consulta la flag con el tenant) y `VerticalDisabledException`.
- `FeatureFlagPort.isEnabledFor(flag, tenantId)` (método por defecto que delega en
  `isEnabled(flag)`, para no romper los dobles de prueba existentes); Unleash lo implementa con
  `UnleashContext` y propiedad `tenantId`.
- `FeatureFlag.VERTICAL_HOTEL`/`VERTICAL_EVENT_HALL`: valor por defecto `true` (spec D3), en el
  enum Java, el catálogo TS y `infra/docker/unleash/flags.json`.
- `spaces`: `EstablishmentService.create` exige la vertical habilitada; caso de uso de lectura del
  perfil por establecimiento y por sector; controlador con los dos `GET`.
- `bootstrap`: `VerticalProblemAdvice` traduce `VerticalDisabledException` a `403` RFC 9457.

### MAP-247 — Catálogo de elementos

- `SpaceElementTypePolicy` delega en `VerticalCatalog` (misma matriz; deja de ser «provisional»).

### MAP-233 — Reglas de reserva

- `reservations-domain`: `BookingWindowPolicy` valida un `ReservationTimeRange` contra el
  `VerticalProfile` en la zona del establecimiento; `PublicReservationTimeRange.resolve` acepta
  `endDate` y el desplazamiento nocturno según el modo.
- `ReservationResourceRepository.findEstablishment(tenant, id)` devuelve vertical y zona horaria.
- `CreateReservation` (común a staff y público): gate de vertical → ventana → elementos
  reservables para la vertical (sustituye «todo menos DECOR») → solapamiento (sin cambios).
- Mapa y lista públicos: `selectable` y la lista de disponibles usan los tipos reservables de la
  vertical; el mapa acepta `endDate` y devuelve el perfil.

## Frontend

### MAP-234 — Terminología y formularios

- `STRINGS.verticals.<VERTICAL>` en Console y Public Web: sustantivo del recurso (mesa, mesa VIP,
  ubicación, habitación), del intervalo (turno, noche, evento, estadía) y etiquetas de campos.
- Public Web: buscador y reserva leen `vertical` del mapa. `STAY` muestra «Llegada»/«Salida» (horas
  del perfil, ocultas); `NIGHT`/`EVENT` avisan de que el fin puede ser al día siguiente.
  `validPublicInterval` pasa a depender del perfil (fin al día siguiente o fecha de salida).
- Console: el asistente de establecimiento deshabilita las verticales apagadas; la biblioteca del
  editor filtra tipos y plantillas por `allowedElementTypes` del sector; el formulario de reserva
  interna carga el perfil del establecimiento elegido y adapta textos y campos (fechas de estadía
  en hotel).

### MAP-248 — Integración

- Arrastrar `endDate` por las rutas públicas (disponibilidad → reserva → checkout) y formatear el
  intervalo como rango de días cuando es una estadía. El pago QR de MAP-229 no cambia.

## Verificación (MAP-235 / MAP-249)

- Unitarias: `VerticalCatalog`, `BookingWindowPolicy` (4 modos × válidos/inválidos),
  `PublicReservationTimeRange`, `VerticalGate`, `SpaceElementTypePolicy`.
- Integración (Testcontainers): perfil por establecimiento y sector con aislamiento A/B; `403` con
  flag apagada en establecimiento, reserva de staff y pública; reglas de las cuatro verticales con
  `409` por solape; elementos no reservables; regresión de HU-6.01/6.02.
- Frontend (Vitest): stores de disponibilidad y reserva por modo; biblioteca del editor filtrada;
  formulario de reserva interna por vertical.
- E2E (Playwright): `verticals.spec.ts` con un establecimiento por vertical sembrado por API y una
  reserva pública completa en cada uno; negativo de flag/tenant por API.
- `pnpm api:check`, `pnpm check`, `pnpm be:test`, `pnpm be:it`, `pnpm fe:test`, `pnpm e2e`.

## Ramas (CONTRIBUTING · ramas apiladas)

```text
feat/Trigramador69/HU-7.01-7.02-configuracion-y-validacion-integral-de-las-cuatro-verticales   → main
  → feat/Trigramador69/MAP-232-definir-y-resolver-vertical-por-establecimiento-tenant-con-unleash
  → feat/Trigramador69/MAP-247-configurar-catalogo-de-elementos-y-plantillas-para-las-cuatro-verticales
  → feat/Trigramador69/MAP-233-aplicar-reglas-de-reservas-por-turno-evento-noche-y-estadia
  → feat/Trigramador69/MAP-234-adaptar-frontend-a-terminologia-y-formularios-de-las-cuatro-verticales
  → feat/Trigramador69/MAP-248-integrar-las-cuatro-verticales-con-mapa-disponibilidad-y-reservas
  → feat/Trigramador69/MAP-235-validar-integracion-contratos-aislamiento-multi-tenant-y-regresiones
  → feat/Trigramador69/MAP-249-e2e-y-aceptacion-reproducible-de-restaurante-discoteca-salon-y-hotel
```

Orden de la historia en Jira: MAP-232 → MAP-233/234/247 → MAP-248 → MAP-235/249. MAP-247 va
antes que MAP-233 porque el catálogo de elementos reservables es la entrada de las reglas de reserva.
