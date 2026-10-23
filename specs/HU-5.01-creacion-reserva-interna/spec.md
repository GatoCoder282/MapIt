# HU-5.01 — Creación de Reserva Interna

> **Estado:** Aprobada · **Creada:** 2026-10-03 · **Responsable:** Christian Ferrufino

## Enunciado

Como operador, quiero crear reservas internas para clientes sobre los recursos espaciales
disponibles, para organizar la ocupación futura del establecimiento sin duplicar un recurso
en el mismo horario.

Fuente funcional: [MAP-192](https://matiasmv2005.atlassian.net/browse/MAP-192).

---

## 1. Por qué (contexto)

El personal necesita registrar desde la consola las reservas recibidas por teléfono, mensaje
o atención presencial. Sin este flujo, esas reservas quedan fuera de MapIt y el equipo puede
asignar el mismo elemento a más de un cliente durante el mismo intervalo.

Esta historia cubre CU-11 y CU-12 del roadmap: registrar o localizar al cliente y crear una
reserva asociada a uno o más `SpaceElement`.

## 2. Actores

| Rol     | Qué hace en este caso de uso                            |
| ------- | ------------------------------------------------------- |
| ADMIN   | Crea reservas internas dentro de su tenant.             |
| MANAGER | Gestiona y crea reservas del establecimiento.           |
| STAFF   | Registra clientes y crea reservas durante la operación. |

`SUPER_ADMIN` no opera reservas de tenants y el cliente final utiliza un flujo público
distinto, cubierto por CU-16.

## 3. Precondiciones

- El actor inició sesión y pertenece a un tenant activo.
- El establecimiento existe, está activo y pertenece al tenant autenticado.
- Cada elemento solicitado existe, está activo, es reservable y pertenece al mismo
  establecimiento y tenant.
- La fecha de inicio y la fecha de fin representan instantes válidos, con inicio anterior al
  fin.
- La reserva queda asociada a una persona existente o a una persona creada durante el flujo.

## 4. Flujo principal

1. El actor abre el formulario de reserva interna en la consola.
2. Busca al cliente por sus datos disponibles.
3. Si el cliente no existe, registra sus datos básicos.
4. Selecciona el establecimiento, el intervalo y uno o más elementos espaciales.
5. El backend obtiene el tenant exclusivamente del JWT y valida todos los recursos.
6. El sistema comprueba que ninguno de los elementos tenga una reserva vigente que se
   superponga con el intervalo solicitado.
7. El sistema crea la reserva en estado `CREATED` y la asocia al cliente y a los elementos.
8. La API devuelve la reserva creada y la consola confirma el resultado.

## 5. Flujos alternativos y errores

| Situación                                                                    | Comportamiento esperado                                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| No existe el cliente                                                         | El actor puede registrarlo sin abandonar el flujo de reserva.                     |
| Inicio igual o posterior al fin                                              | Respuesta `400` con Problem Details; no se persiste nada.                         |
| Lista de elementos vacía o repetida                                          | Respuesta `400`; no se persiste nada.                                             |
| Persona, establecimiento o elemento inexistente, inactivo o ajeno al tenant  | Respuesta `404` sin revelar la existencia del recurso.                            |
| Un elemento pertenece a otro establecimiento                                 | Respuesta `400`; no se persiste nada.                                             |
| Algún elemento ya está reservado en parte del intervalo                      | Respuesta `409` determinista con Problem Details; no se crea una reserva parcial. |
| Reserva consecutiva, cuyo inicio coincide con el fin de otra                 | Se permite porque los intervalos no se superponen.                                |
| Actor sin un rol permitido                                                   | Respuesta `403`; sin JWT responde `401`.                                          |
| Dos solicitudes concurrentes intentan reservar el mismo elemento e intervalo | Como máximo una se confirma; la otra responde `409`.                              |

## 6. Reglas de negocio

- **RN-1:** El identificador y el tenant de la reserva los decide el backend; nunca se
  aceptan desde el cliente.
- **RN-2:** Una reserva interna pertenece exactamente a un establecimiento, una persona y
  uno o más elementos espaciales de ese establecimiento.
- **RN-3:** El intervalo se interpreta como `[inicio, fin)`: incluye el inicio y excluye el
  fin. Dos reservas son consecutivas cuando una termina exactamente al comenzar la otra.
- **RN-4:** Existe superposición cuando `nuevoInicio < finExistente` y
  `inicioExistente < nuevoFin` sobre al menos un mismo elemento.
- **RN-5:** La creación es atómica: si falla una persona, un elemento o una validación, no se
  persiste ninguna parte de la reserva.
- **RN-6:** Toda reserva nueva nace en estado `CREATED`. Las transiciones posteriores
  pertenecen a CU-13.
- **RN-7:** La persona y todos los elementos deben pertenecer al tenant autenticado; todos
  los elementos deben pertenecer al establecimiento de la reserva.
- **RN-8:** La validación de disponibilidad debe estar protegida frente a solicitudes
  concurrentes, no solo mediante una consulta previa en la aplicación.
- **RN-9:** Fechas e instantes se almacenan de forma inequívoca; la zona horaria del
  establecimiento se usa únicamente para presentar y capturar la hora local.
- **RN-10:** Los elementos repetidos en una misma solicitud se rechazan en lugar de crear
  asociaciones duplicadas.

## 7. Criterios de aceptación

- [x] **CA-1:** Dado un ADMIN, MANAGER o STAFF autenticado, una persona válida y elementos
      disponibles de su tenant, cuando crea una reserva con un intervalo válido, entonces
      recibe `201` y la reserva se persiste en estado `CREATED` con todas sus asociaciones.
- [x] **CA-2:** Dado un cliente inexistente, cuando el actor registra sus datos básicos desde
      el flujo y luego crea la reserva, entonces ambas operaciones terminan correctamente y
      la reserva referencia a la persona creada.
- [x] **CA-3:** Dada una reserva existente para un elemento, cuando se solicita otra cuyo
      intervalo se superpone total o parcialmente, entonces responde `409` y no se persiste
      ninguna reserva ni asociación adicional.
- [x] **CA-4:** Dada una reserva existente que termina en un instante, cuando otra comienza
      exactamente en ese instante sobre el mismo elemento, entonces la nueva reserva se
      permite.
- [x] **CA-5:** Dada una solicitud con varios elementos, cuando cualquiera de ellos presenta
      un conflicto, entonces se rechaza la solicitud completa sin reservar los demás.
- [x] **CA-6:** Dado un identificador de persona, establecimiento o elemento de otro tenant,
      cuando el actor intenta crear la reserva, entonces responde `404` y no revela ni
      modifica datos externos.
- [x] **CA-7:** Dado un intervalo inválido, una lista vacía o identificadores repetidos,
      cuando se envía la solicitud, entonces responde `400` con Problem Details.
- [x] **CA-8:** Dado un usuario sin un rol permitido, cuando invoca el endpoint, entonces
      responde `403`; sin autenticación responde `401`.
- [x] **CA-9:** Dadas dos solicitudes concurrentes para el mismo elemento e intervalo,
      cuando ambas se procesan, entonces solo una crea la reserva y la otra responde `409`.
- [x] **CA-10:** Dado el formulario de consola, cuando la API acepta la reserva, entonces se
      muestra la confirmación y se limpia o cierra el formulario; ante `400`, `404` o `409`,
      conserva los datos útiles e informa el error correspondiente.

## 8. Fuera de alcance

- Confirmar, activar, liberar o cancelar una reserva; corresponde a CU-13.
- Reservas públicas sin sesión de staff; corresponde a CU-16.
- Pagos y anticipos; corresponde a CU-17.
- Historial de reservas del cliente final; corresponde a CU-18.
- Cambiar automáticamente el estado operativo del elemento por el solo hecho de crear una
  reserva futura.
- Políticas particulares por vertical, como turnos de restaurante, eventos o noches de
  hotel; se incorporarán en CU-19 a CU-22 sobre el intervalo común.

## 9. Impacto multi-tenant

- Las tablas nuevas `person`, `reservation` y la asociación entre reservas y elementos
  llevan `tenant_id NOT NULL`, índice `(tenant_id, id)` cuando corresponde y RLS forzada.
- Todas las consultas filtran explícitamente por `tenant_id`, además de la protección RLS.
- El tenant proviene del claim `tenant` del JWT y no aparece en el cuerpo, la ruta ni un
  encabezado aportado por el cliente.
- Las pruebas de integración incluyen aislamiento entre dos tenants y verifican que una
  consulta sin tenant en sesión no devuelva filas.

## 10. Requerimientos relacionados

- **RF08:** registrar clientes con datos básicos.
- **RF09:** crear reservas asociadas a un cliente y a elementos del mapa.
- **RF17:** aislar los datos entre tenants.
- **RF22:** admitir intervalos temporales compatibles con rangos de fechas.
- **RF23:** admitir elementos individuales como ubicaciones numeradas.
- **RNF05:** garantizar integridad relacional en PostgreSQL.
- **RNF11:** aplicar aislamiento en aplicación y base de datos.
- **RNF13:** definir primero el contrato OpenAPI.

## 11. Trazabilidad Jira

| Subtarea | Entrega                                                   |
| -------- | --------------------------------------------------------- |
| MAP-208  | Entidad de dominio `Reservation` y sus invariantes.       |
| MAP-209  | Migración Flyway de reservas y asociaciones.              |
| MAP-210  | Verificación e implementación de `Person` y su registro.  |
| MAP-211  | Caso de uso de creación y validación de no superposición. |
| MAP-212  | Contrato OpenAPI y endpoint `POST` de reserva.            |
| MAP-213  | Búsqueda y alta de cliente en la consola.                 |
| MAP-214  | Integración del formulario con el cliente API.            |
| MAP-215  | Pruebas de integración del flujo completo.                |
| MAP-216  | Garantía de concurrencia para evitar dobles reservas.     |
