# CU-23 — Autenticación de usuarios (HU-1.02)

> Alcance acumulado: MAP-46, MAP-47, MAP-48 y MAP-49 completados. La HU se entrega por
> partes y permanece incompleta.

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
9. Recibir slug de empresa, correo y contraseña mediante `POST /api/v1/auth/login`.
10. Autenticar las credenciales, emitir el access token y devolverlo junto con la
    identidad segura del usuario.

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
- La respuesta de login incluye `accessToken`, `tokenType=Bearer`, `expiresAt` y
  los datos públicos del usuario: ID, tenant, correo, nombre completo y rol.
- El endpoint de login es público porque todavía no existe una sesión; cualquier
  otro endpoint conserva la política de denegar por defecto.
- Contraseña incorrecta, usuario inexistente, cuenta inactiva y tenant suspendido
  producen el mismo Problem Details HTTP 401, sin indicar qué dato falló.

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

## 9. Criterios de aceptación de MAP-48

- [x] CA-11: Dadas credenciales válidas, cuando se invoca
      `POST /api/v1/auth/login`, entonces responde HTTP 200 con Bearer token,
      expiración e identidad pública, y el token corresponde a esa identidad.
- [x] CA-12: Dadas credenciales incorrectas o una cuenta no habilitada, cuando se
      invoca el login, entonces responde HTTP 401 con Problem Details y el mismo
      mensaje genérico para todos los casos.
- [x] CA-13: Dado un cuerpo ausente o campos con formato inválido, cuando se invoca
      el login, entonces responde HTTP 400 y no intenta autenticar.
- [x] CA-14: Dado un cliente sin sesión previa, cuando invoca el login, entonces la
      cadena de seguridad permite acceder al endpoint sin Bearer token.
- [x] CA-15: Dada cualquier respuesta o error del login, entonces nunca contiene la
      contraseña ni el hash BCrypt.

## 10. Fuera de alcance de esta entrega

MAP-50 (integración Angular), refresh token, cierre/revocación
de sesiones, recuperación de contraseña, limitación distribuida de intentos,
autorización detallada de recursos y privilegios transversales de Super Admin.
MAP-51 y MAP-52 conservan las pruebas de aceptación asignadas del flujo completo.

## 11. Impacto multi-tenant

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

MAP-48 recibe `tenantSlug` únicamente para localizar las credenciales antes de la
autenticación. La respuesta y el JWT toman `tenantId` del usuario persistido; el
cliente no puede elegir ni sobrescribir el claim `tenant`.

## 12. Requerimientos relacionados

CU-23, HU-1.02; CU-24 en lo relativo a la identidad que consumirá la autorización.

## 13. MAP-49 — Pantalla de login

Referencia visual: captura proporcionada por el usuario el 2026-09-11.
Estado: aprobada por el usuario e implementada.

- Escritorio: composición de dos paneles, aproximadamente 40 % / 60 %.
  Izquierda con fondo lavanda, título «Opera tu espacio en tiempo real» con
  énfasis azul y una ilustración de distribución de mesas sobre fondo oscuro.
  Derecha blanca, marca Mapit centrada y formulario de ancho limitado.
- Reproducir jerarquía, espaciado, bordes suaves y azul intenso de la referencia.
- Formulario: «Bienvenido de nuevo», texto introductorio, correo electrónico,
  contraseña con control de visibilidad y botón «Iniciar sesión».
- Mantener «Recordarme», «¿Olvidaste tu contraseña?» y «Solicita acceso» de la
  referencia. En esta entrega no deben simular una sesión ni una recuperación:
  mostrarán información accesible sobre su disponibilidad cuando corresponda.
- En móviles, priorizar el formulario y reducir u ocultar el panel ilustrativo,
  sin desplazamiento horizontal.
- MAP-49 implementa presentación y validación local. El envío real, gestión del
  token, sesión y navegación autenticada corresponden a MAP-50.
- Se obtiene tenantSlug desde /empresa/:tenantSlug/login para conservar los dos
  campos del diseño aprobado. /login permite revisar la pantalla y solicita el
  enlace de empresa al continuar. No se deduce el tenant del correo ni se fija a demo.

### Criterios de aceptación

- [x] CA-16: Dada una pantalla de escritorio, cuando se abre el login, entonces
      muestra la composición y textos de la referencia con formulario legible.
- [x] CA-17: Dado un móvil de 360 px de ancho, cuando se abre el login, entonces
      todos los controles son utilizables sin desplazamiento horizontal.
- [x] CA-18: Dados campos vacíos o un correo inválido, cuando se intenta continuar,
      entonces muestra mensajes en español asociados a los campos afectados.
- [x] CA-19: Dada una contraseña escrita, cuando se alterna su visibilidad,
      entonces conserva el valor y anuncia el estado del control accesiblemente.
- [x] CA-20: Dado un usuario de teclado, cuando recorre el formulario, entonces
      dispone de etiquetas, orden de foco y foco visible en todos los controles.
- [x] CA-21: Dado un formulario válido, cuando se pulsa iniciar sesión en MAP-49,
      entonces no se presenta un éxito ficticio ni se guardan contraseñas o JWT.

## 14. MAP-50 — Integrar login con API

Estado: aprobada por el usuario e implementada. Fuente: MAP-50 «Integrar login con API»,
consultado en Jira; no tiene descripción adicional. MAP-51 y MAP-52 conservan
sus pruebas de aceptación específicas.

### Comportamiento

- Enviar tenantSlug de la URL, correo normalizado y contraseña sin modificar a
  POST /api/v1/auth/login usando el cliente generado del contrato de MAP-48.
- Durante la solicitud, indicar «Iniciando sesión…» y evitar envíos duplicados.
- Al recibir 200, conservar token, expiración e identidad pública, borrar la
  contraseña del formulario y navegar a /home. Inicio mostrará nombre, empresa,
  rol y la acción «Cerrar sesión».
- Sin Recordarme, la sesión usa sessionStorage; con Recordarme, localStorage.
  Ninguna opción almacena la contraseña ni extiende la expiración del JWT.
  Al restaurar sesión, rechazar datos inválidos o expirados. Si el navegador no
  permite almacenamiento, mantener sesión en memoria e informar que no persistirá.
- Añadir Bearer únicamente a peticiones dirigidas al origen y prefijo de la API
  configurada; excluir login. Nunca enviar el token a otros servicios ni en URLs.
- Proteger /home y /demo-items en la consola. Sin sesión vigente, regresar al login
  de la última empresa conocida o a /login. Los guards no sustituyen la autorización
  del backend; identidad y rol del navegador solo sirven a la presentación.
- Al expirar el token o recibir 401 de una petición autenticada, limpiar la sesión
  y pedir nuevo inicio. Un 401 tardío de una sesión antigua no elimina una nueva.
  Un 403 indica falta de permiso y no cierra una sesión válida.
- Cerrar sesión elimina el almacenamiento local de sesión y vuelve al login de
  la empresa. No revoca el token en el servidor: continúa válido hasta expirar.
- Credenciales rechazadas: mensaje genérico. Error de red o servidor: mensaje
  diferenciado en español, sin mostrar detalles internos. Permitir reintentar.
- La pantalla /login sin slug sigue solicitando el enlace de la empresa; no
  inventar una empresa por defecto. El diseño de MAP-49 se conserva.
- Renovación, revocación en servidor, recuperación de contraseña y solicitudes de
  acceso siguen fuera de alcance. El token persistido es accesible a JavaScript;
  la alternativa con cookie HttpOnly requeriría otro contrato de autenticación.

### Criterios de aceptación

- [x] CA-22: Dadas credenciales válidas y enlace de empresa, cuando se envía el
      formulario, entonces entra a Inicio mostrando la identidad devuelta por API.
- [x] CA-23: Dada una petición pendiente, cuando se intenta reenviar, entonces no
      se duplica la petición y el formulario indica su estado de carga.
- [x] CA-24: Dado un rechazo 401 o un fallo de conexión, cuando termina el intento,
      entonces muestra el error correspondiente y permite reintentar.
- [x] CA-25: Dada una sesión vigente, cuando se consulta la API configurada,
      entonces adjunta Bearer; para login y otros orígenes no adjunta el token.
- [x] CA-26: Dada una recarga o reapertura, cuando se restaura la sesión, entonces
      respeta Recordarme y descarta sesiones corruptas o vencidas.
- [x] CA-27: Dada una ruta privada, cuando falta sesión, expira o se rechaza el
      token utilizado, entonces vuelve al login y limpia la sesión pertinente.
- [x] CA-28: Dada una sesión iniciada, cuando se cierra, entonces elimina sus datos
      persistidos y las rutas privadas requieren autenticarse de nuevo.
- [x] CA-29: Dado cualquier resultado del login, entonces la contraseña nunca se
      persiste ni se incluye en URLs o mensajes de diagnóstico.
