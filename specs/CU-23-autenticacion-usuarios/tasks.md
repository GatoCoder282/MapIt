# CU-23 — Tareas de MAP-46 y MAP-47

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
