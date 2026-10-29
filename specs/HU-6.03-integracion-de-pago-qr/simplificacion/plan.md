# Plan

1. Eliminar guard, pantalla y preferencia global de establecimiento. Desacoplar la recepción existente para que use su selector local autorizado.
2. Aplanar Configuración y retirar la barra de establecimiento de staff.
3. Sustituir la pantalla extensa de pagos por listado y formulario MOCK. Reutilizar PaymentMethodsApi y la persistencia actual, con ámbito de empresa fijo y sin solicitar datos bancarios.
4. Mantener los campos técnicos exigidos por el contrato con valores de simulación explícitos; no cambiar el contrato ni generar migraciones.
5. Bloquear la pantalla MOCK fuera de dev/test y validar duplicados visibles. Conservar el bloqueo de activación existente del backend, que no se modifica por instrucción posterior del usuario.
6. Adaptar pruebas afectadas y ejecutar controles de consola y pagos.

## Patrones de diseño aplicados

| Patrón                     | Por qué aquí                                     | Alternativa descartada        |
| -------------------------- | ------------------------------------------------ | ----------------------------- |
| MVVM con signals           | Separar formulario, estado y llamadas existentes | Lógica de API en plantilla    |
| Adaptador de API existente | Reutilizar persistencia y aislamiento JWT/RLS    | Almacenamiento local paralelo |

Limitaciones: el modelo existente requiere país y campos técnicos de receptor; MOCK usa valores fijos de simulación para estos últimos. La descripción no se inventa ni se guarda en otro campo. No se modifica el checkout existente.
