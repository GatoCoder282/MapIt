# CU-23 — Autenticación de usuarios (HU-1.02)

> Alcance acumulado: MAP-46 completado. MAP-47 aprobado e implementado el
> 2026-09-10. La HU se entrega por partes y permanece incompleta.

## 1. Por qué

Validar las credenciales del staff y obtener una identidad confiable antes de
emitir tokens. Fuente: [MAP-45](https://matiasmv2005.atlassian.net/browse/MAP-45)
y su subtarea [MAP-46](https://matiasmv2005.atlassian.net/browse/MAP-46).

## 2. Actores

Usuario de staff registrado en un tenant.

## 3. Precondiciones

Existe un usuario con contraseña BCrypt en `app_user`. El correo es único por
tenant; por eso la autenticación recibe slug de empresa, correo y contraseña.
El slug selecciona la empresa al iniciar sesión: no concede acceso por sí mismo.

## 4. Flujo principal

1. Normalizar slug y correo (espacios externos y minúsculas).
2. Resolver el identificador del tenant desde su slug y buscar su usuario.
3. Comparar la contraseña sin modificarla con el hash BCrypt almacenado.
4. Comprobar que usuario y tenant estén activos.
5. Devolver ID de usuario, ID de tenant, correo, nombre y rol, sin contraseña/hash.
6. Emitir un JWT de acceso firmado a partir de esa identidad verificada.
7. Validar firma, emisor, expiración y claims obligatorios antes de aceptar el token.
8. Crear la autenticación de Spring Security y resolver el tenant desde el claim
   `tenant` durante la petición.

## 5. Flujos alternativos y errores

Credenciales vacías, usuario/tenant inexistente, contraseña incorrecta, usuario
inactivo o tenant suspendido producen el mismo error de autenticación, sin
revelar cuál condición falló. Una cuenta inexistente también hace una comparación
BCrypt ficticia. Los errores de infraestructura no se convierten en éxitos ni en
errores de credenciales.

Un JWT ausente, mal formado, expirado, alterado, firmado con otra clave, con otro
emisor o sin claims obligatorios no autentica la petición. El token completo no se
registra en logs ni aparece en mensajes de error.

## 6. Reglas de negocio

- El tenant y el rol del resultado provienen del registro persistido.
- Un correo puede existir en varias empresas con contraseñas diferentes.
- No se cambia la contraseña recibida; se rechazan entradas de más de 72 bytes
  UTF-8, límite de BCrypt, para evitar aceptar contraseñas por truncamiento.
- No se crean usuarios ni contraseñas de demostración en la migración.
- Ni los objetos de credenciales ni los registros de usuario imprimen secretos.
- El JWT de acceso usa HS256 con una clave de al menos 256 bits, emisor configurable
  y vigencia configurable; los valores por defecto locales son `mapit` y 15 minutos.
- Los claims obligatorios son `sub` (UUID del usuario), `tenant`, `role`, `email`,
  `iat`, `exp`, `iss`, `jti` y `typ=access`.
- El rol y el tenant usados por Spring Security salen únicamente del JWT validado.
- Esta entrega emite un token de acceso. La renovación mediante refresh token no
  forma parte de MAP-47 ni de las subtareas actuales de HU-1.02.

## 7. Criterios de aceptación de MAP-46

- [x] CA-1: Dado un usuario y tenant activos, cuando las credenciales son válidas,
      entonces se devuelve la identidad persistida sin secretos.
- [x] CA-2: Dadas credenciales incorrectas o cuentas no habilitadas, cuando se
      autentican, entonces se rechazan con el mismo tipo y mensaje de error.
- [x] CA-3: Dado el mismo correo en dos tenants, cuando se valida una contraseña,
      entonces solo se comprueba la cuenta de la empresa seleccionada.
- [x] CA-4: Dada una conexión sin tenant o del tenant A, cuando consulta `app_user`
      bajo un rol sin privilegios de bypass, entonces no ve filas del tenant B.
- [x] CA-5: Dada una autenticación terminada, cuando se reutiliza la conexión,
      entonces el tenant temporal no persiste fuera de su transacción.

## 8. Criterios de aceptación de MAP-47

- [x] CA-6: Dada una identidad autenticada, cuando se emite un token, entonces el
      JWT está firmado con HS256, contiene los claims obligatorios y vence según la
      configuración.
- [x] CA-7: Dado un JWT válido, cuando se valida, entonces se reconstruye la
      identidad confiable y Spring Security reconoce al usuario y su rol.
- [x] CA-8: Dado un JWT expirado, alterado, de otro emisor o incompleto, cuando se
      valida, entonces la petición permanece no autenticada y recibe HTTP 401.
- [x] CA-9: Dados dos tokens de tenants distintos, cuando se resuelve el tenant de
      cada petición, entonces cada una obtiene exclusivamente el claim `tenant` de
      su propio token y el contexto no se filtra entre peticiones.
- [x] CA-10: Dada una clave menor de 256 bits o una vigencia no positiva, cuando
      arranca la aplicación, entonces falla la configuración de JWT.

## 9. Fuera de alcance de esta entrega

MAP-48 (contrato y endpoint de login), MAP-49 (pantalla), MAP-50 (integración),
refresh token, cierre/revocación de sesiones, registro/recuperación de usuarios,
autorización detallada de recursos y privilegios transversales de Super Admin.
MAP-51 y MAP-52 mantienen sus pruebas de aceptación del flujo HTTP completo. Al
terminar MAP-47 todavía no existirá un endpoint de login: el token se probará desde
los servicios y la cadena de seguridad.

## 10. Impacto multi-tenant

`app_user` lleva `tenant_id`, índice `(tenant_id, id)`, unicidad
`(tenant_id, email)` y RLS forzada. La búsqueda previa al JWT utiliza JDBC en una
transacción independiente: resuelve el slug en la tabla global `tenant`, fija
`app.tenant_id` con `set_config(..., true)` y consulta por tenant y correo.
La transacción se cierra antes de devolver el resultado y restaura cualquier
contexto exterior. No depende del tenant de demostración ni deshabilita RLS.
Las rutas de staff futuras seguirán resolviendo el tenant desde el JWT.

MAP-47 agrega un contexto por petición que lee `tenant` solo después de validar la
firma y los demás claims. El contexto se limpia al terminar la petición. El CRUD
temporal público conserva el tenant `demo` mientras exista; no habilita un fallback
de header para rutas de staff.

## 11. Requerimientos relacionados

CU-23, HU-1.02; CU-24 en lo relativo a la identidad que consumirá la autorización.
