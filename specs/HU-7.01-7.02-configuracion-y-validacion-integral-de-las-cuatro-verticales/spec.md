# HU-7.01/7.02 — Configuración y validación integral de las cuatro verticales

> Jira: [MAP-231](https://matiasmv2005.atlassian.net/browse/MAP-231) (sustituye a MAP-239) ·
> Épica: MAP-10 E07 — Adaptación a Verticales · Sprint 5 · Entrega: 30/10/2026

## Enunciado

Como administrador de una empresa en MapIt, quiero configurar cada establecimiento según su
vertical (Restaurante, Discoteca, Salón de eventos u Hotel), para que el mapa, los tipos de
elementos, la terminología, la disponibilidad y las reservas se adapten correctamente sin
duplicar el motor común ni afectar a otros tenants.

## Contexto

El modelo ya separa las dos nociones que la historia pide reconciliar:

- `tenant.vertical` (`BusinessVertical`, CU-01): vertical **inicial** con la que se registró la
  empresa. Hoy solo alimenta el dashboard de plataforma (reparto de tenants por vertical).
- `establishment.type` (`EstablishmentType`, CU-04): `NOT NULL`, con `CHECK` sobre los cuatro
  valores e **inmutable** tras la creación (RN-3 de CU-04). Ya decide qué tipos de elemento
  admite el editor (`SpaceElementTypePolicy`, HU-2.03).

Lo que falta es que esa vertical gobierne también la **reserva** (ventana temporal y elementos
reservables), que se resuelva en la API para que los dos frontends adapten su terminología y
formularios, y que su habilitación pase por Unleash (MAP-14) con un comportamiento definido
cuando la flag está apagada o el servidor no responde.

Dependencias verificadas en `main` (`65f5206`, 29/10/2026): MAP-14 (Unleash), MAP-191
(plantillas), MAP-227 (disponibilidad), MAP-228 (reserva pública) y MAP-229 (pago QR, ya
mergeado en #52) están integradas en el código.

## Decisiones

### D1 — La vertical operativa es la del establecimiento

Se resuelve el bloqueo «por Tenant» vs «por establecimiento» a favor del **establecimiento**:

| Concepto                    | Fuente               | Uso                                                               |
| --------------------------- | -------------------- | ----------------------------------------------------------------- |
| Vertical operativa          | `establishment.type` | Editor, plantillas, disponibilidad, reservas, terminología de UI. |
| Vertical inicial del tenant | `tenant.vertical`    | Informativa: dashboard de plataforma. No se hereda en ejecución.  |

- No hay regla de herencia en tiempo de ejecución: si un tenant `RESTAURANT` abre un hotel, el
  hotel se comporta como hotel. Así una empresa con varias líneas de negocio no queda atada a
  su vertical de alta.
- **Sin migración**: todos los establecimientos existentes ya tienen `type` válido (`NOT NULL` +
  `CHECK` desde V5), así que no hay datos que rellenar ni compatibilidad que emular.
- La vertical sigue siendo inmutable (RN-3): cambiarla invalidaría los mapas y plantillas ya
  dibujados. «Configurar» la vertical es elegirla al crear el establecimiento; se persiste y
  sobrevive a recargas porque es una columna, no una preferencia de UI ni una flag.

### D2 — Un catálogo único de verticales

Un único catálogo declara, por vertical: modo de reserva, ventana temporal, tipos de elemento
admitidos, tipos reservables y la flag que la habilita. Spaces (editor) y reservations
(reserva) lo leen del mismo sitio, de modo que el editor nunca ofrece un elemento que la
reserva rechace después.

### D3 — Unleash habilita, no configura

- `vertical.hotel` y `vertical.event-hall` (ya existentes, tipo `PERMISSION`) habilitan esas
  verticales. Restaurante y Discoteca son el producto base y no llevan flag.
- La flag **nunca** decide qué vertical tiene un establecimiento: solo si esa vertical está
  habilitada. Apagada ⇒ la vertical **no cambia**; se rechaza explícitamente:
  - crear un establecimiento de esa vertical → `403 vertical-disabled`;
  - crear una reserva (staff o pública) en un establecimiento de esa vertical → `403 vertical-disabled`;
  - el perfil de vertical que devuelve la API lleva `enabled: false` y la UI lo explica.
  - Lo ya configurado (mapas, elementos, reservas previas) se conserva y sigue consultable.
- **Valor por defecto `true`** (antes `false`): si Unleash no responde, un hotel que ya opera
  sigue aceptando reservas. Apagar una vertical es un acto explícito en Unleash, no un efecto
  secundario de una caída. Es el «default seguro» para un negocio que ya está en producción.
- La flag se evalúa con el tenant del recurso como contexto de Unleash (`tenantId`), para que
  una estrategia por tenant funcione también en las rutas públicas, que no llevan JWT.

### D4 — Reglas de reserva por vertical

| Vertical         | Modo             | Ventana temporal                                                                            | Elementos reservables                            |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Restaurante      | `SHIFT` (turno)  | Mismo día local; duración ≤ 6 h.                                                            | `TABLE`, `BAR`, `SECTOR_ZONE`                    |
| Discoteca        | `NIGHT` (noche)  | Puede cruzar medianoche; duración ≤ 12 h.                                                   | `TABLE` (VIP), `BAR`, `SECTOR_ZONE` (zona/pista) |
| Salón de eventos | `EVENT` (evento) | Puede cruzar medianoche; duración ≤ 24 h.                                                   | `SEAT`, `TABLE`, `SECTOR_ZONE`                   |
| Hotel            | `STAY` (estadía) | Check-in y check-out en días locales distintos; 1–30 noches; horas por defecto 15:00/12:00. | `ROOM`                                           |

- `STAGE` y `DECOR` no son reservables en ninguna vertical.
- El solapamiento sigue siendo el de HU-5.01: intervalo semiabierto `[inicio, fin)`, conflicto
  `409`. Una estadía que termina el día en que empieza otra (12:00 → 15:00) no colisiona.
- Las ventanas se evalúan en la zona horaria del establecimiento.
- En el portal público, Discoteca y Salón interpretan `fin ≤ inicio` como «termina al día
  siguiente»; Restaurante lo rechaza (un turno no cruza el día) y Hotel exige fecha de salida.

### D5 — Tipos de elemento por vertical (editor y plantillas)

Se mantiene la matriz de HU-2.03, ahora documentada como contrato:

| Vertical         | Tipos admitidos en el editor                            |
| ---------------- | ------------------------------------------------------- |
| Restaurante      | `TABLE`, `BAR`, `SECTOR_ZONE`, `STAGE`, `DECOR`         |
| Discoteca        | `TABLE`, `BAR`, `SECTOR_ZONE`, `STAGE`, `DECOR`         |
| Salón de eventos | `TABLE`, `BAR`, `SECTOR_ZONE`, `STAGE`, `SEAT`, `DECOR` |
| Hotel            | `ROOM`, `DECOR`                                         |

Las plantillas siguen siendo del tenant (MAP-191): la Console solo ofrece en el editor las
plantillas cuyo tipo admite la vertical del sector abierto. La API ya rechazaba crear un
elemento incompatible (`400`, RN-4 de HU-2.03).

### D6 — Salón de eventos: ubicaciones numeradas

El motor ya admite varias ubicaciones por reserva (`spaceElementIds`, hasta 100) y cada `SEAT`
lleva su etiqueta numerada. **Limitación registrada:** el portal público reserva una ubicación
por reserva (el flujo de MAP-228 es de selección única); la reserva múltiple de butacas queda
para la Console o una historia posterior. No se inventa numeración automática.

### D7 — Pagos

Se reutiliza el pago QR de MAP-229 sin cambios: la vertical no altera el cobro, solo la ventana
de la reserva que se cobra. Pagar no implica check-in y el proveedor sigue siendo MOCK.

## Alcance

1. Catálogo de verticales y resolución del perfil de vertical en la API (staff y público).
2. Habilitación por Unleash con contexto de tenant y comportamiento definido con flag apagada.
3. Reglas de reserva por vertical en el servicio común (staff y público), sin servicios por vertical.
4. Portal público: fecha de fin opcional (`endDate`) en disponibilidad y reserva.
5. Console: asistente de establecimiento con verticales habilitadas, paleta del editor filtrada por
   vertical, formulario de reserva interna con terminología y campos por vertical.
6. Public Web: buscador y reserva con terminología y campos por vertical (turno, noche, evento,
   estadía).
7. Pruebas unitarias, de integración (aislamiento tenant/establecimiento, 409, flags) y E2E de
   las cuatro verticales.

## Criterios de aceptación

**Configuración y resolución (MAP-232)**

- [x] **CA-1:** Dado un ADMIN del tenant A, cuando crea un establecimiento `HOTEL` y recarga, entonces
      `GET /establishments/{id}/vertical-profile` devuelve `HOTEL`, modo `STAY` y sus tipos admitidos.
- [x] **CA-2:** Dado el tenant B, cuando pide el perfil de un establecimiento del tenant A, entonces
      recibe `404`, igual que con un id inexistente.
- [x] **CA-3:** Dada `vertical.hotel` apagada, cuando se crea un establecimiento `HOTEL`, entonces se
      responde `403` con `type` `…/vertical-disabled`; los establecimientos `HOTEL` existentes conservan
      su vertical y su perfil indica `enabled: false`.
- [x] **CA-4:** Dado que Unleash no responde, cuando se evalúa una vertical, entonces se usa el valor por
      defecto del catálogo (`true`) y la vertical persistida no cambia.
- [x] **CA-5:** Dado el portal público, cuando se consulta el mapa de un establecimiento, entonces la
      respuesta incluye su perfil de vertical resuelto por slug, sin aceptar `tenantId` del cliente.

**Catálogo de elementos y plantillas (MAP-247)**

- [x] **CA-6:** Dado el editor de un sector de un hotel, cuando se abre la biblioteca, entonces solo
      aparecen `ROOM` y `DECOR` y las plantillas de esos tipos.
- [x] **CA-7:** Dado un sector de restaurante, cuando se intenta crear un `ROOM` o un `SEAT` por API,
      entonces se responde `400` (regla existente, se mantiene).

**Reglas de reserva (MAP-233)**

- [x] **CA-8:** Dado un restaurante, cuando se reserva un turno que dura más de 6 h o que cruza el día
      local, entonces se responde `400`; un turno válido se crea.
- [x] **CA-9:** Dada una discoteca, cuando se reserva de 23:00 a 04:00, entonces la reserva termina al
      día siguiente; una noche de más de 12 h se rechaza con `400`.
- [x] **CA-10:** Dado un salón de eventos, cuando se reserva un `SEAT`, entonces se crea; si otra
      reserva solapa la misma butaca, se responde `409`.
- [x] **CA-11:** Dado un hotel, cuando se reserva una `ROOM` del día D al D+2, entonces se crea con dos
      noches; una estadía solapada da `409`; una estadía que empieza el día de salida de otra no
      colisiona; 0 noches o más de 30 se rechazan con `400`.
- [x] **CA-12:** Dada cualquier vertical, cuando se reserva un elemento no reservable para ella
      (`STAGE`, `DECOR`, o un tipo ajeno a la vertical), entonces se responde `400`; y un elemento de
      otro establecimiento o tenant nunca se reserva.
- [x] **CA-13:** Dada una vertical apagada, cuando se intenta reservar, entonces se responde `403
vertical-disabled` tanto en la ruta de staff como en la pública.

**Frontend (MAP-234)**

- [x] **CA-14:** Dado el portal público, cuando el establecimiento es un hotel, entonces el buscador
      pide «Llegada» y «Salida» en vez de fecha y horas; en discoteca habla de «noche», en salón de
      «evento» y «ubicación», en restaurante de «turno» y «mesa».
- [x] **CA-15:** Dada la Console, cuando se cambia de establecimiento en el formulario de reserva,
      entonces los textos y campos se actualizan a la vertical del nuevo establecimiento.
- [x] **CA-16:** Ningún texto nuevo está escrito en la plantilla: todo sale de `STRINGS`; ningún
      elemento se muestra con su UUID como nombre principal.

**Integración (MAP-248)**

- [x] **CA-17:** Para cada vertical, se completa al menos una reserva verificable de punta a punta:
      mapa → disponibilidad → selección → reserva → confirmación → (pago MOCK cuando la política del
      establecimiento lo habilita).

**Validación (MAP-235 / MAP-249)**

- [x] **CA-18:** Se ejecutan y registran `pnpm api:check`, `pnpm check`, `pnpm be:test`, `pnpm be:it`,
      pruebas de frontend y Playwright; lo no verificado se marca como pendiente en `tasks.md`.

## Fuera de alcance

Nuevas industrias, marketplace de plantillas, rediseño visual global, pasarelas bancarias reales,
arquitectura duplicada por vertical, cambiar la vertical de un establecimiento existente,
reserva múltiple de butacas desde el portal público (D6) y tarifas por noche.

## Notas de seguridad y datos

- Sin tablas nuevas ni migraciones: la vertical ya está persistida y aislada por tenant (RLS de
  `establishment`). El perfil se resuelve siempre a partir de un establecimiento leído con el
  tenant del JWT (staff) o del slug validado (público), nunca de un parámetro del cliente.
- Un establecimiento de otro tenant responde `404`, sin distinguirlo de uno inexistente.
- La flag no es fuente de datos de negocio: apagarla no borra ni transforma nada.
