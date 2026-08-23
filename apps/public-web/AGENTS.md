# Public-web (cliente final) — contexto para agentes

## Dónde estás

Angular 22, superficie **pública**: consulta de disponibilidad, creación de reserva,
pago de anticipo por QR e historial (CU-15…CU-18).
Lo que NO va aquí: nada de staff (editor, dashboard, administración) — eso es `apps/console`.

## Diferencias clave con la consola

|                       | console                | public-web                                    |
| --------------------- | ---------------------- | --------------------------------------------- |
| Autenticación         | JWT de staff           | **anónimo** hasta confirmar la reserva        |
| Tenant                | claim `tenant` del JWT | **slug del establecimiento en la URL**        |
| Presupuesto de bundle | 1 MB                   | **800 kB** — es cara pública, el peso importa |
| SSR                   | no                     | candidato futuro (SEO de disponibilidad)      |

## Reglas duras

Las mismas del style guide que en la consola (ver `apps/console/AGENTS.md`), más:

1. **No asumas que hay usuario autenticado.** El cliente final es anónimo.
2. **No importes `@mapit/auth`**: es para staff.
3. **Cuidado con lo que se expone.** Esta app es pública: nunca muestres datos internos
   de operación (ocupación en vivo de otras mesas, datos de otros clientes, precios de
   coste). El backend debe filtrarlos, pero no los pidas siquiera.
4. El tenant llega por el slug de la URL. Ese es el **único** caso en que el tenant no
   sale de un JWT, y por eso el backend lo valida contra `tenant.slug`.

## Features previstas

```
features/
├── availability/     CU-15  consultar disponibilidad
├── booking/          CU-16  crear reserva
├── payment/          CU-17  anticipo por QR (detrás de la flag `payments.qr`)
└── my-reservations/  CU-18  historial
```

## Comandos

```bash
pnpm fe:public      # dev server en :4300
pnpm fe:test
```
