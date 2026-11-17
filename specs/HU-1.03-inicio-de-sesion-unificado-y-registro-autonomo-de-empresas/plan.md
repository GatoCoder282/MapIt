# Plan — MAP-256

1. Definir el inicio de sesión por correo en OpenAPI y regenerar el cliente.
2. Añadir en Flyway la unicidad del correo y una política RLS de consulta previa al
   login. Actualizar DBML y mantener los límites de intentos.
3. Reutilizar la autenticación y el formulario existentes. Eliminar la vinculación y
   el selector de empresa y el inicio de sesión por slug. Enlazar las activaciones a `/login`.
4. Verificar el flujo, las credenciales inválidas, la unicidad y el aislamiento antes
   de recrear la base de desarrollo solicitada.

## Patrones de diseño aplicados

| Patrón             | Por qué aquí                                                                           | Alternativa descartada                     |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------ |
| Puerto y adaptador | El caso de uso valida credenciales y el adaptador fija el contexto RLS de la consulta. | Acceder a PostgreSQL desde el controlador. |
