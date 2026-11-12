# Tareas — MAP-256

- [x] Actualizar contrato para que el login por correo devuelva una sesión de la cuenta.
- [x] Aplicar unicidad en `app_user.email` y eliminar el flujo de vinculación.
- [x] Usar el formulario normal de Console en `/login`.
- [x] Verificar login, unicidad, aislamiento y aplicación de migraciones en local.

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
