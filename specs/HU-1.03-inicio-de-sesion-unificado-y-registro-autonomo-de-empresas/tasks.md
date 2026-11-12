# Tareas — MAP-256

- [x] Actualizar contrato para que el login por correo devuelva una sesión de la cuenta.
- [x] Aplicar unicidad en `app_user.email` y eliminar el flujo de vinculación.
- [x] Usar el formulario normal de Console en `/login`.
- [x] Verificar login, unicidad, aislamiento y aplicación de migraciones en local.
- [x] Verificar el aislamiento de `auth_attempt_limit` con el rol de runtime.
- [x] Ejecutar la suite E2E de Console y Portal Público y verificar el alta del primer establecimiento.
- [ ] Verificar los workflows de GitHub Actions del PR y adjuntar la captura de sus checks.

## Notas de ejecución

La política de V32 limita la lectura previa al JWT a un correo, sin ampliar el
acceso a filas de otras empresas cuando ya existe un contexto de tenant.
El reinicio de datos es una operación de desarrollo separada de la migración.

Pasaron las pruebas unitarias del backend, las 9 pruebas de integración de
autenticación y las 33 pruebas de Console y la biblioteca de sesión. Console
compiló. Tras recrear la base local, Flyway aplicó V32 y V33. En el navegador,
el administrador de plataforma entró desde `/login` y una solicitud con
credenciales inexistentes devolvió 401. Una transacción revertida confirmó
que PostgreSQL rechaza un correo duplicado en otra empresa.

La revisión posterior retira el inicio de sesión por slug y usa el mismo
endpoint para el administrador de plataforma y las cuentas de empresa.

En el commit publicado `e50a909` pasó `pnpm check`. Los 86 casos de Playwright
quedaron verificados entre la corrida completa y las repeticiones. La activación
por invitación, el alta del primer establecimiento y su selección pasaron en
escritorio y móvil. Se usaron PostgreSQL y Mailpit desechables para la suite.

`RuntimeRoleIntegrationTest` confirmó con el rol `mapit_app` que `platform`
puede insertar y leer su contador. Sin tenant y desde `demo` el contador no
es visible. Desde `demo` tampoco se puede actualizar, borrar ni insertar
filas de `platform`. Pasaron `:bootstrap:spotlessJavaCheck` y los 17 casos
de integración de `RuntimeRoleIntegrationTest`, `AuthenticationIntegrationTest`
y `AdminActivationIntegrationTest` con PostgreSQL de Testcontainers.
