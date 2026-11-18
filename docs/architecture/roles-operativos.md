# Roles operativos del tenant

| Operación                                           | ADMIN                        | MANAGER                      | STAFF              |
| --------------------------------------------------- | ---------------------------- | ---------------------------- | ------------------ |
| Usuarios y asignaciones STAFF                       | Sí                           | No                           | No                 |
| Establecimientos visibles                           | Todos los activos del tenant | Todos los activos del tenant | Solo los asignados |
| Reservas operativas por establecimiento             | Sí                           | Sí                           | Solo asignados     |
| Check-in                                            | Sí                           | Sí                           | Solo asignados     |
| Libro de cobros por establecimiento                 | Sí                           | Sí                           | No                 |
| Métodos de pago, cuentas y configuración financiera | Sí                           | No                           | No                 |
| Auditoría administrativa                            | Sí                           | No                           | No                 |

La asignación STAFF se conserva en `establishment_staff_access.can_check_in` por compatibilidad con los datos y el contrato existentes. `true` significa **asignado** y `false` **revocado**; no hay un segundo permiso de check-in. El backend comprueba usuario y tenant activos, establecimiento activo, rol y asignación vigente en cada petición. El tenant proviene del JWT y las consultas usan RLS.

La lectura operativa de reservas entrega una página de hasta 100 registros, limitada al establecimiento autorizado. Expone ID, horario, identificadores de espacios, estado y presencia de check-in; no expone datos personales. Es solo la parte de consulta necesaria de MAP-260. Otras capacidades de esa historia siguen pendientes.

La gestión operativa de pagos incluye consulta paginada de cobros y verificación manual de pagos bancarios del establecimiento autorizado para ADMIN y MANAGER. La configuración de métodos y destinatarios permanece exclusiva de ADMIN.
