# HU-7.08 — Observabilidad operativa y salud de tenants para Super Admin

> Jira: [MAP-301](https://matiasmv2005.atlassian.net/browse/MAP-301) · Subtareas MAP-308 a MAP-313

## Enunciado

Como SUPER_ADMIN quiero observar salud y uso agregado de tenants y establecimientos para detectar
incidencias y priorizar soporte sin acceder a datos personales, reservas individuales ni
información financiera sensible.

## Indicadores, fuentes y granularidad (MAP-308)

| Indicador                                   | Fuente                             | Granularidad                  |
| ------------------------------------------- | ---------------------------------- | ----------------------------- |
| Empresas activas y suspendidas              | `tenant.status`                    | actual                        |
| Establecimientos vivos y por vertical       | `establishment`                    | actual                        |
| Reservas creadas por estado                 | `reservation.created_at`, `status` | ventana de 7 o 30 días        |
| Reservas creadas por día (solo plataforma)  | `reservation.created_at`           | día UTC                       |
| Última actividad                            | última reserva creada              | **día**, nunca hora           |
| Entregas en tiempo real pendientes/fallidas | `realtime_event_outbox`            | actual                        |
| Método de pago habilitado                   | `merchant_payment_method.enabled`  | sí o no                       |
| Base de datos                               | consulta de prueba                 | actual                        |
| Peticiones, errores 5xx y latencia media    | métricas HTTP del proceso          | desde el arranque del proceso |

**Salud técnica y actividad comercial son cosas distintas:** una empresa sin reservas no genera
alerta. Si no se puede leer una fuente se muestra «sin datos», no cero.

## Privacidad

- **P-1** Ninguna respuesta contiene nombres o contactos de clientes o personal, correos,
  teléfonos, reservas individuales, medios de pago, importes, QR ni credenciales. Solo el nombre
  comercial y el identificador público (slug) de la empresa.
- **P-2** Un conteo de reservas entre 1 y 4 se oculta («menos de 5»). Si en un desglose queda
  oculto un solo valor, se oculta además el siguiente más pequeño (o el total) para que no se
  deduzca restando. El cero se muestra.
- **P-3** El aislamiento no se desactiva: cada empresa se agrega fijando su propio contexto RLS.
- **P-4** Cada consulta queda registrada (quién, cuándo, qué vista y sobre qué empresa) en un
  registro que la aplicación no puede modificar ni borrar. Se conserva sin límite en este MVP.

## Reglas

- **RN-1** Solo SUPER_ADMIN: 401 sin JWT; 403 con ADMIN, MANAGER o STAFF.
- **RN-2** Todo depende de `mapit.s6.tenant-observability`, **OFF por defecto**: apagada responde
  404 y no registra nada. La flag no sustituye autorización ni las reglas de privacidad.
- **RN-3** Solo lectura. El tenant técnico `platform` no aparece.

## Criterios de aceptación

- [ ] **CA-1:** sin JWT, 401; con ADMIN o STAFF, 403.
- [ ] **CA-2:** con la flag apagada, 404 `tenant-observability-disabled`.
- [ ] **CA-3:** el resumen muestra empresas, establecimientos, reservas por estado y por día,
      salud de base de datos y API, ventana y hora de generación.
- [ ] **CA-4:** el listado de empresas se pagina y filtra por nombre y estado, con conteos,
      última actividad por día y alertas operativas.
- [ ] **CA-5:** el detalle muestra solo agregados de esa empresa; los de otra no se mezclan y un
      slug inexistente responde 404.
- [ ] **CA-6:** ninguna respuesta contiene datos personales ni financieros sembrados en la base.
- [ ] **CA-7:** los conteos pequeños se suprimen también contra la deducción por resta.
- [ ] **CA-8:** cada consulta queda registrada y el registro no se puede alterar.
- [ ] **CA-9:** la Console distingue cargando, error, sin datos, actividad baja, falla técnica y
      sección no habilitada, en es, en y ja, y en pantallas angostas.

## Fuera de alcance

Impersonación, edición de datos de terceros, BI financiero, datos de clientes o empleados,
exportación, comparación pública y alertas por notificación (MAP-286).

## Límites conocidos

- Agregar toda la plataforma recorre las empresas una a una: suficiente para el MVP, a revisar si
  crecen a cientos.
- Comparar ventanas de 7 y 30 días permite acotar diferencias; el umbral reduce el riesgo, no lo
  elimina.
