# Refinamiento — Reserva rápida desde el mapa operativo

> Caso de uso base: [HU-5.01 — Creación de Reserva Interna](../spec.md).
> Alcance de la solicitud actual: creación desde monitoreo y notas opcionales persistentes. La ampliación de contrato y datos se limita a las notas.

## 1. Intención

Como operador del establishment, quiero crear desde el panel del mapa una reserva para el
elemento ya seleccionado, con los datos de contacto y el horario necesarios, para atender una
reserva sin abandonar la operación en vivo.

El panel **Reserva rápida** es el único formulario de alta interna en la consola. La búsqueda de
alternativas abre el mismo formulario con la mesa y el horario elegidos.

## 2. Actores y precondiciones

- ADMIN, MANAGER o STAFF autenticado, con un establecimiento operativo seleccionado.
- Existe un `SpaceElement` reservable seleccionado y visible en el plano.
- La reserva se crea para ese único elemento mediante el contrato vigente de reservas.

## 3. Flujo principal

1. El operador selecciona un elemento del mapa y abre **Reserva rápida**.
2. El panel muestra una ficha con nombre, ubicación y estado real del elemento.
3. El operador completa nombre, celular, email opcional, fecha, hora de inicio y personas.
4. La interfaz compara esos datos con el snapshot operativo real y muestra si el elemento está
   disponible para el intervalo solicitado.
5. El operador pulsa **Crear reserva** una sola vez.
6. La consola localiza o registra la persona y crea la reserva para el elemento seleccionado.
7. El backend vuelve a validar capacidad, preparación y solapamientos bajo bloqueo de recursos.
8. La consola confirma la reserva, limpia el borrador y mantiene el mapa actualizado.

## 4. Decisiones de alcance

### 4.1 Enfoque aprobado

Se reutiliza el contrato y los casos de uso existentes:

- `PeopleService` para localizar o registrar la persona.
- `ReservationsService` para crear la reserva.
- `OperationalMapData` para evaluar disponibilidad real.
- `CreateReservation` del backend como autoridad final ante conflictos.

No se duplican reglas de disponibilidad ni se introduce un endpoint de preflight.

### 4.2 Alternativas descartadas

| Alternativa                                                         | Motivo de descarte                                                                                             |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Mantener la búsqueda de mesas alternativas y solo cambiar el estilo | No implementa la creación de reserva solicitada.                                                               |
| Mostrar disponibilidad ficticia antes de consultar datos            | Puede inducir al operador a reservar sobre un estado falso.                                                    |
| Añadir un control de hora de fin                                    | La referencia no lo contiene; el intervalo de reserva rápida se deriva de la política existente de 90 minutos. |

## 5. Reglas de negocio

- **RR-1:** solo se crea una reserva para el elemento seleccionado; el formulario no sustituye
  ni modifica la mesa.
- **RR-2:** nombre y celular son obligatorios; email es opcional. El teléfono se envía como
  texto E.164 con prefijo internacional.
- **RR-3:** la fecha y la hora local se convierten al instante del establecimiento antes de
  enviarse.
- **RR-4:** el intervalo enviado es `[inicio, inicio + 90 minutos)`. La duración no se edita en
  esta variante.
- **RR-5:** el número de personas debe ser un entero entre 1 y la capacidad real del elemento.
- **RR-6:** la disponibilidad mostrada usa el snapshot operativo real (estado, capacidad,
  preparación y reservas solapadas). Nunca se presenta un éxito simulado.
- **RR-7:** la comprobación del cliente es informativa; el backend sigue siendo la autoridad y
  puede responder `409` si cambia el estado entre la comprobación y el envío.
- **RR-8:** mientras hay una escritura en curso, el botón permanece deshabilitado y no se envía
  una segunda solicitud.
- **RR-9:** un `409` conserva el borrador, explica el conflicto y refresca el snapshot; no se
  crea una reserva parcial.
- **RR-10:** crear una reserva futura no cambia el estado operativo del elemento a ocupado.
- **RR-11:** las notas son opcionales, limitadas a 1000 caracteres y se guardan con la reserva.

## 6. Criterios de aceptación

- [ ] **CA-RQ-1:** Dado un elemento seleccionado, cuando se abre Reserva rápida, entonces se
      muestran su nombre, ubicación, estado real y una ficha de creación claramente asociada.
- [ ] **CA-RQ-2:** Dado un formulario incompleto, cuando se intenta enviar, entonces no se
      realiza ninguna escritura y los campos requeridos quedan asociados a su error.
- [ ] **CA-RQ-3:** Dado un contacto, fecha, hora y grupo válidos, cuando el snapshot operativo
      confirma disponibilidad, entonces el panel lo comunica mediante texto y estado visible.
- [ ] **CA-RQ-4:** Dado un elemento sin capacidad, con conflicto de preparación o con reserva
      solapada, cuando se consultan los mismos datos, entonces la disponibilidad no se presenta
      como favorable.
- [ ] **CA-RQ-5:** Dado un formulario válido, cuando se envía, entonces se crea o localiza una
      persona y se crea una reserva para el único elemento seleccionado con `partySize`, inicio y
      fin derivado de 90 minutos.
- [ ] **CA-RQ-6:** Dado un conflicto `409` del backend, cuando llega la respuesta, entonces se
      informa el conflicto, se conserva el borrador y se refresca el snapshot.
- [ ] **CA-RQ-7:** Dado un envío en curso, cuando se vuelve a activar el botón o se envía el
      formulario, entonces no se ejecuta una segunda escritura.
- [ ] **CA-RQ-8:** Dado una reserva futura creada correctamente, entonces el estado operativo del
      elemento no cambia a `OCCUPIED`.
- [ ] **CA-RQ-9:** El panel conserva el patrón accesible de pestañas, etiquetas programáticas,
      foco visible, objetivos táctiles de al menos 44 px y estados anunciables.
- [ ] **CA-RQ-10:** La interfaz omite hora de fin y duración. Si se indica una nota, se conserva en la reserva.
- [ ] **CA-RQ-11:** La comprobación visual contra la referencia respeta una tolerancia máxima
      del 2 % y adjunta evidencia de Playwright.
- [x] **CA-RQ-12:** Dado un enlace anterior a la página de alta, cuando se abre, entonces se
      redirige al mapa y se selecciona la mesa si pertenece al establecimiento activo.

## 7. Fuera de alcance

- Reservas de varios elementos, confirmación, activación, liberación o cancelación.
- Modificar el estado de mesa por una reserva futura.
- Añadir dependencias, animaciones o un sistema de componentes nuevo.

## 8. Impacto multi-tenant

Las notas se guardan en la fila de reserva existente, protegida por RLS. Los endpoints de staff derivan el tenant del
JWT; el frontend nunca envía `tenantId`. El establecimiento operativo determina los IDs de
elemento y reserva.

## 9. diseño aplicado

La especificación visual vive en:

- `apps/console/design/design.md`
- `apps/console/design/design-guidelines.md`
- `apps/console/design/design-components.md`

La implementación reutiliza tokens globales, controles nativos, `@lucide/angular` y la
estructura Angular feature-first existente. No se crea un componente UI-kit para un único uso.
