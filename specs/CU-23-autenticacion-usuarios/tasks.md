# CU-23 — Tareas de MAP-46

- [x] Leer MAP-45/MAP-46 y delimitar las subtareas posteriores.
- [x] Escribir especificación y plan antes de implementar.
- [x] Implementar dominio y caso de uso de autenticación.
- [x] Implementar BCrypt y consulta transaccional de credenciales.
- [x] Crear migración con RLS y actualizar DBML.
- [x] Verificar reglas, persistencia, aislamiento y arquitectura.
- [x] Dejar la entrega para revisión del usuario.

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
