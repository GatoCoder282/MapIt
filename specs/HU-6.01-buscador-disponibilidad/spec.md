# HU-6.01 — Buscador de Disponibilidad

> **Estado:** Implementada localmente; pendiente PR/CI · **Ticket:** [MAP-227](https://matiasmv2005.atlassian.net/browse/MAP-227) · **Epic:** E06 — Portal Público

## Enunciado

Como cliente final, quiero consultar los elementos reservables disponibles de un establecimiento para una fecha, para elegir un espacio antes de iniciar una reserva pública.

## Contexto

Esta historia implementa el primer paso público del flujo de reservas. La consulta no requiere credenciales de staff. El tenant se identifica por su slug público y el backend devuelve únicamente datos mínimos de los elementos que pueden reservarse.

## Alcance

- Endpoint anónimo de disponibilidad por tenant, establecimiento y fecha.
- Pantalla pública que permite indicar esos datos, enviar la búsqueda y presentar resultados, estado vacío y errores.
- Un elemento es elegible cuando está activo, es reservable, tiene estado operativo `AVAILABLE` y no tiene una reserva vigente que se solape con el día consultado.
- La fecha representa el día calendario en la zona horaria del establecimiento y se evalúa como intervalo semiabierto `[inicioDelDía, inicioDelDíaSiguiente)`.

Fuera de alcance: crear reservas, mostrar datos personales o estados internos, y pagos.

## Criterios de aceptación

- [x] **CA-1:** Dado un tenant activo, establecimiento activo y fecha válida, cuando se consulta sin autenticación, entonces la API responde `200` con solo los elementos activos, reservables, en estado `AVAILABLE` y sin reservas vigentes que se solapen con el día local.
- [x] **CA-2:** Dado que ningún elemento cumple el criterio de disponibilidad, cuando se consulta, entonces la API responde `200` con una lista vacía y la pantalla muestra un estado vacío comprensible.
- [x] **CA-3:** Dado un tenant o establecimiento inexistente, suspendido, eliminado o ajeno al tenant indicado, cuando se consulta, entonces la API responde `404` sin revelar si el recurso existe en otro tenant.
- [x] **CA-4:** Dada una fecha ausente o con formato inválido, cuando se consulta la API, entonces responde `400` y no ejecuta una búsqueda parcial.
- [x] **CA-5:** Dado un error de red o del servidor, cuando la pantalla realiza la búsqueda, entonces mantiene la superficie pública, muestra un mensaje con opción de reintento y no presenta datos obsoletos como resultado de la nueva consulta.
- [x] **CA-6:** Dada una consulta válida, cuando se muestra el resultado, entonces solo se exponen el identificador y tipo del elemento; nunca aparecen datos de clientes, reservas ni información operativa interna.

## Notas de seguridad y datos

- La URL aporta `tenantSlug` y `establishmentSlug`; el cliente nunca envía `tenant_id`.
- El adaptador resuelve el tenant activo, fija el contexto RLS dentro de la transacción y filtra explícitamente por tenant y establecimiento.
- No se añaden tablas ni migraciones.
