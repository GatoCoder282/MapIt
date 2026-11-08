# Plan

1. Conservar la ruta de staff, el shell y la protección de salida existente. Mantener la vista, los eventos y el foco en `features/payments/ui/payment-methods.{ts,html,scss}`.
2. Conservar `model/payment-methods-store.ts` para Mock y políticas. Incorporar el catálogo real en el modelo de la feature con `PaymentsService`, derivando permisos y ámbito de `EstablishmentContext`. Verificar ámbito al iniciar y finalizar cada operación, y usar la respuesta de escritura para la confirmación.
3. Reutilizar SearchSelect, estilos y botones del módulo, tokens de ui-kit e iconos Lucide disponibles. Agregar los textos a los catálogos de Console. Mantener formularios específicos dentro de una estructura común de lista, asistente y confirmación.
4. Verificar unidades de ambos modelos, interacciones de la pantalla, Playwright en la ruta real y lint/build. Conservar las pruebas live de Mock y adaptar los selectores de la nueva secuencia. Comparar escritorio/móvil con los paneles de la referencia, documentando diferencias de contenido y ambiente de validación.

## Patrones de diseño aplicados

| Patrón                               | Por qué aquí                                                           | Alternativa descartada                                |
| ------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| MVVM con signals                     | Separa la interacción de la validación, los permisos y la concurrencia | Solicitudes y estado de negocio en el componente      |
| Ámbito por contexto con invalidación | Aísla borradores y resultados obsoletos al cambiar establecimiento     | Segundo selector o mutar un borrador para reasignarlo |
| Confirmación derivada de respuesta   | Refleja estado persistido y errores reales                             | Confirmación optimista                                |

Los clientes generados existentes cubren el alcance. Se conserva el backend, la base de datos y OpenAPI. Los riesgos principales son las respuestas tardías, la herencia tenant y la distinción entre un QR manual activo y la preparación del checkout Mock.
