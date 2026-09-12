# CU-23 — Tareas de MAP-46 a MAP-48

- [x] Leer MAP-45/MAP-46 y delimitar las subtareas posteriores.
- [x] Escribir especificación y plan antes de implementar.
- [x] Implementar dominio y caso de uso de autenticación.
- [x] Implementar BCrypt y consulta transaccional de credenciales.
- [x] Crear migración con RLS y actualizar DBML.
- [x] Verificar reglas, persistencia, aislamiento y arquitectura.
- [x] Dejar la entrega para revisión del usuario.

## MAP-47 — Generación y validación de token

- [x] Leer MAP-47 y delimitar su alcance frente a MAP-48–MAP-52.
- [x] Aprobar criterios de aceptación y plan de MAP-47.
- [x] Definir puertos y modelos de token en dominio.
- [x] Implementar el caso de uso de emisión de access token.
- [x] Implementar firma y validación JWT HS256 con configuración segura.
- [x] Integrar Bearer JWT con Spring Security y el contexto del tenant.
- [x] Verificar claims, expiración, alteración, HTTP 401 y aislamiento por petición.
- [x] Ejecutar comprobaciones del backend y documentar la entrega.

## MAP-48 — Endpoint de login

- [x] Leer MAP-48 y delimitar su alcance frente a MAP-49–MAP-52.
- [x] Aprobar criterios de aceptación y plan de MAP-48.
- [x] Definir `POST /auth/login` y sus modelos en OpenAPI.
- [x] Validar el contrato y regenerar el cliente Angular.
- [x] Implementar el controlador y el mapeo RFC 9457.
- [x] Declarar el login como ruta pública sin abrir otras rutas.
- [x] Verificar éxito, validación, error uniforme y ausencia de secretos.
- [x] Reconstruir Docker, probar el flujo HTTP y documentar la entrega.

## Notas de ejecución

- Atlassian Rovo falló al leer el sitio; se consultaron las tarjetas desde Jira
  en la sesión del navegador. MAP-45 figura en Listo con 0/7 subtareas completadas;
  MAP-46 figura en Por hacer y no contiene descripción adicional.
- El usuario autorizó implementar solo MAP-46 y revisar antes de continuar.
- La historia completa no se considera terminada con esta entrega.

- Implementados `AuthenticateUser`, modelos y puertos de dominio, verificación
  BCrypt y repositorio JDBC con contexto transaccional independiente.
- Creada V3 para `app_user`, actualizados DBML y ADR-0008 (propuesto para revisión).
- Verificación exitosa: 17 pruebas de aplicación, 3 de BCrypt, 8 de integración
  PostgreSQL y 9 reglas/comprobaciones de ArchUnit; 37 en total, sin fallos ni omisiones.
- La integración arrancó el contexto Spring Boot completo y aplicó V1–V3 con
  Flyway. La aplicación de pruebas utilizó un rol `NOSUPERUSER NOBYPASSRLS`.
- Docker no estaba disponible: se utilizó una instancia desechable de PostgreSQL 15
  en `127.0.0.1:55446`, sin acceder a la base del proyecto. Por defecto, la prueba
  usa Testcontainers con PostgreSQL 16; también admite `MAPIT_TEST_JDBC_URL`,
  `MAPIT_TEST_DB_USER` y `MAPIT_TEST_DB_PASSWORD` para una BD desechable externa.
- Comando ejecutado (con la URL temporal en el entorno):
  `node tools/scripts/gradle.mjs test :bootstrap:integrationTest --tests com.mapit.identity.AuthenticationIntegrationTest :modules:identity:identity-domain:spotlessCheck :modules:identity:identity-application:spotlessCheck :modules:identity:identity-infrastructure:spotlessCheck :bootstrap:spotlessCheck`.
- Formato Java/Gradle y Markdown comprobado. No se ejecutó `pnpm check` completo:
  esta entrega parcial no modifica frontend ni contrato; no se realiza push.
- MAP-47–MAP-50 y las pruebas de aceptación HTTP permanecen pendientes. No se
  modificaron estados ni se publicaron comentarios en Jira.

### Preparación de MAP-47

- MAP-47 se titula “Configurar generación/validación de token” y no tiene una
  descripción adicional en Jira. MAP-48 contiene el endpoint de login, por lo que
  MAP-47 no cambia todavía el contrato HTTP.
- Se propone un access token HS256 de 15 minutos con claims de usuario, tenant y
  rol. Refresh token, revocación y endpoint HTTP quedan fuera de esta subtarea.

### Ejecución de MAP-47

- Implementados puertos de emisión/validación, principal autenticado y token opaco
  con representación redactada en identity-domain; `IssueAccessToken` quedó en
  application y JJWT permanece aislado en infrastructure.
- El adaptador firma exclusivamente con HS256 y valida firma, emisor, tipo, fechas,
  identificador y claims de usuario, tenant, rol y correo. La configuración rechaza
  claves menores de 32 bytes, emisores vacíos y vigencias no positivas.
- `JwtAuthenticationFilter` procesa Bearer tokens una vez por petición, crea la
  autoridad `ROLE_<rol>` y limpia el `SecurityContext`. `SecurityTenantContext`
  obtiene el tenant del principal validado y conserva el fallback `demo` únicamente
  para el CRUD público temporal.
- Agregadas 7 pruebas específicas para emisión, claims, expiración, alteración,
  emisor/tipo incorrectos, configuración, redacción, filtro, rol y limpieza del
  contexto. También se ejecutaron las pruebas de integración existentes.
- `pnpm check` terminó completamente en verde: formato, lint, tipos, pruebas y
  builds frontend, contrato API sincronizado, backend, pruebas y ArchUnit.
- Reconstruida la imagen Docker del backend. Verificación local: health `UP`, ruta
  protegida sin token `401`, Bearer inválido `401` y CRUD demo público `200`.
- MAP-47 no modifica el contrato OpenAPI ni el esquema de base de datos. MAP-48–50
  permanecen pendientes y no se cambió el estado ni se publicó comentario en Jira.

### Ejecución de MAP-48

- Agregado `POST /api/v1/auth/login` al contrato OpenAPI con entrada tipada,
  respuesta Bearer e identidad pública. El contrato valida y el cliente Angular
  generado queda sincronizado.
- Implementado `LoginController`, que coordina la verificación de credenciales y
  la emisión del JWT. Credenciales incorrectas responden 401 y entradas inválidas
  responden 400 mediante Problem Details sin reflejar datos recibidos.
- La ruta de login es pública. Los despachos internos de error conservan el estado
  HTTP real y las demás rutas continúan requiriendo autenticación.
- Las pruebas del controlador verifican 200, 400, 401, el DTO de salida y la
  ausencia de contraseña y hash.
- El backend local en Docker se actualizó y quedó saludable. Con un tenant y
  usuario desechables se comprobó: login válido 200, contraseña incorrecta 401,
  cuerpo inválido 400, ruta protegida sin JWT 401 y JWT emitido aceptado por la
  cadena de seguridad. Los datos temporales se eliminaron al terminar.
- MAP-49 y MAP-50 permanecen pendientes. No se cambió el estado ni se publicó
  comentario en Jira.

## MAP-49 — Pantalla de login

- [x] Leer reglas Angular y revisar rutas, configuración y tokens existentes.
- [x] Incorporar la referencia visual proporcionada por el usuario.
- [x] Confirmar alcance de la tarjeta MAP-49 en Jira.
- [x] Resolver cómo se selecciona la empresa: slug en la URL para conservar el diseño.
- [x] Aprobar especificación de MAP-49.
- [x] Implementar ViewModel y formulario accesible.
- [x] Implementar composición visual y adaptación a móviles.
- [x] Comprobar comportamiento y apariencia; ejecutar pnpm check.
- [x] Actualizar consola en Docker y dejarla para revisión.

### Preparación de MAP-49

El usuario proporcionó una referencia con dos campos: correo y contraseña.
Se consultó cómo resolver tenantSlug, obligatorio en el contrato actual. La
implementación de la pantalla permanece pendiente de aprobar la especificación.

- Aprobación recibida. Rovo falló al consultar los recursos de Jira; se continúa
  con el alcance de pantalla aprobado en esta conversación.

### Ejecución de MAP-49

- Jira consultado en navegador: MAP-49 «Crear pantalla de login», área Frontend,
  sin descripción adicional; bloquea MAP-50 «Integrar login con API».
- Implementada feature login con Signals y componente OnPush, rutas lazy /login
  y /empresa/:tenantSlug/login. La raíz de console redirige al formulario.
- Composición basada en la referencia del usuario: dos paneles, logo con pin,
  formulario blanco y azul e ilustración local original de mesas en SVG.
- Cuatro pruebas de ViewModel cubren validación, visibilidad, conservación exacta
  de la contraseña y selección de empresa por URL sin fallback a demo.
- Revisión en navegador sobre Docker: escritorio 1440 px y móvil 360 px; en móvil
  scrollWidth=360. Verificados campos vacíos, formulario válido, mostrar contraseña
  y navegación con Tab con foco visible. La pantalla no hace peticiones de login.
- Construida imagen local mapit-console con el bundle Angular y nginx; recreado
  únicamente console. Disponible en http://localhost:4200/empresa/demo/login.
- MAP-50 queda pendiente: conectar API, sesión y JWT. No se publicaron cambios en Jira.

- Verificación final: pnpm check completamente en verde (formato, lint, tipos,
  tests y builds frontend, contrato sincronizado, backend y ArchUnit).

## MAP-50 — Integración con API

- [x] Leer Jira, contrato, formulario y estructura de libs/auth.
- [x] Preparar especificación y plan con sesión y Recordarme definidos.
- [x] Aprobar especificación MAP-50.
- [x] Implementar adaptador API y estados del formulario.
- [x] Implementar sesión, almacenamiento y expiración.
- [x] Incorporar interceptor, guard y cierre local de sesión.
- [x] Probar éxito, errores, restauración y alcance de Bearer.
- [x] Verificar flujo completo con Docker y datos temporales.
- [x] Ejecutar pnpm check y documentar entrega.

### Preparación de MAP-50

Jira confirma que MAP-50 depende de MAP-48 y MAP-49 y bloquea las pruebas MAP-51
y MAP-52. La propuesta integra el contrato existente sin refresh token ni cambios
de esquema. El usuario aprobó la especificación; implementación completada.

### Ejecución de MAP-50

- LoginApi usa AuthService generado, con configuración runtime y transferCache
  desactivado. LoginStore normaliza el correo, conserva la contraseña exacta,
  evita envíos duplicados, cancela al abandonar/cambiar empresa y aplica timeout.
- AuthSession conserva identidad pública, JWT y expiración. sessionStorage es el
  valor predeterminado; Recordarme utiliza localStorage sin extender el JWT.
  Valida restauración, elimina sesiones corruptas/vencidas y avisa si solo puede
  mantener la sesión en memoria. Nunca persiste contraseñas.
- Interceptor limitado al origen y prefijo de API; excluye login y terceros.
  Un 401 invalida solo el token usado por esa petición; 403 conserva la sesión.
  Guards protegen Inicio y demo-items. Inicio muestra identidad y cierre local.
- Pruebas de consola: 11 aprobadas; librerías: 27 aprobadas (23 de autenticación).
  Cubren éxito, validación, duplicados, errores de credenciales/conexión, contrato,
  restauración, expiración, almacenamiento, guard y límites del interceptor.
- pnpm check pasó formato, lint, tipos, tests y builds frontend, sincronización del
  contrato, backend y ArchUnit. Tras agregar el caso de error de conexión se volvió
  a ejecutar la suite de consola, también en verde.
- Consola actualizada en Docker con el bundle compilado. En navegador se verificó
  rechazo de credenciales, carga deshabilitada, ingreso con identidad real,
  persistencia al recargar, Recordarme al cerrar/reabrir pestaña y bloqueo de rutas
  tras cerrar sesión. Las verificaciones utilizan datos locales desechables.
- No cambia el contrato ni el esquema. No se creó commit ni se modificó Jira.

- Verificado Bearer de extremo a extremo: demo-items mostró un registro exclusivo
  del tenant autenticado. Se cerró la sesión de prueba y se eliminaron usuario,
  elemento y tenant temporales de PostgreSQL (0 tenants de prueba restantes).
