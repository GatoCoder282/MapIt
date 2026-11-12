# HU-1.03 — Inicio de sesión unificado (MAP-256)

Como usuario de Console, quiero iniciar sesión con mi correo y contraseña desde
`/login` para entrar a la empresa a la que pertenece mi cuenta.

## Criterios de aceptación

- [x] Dada una cuenta activa en una empresa activa, cuando ingreso sus credenciales
      en `/login`, entonces entro directamente con el rol y tenant de esa cuenta.
- [x] Dadas credenciales incorrectas o una cuenta o empresa inactiva, cuando intento
      iniciar sesión, entonces recibo un error genérico.
- [x] Dado un correo registrado, cuando intento crear una segunda cuenta con ese correo
      en cualquier empresa, entonces PostgreSQL rechaza el duplicado.
- [x] Dado un enlace de invitación vigente, cuando activo mi cuenta, entonces puedo
      iniciar sesión por `/login`.
- [x] Dado un SUPER_ADMIN activo, cuando ingreso sus credenciales en `/login`,
      entonces entro al panel de plataforma con el JWT del tenant `platform`.

## Alcance

Cada cuenta de Console pertenece a un tenant. `/login` es la única entrada y
`POST /api/v1/auth/global-login` es el único endpoint de autenticación. El correo se normaliza antes de
guardar o buscar. El login entra directamente, sin selector ni vinculación de cuentas.
Se mantiene la selección operativa de establecimientos dentro de una empresa.
El registro autónomo de empresas queda fuera del ticket.

## Aislamiento de los contadores de login

V33 almacena los contadores previos al JWT en `auth_attempt_limit`, bajo el
tenant técnico `platform`. La tabla aplica RLS al rol de runtime. Una
transacción sin tenant o con el tenant de una empresa no puede consultar los
contadores de `platform`. Solo una transacción de `platform` puede escribirlos.
