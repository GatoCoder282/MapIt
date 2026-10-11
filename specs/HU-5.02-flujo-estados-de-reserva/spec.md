# HU-5.02 — Flujo de Estados de Reserva

> **Estado:** Aprobada para implementación · **Ticket:** MAP-193 · **Épica:** MAP-8 E05 — Reservas

## 1. Contexto

El personal necesita operar una reserva después de crearla. Esta historia habilita sus
transiciones de estado en backend y muestra el estado confirmado por la API en la consola.
La reserva y su persistencia se apoyan en HU-5.01.

## 2. Actores y autorización

ADMIN, MANAGER y STAFF pueden cambiar el estado de reservas de su tenant. Sin JWT, la API
responde `401`; otros roles reciben `403`. El tenant se obtiene exclusivamente del claim
`tenant` del JWT.

## 3. Flujo principal

1. El operador crea una reserva o visualiza la confirmación de una reserva recién creada.
2. La consola presenta el estado actual y las acciones permitidas que devuelve el backend.
3. El operador solicita una transición.
4. El backend localiza la reserva por tenant, establecimiento e identificador, valida la
   transición en dominio y persiste el nuevo estado junto con `updated_at` y `updated_by`.
5. La consola refleja únicamente la respuesta persistida; ante error conserva el estado
   anterior.

## 4. Estados y transiciones

| Desde       | Hacia                    |
| ----------- | ------------------------ |
| `CREATED`   | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `ACTIVE`, `CANCELLED`    |
| `ACTIVE`    | `RELEASED`, `CANCELLED`  |
| `RELEASED`  | Ninguna; terminal        |
| `CANCELLED` | Ninguna; terminal        |

La misma transición de estado no es una transición válida. El dominio es la única fuente de
la matriz; la respuesta API publica las acciones permitidas para que la consola no replique
la máquina.

## 5. Contrato y errores

`PATCH /api/v1/establishments/{establishmentId}/reservations/{reservationId}/status` acepta
`{ "status": "CONFIRMED" }` y responde `200` con la reserva actualizada y sus transiciones
permitidas. Estado desconocido o cuerpo inválido: `400 Problem Details`; transición inválida
o conflicto por actualización concurrente: `409 Problem Details`; reserva inexistente o de
otro tenant/establecimiento: `404`.

## 6. Criterios de aceptación

- [x] **CA-1:** Cada transición permitida de la matriz se acepta y queda persistida.
- [x] **CA-2:** Transiciones fuera de la matriz, repetición del estado y transiciones desde
      `RELEASED` o `CANCELLED` responden `409` sin alterar el estado persistido.
- [x] **CA-3:** Tenant o establecimiento ajeno e identificador inexistente responden `404` sin
      revelar la existencia de reservas externas.
- [x] **CA-4:** ADMIN, MANAGER y STAFF autenticados pueden cambiar estados; una sesión anónima
      recibe `401` y un rol no autorizado recibe `403`.
- [x] **CA-5:** La respuesta incluye estado vigente y transiciones derivadas en backend.
- [x] **CA-6:** La consola muestra el estado de la reserva y solo ofrece las acciones enviadas
      por backend; ante error conserva el estado previo e informa el resultado.

## 7. Fuera de alcance

- Historial/eventos de auditoría de transiciones.
- Listado o consulta de reservas ya persistidas; la consola administra la reserva en el flujo
  de confirmación que ya existe.
- Cambios automáticos al estado operativo de los elementos espaciales.
- Reservas públicas y transiciones disparadas por pagos.

## 8. Impacto multi-tenant

Las consultas y actualizaciones filtran `tenant_id` y establecimiento, y la transacción fija
el tenant local para RLS. Ningún tenant o actor se acepta en el request.
