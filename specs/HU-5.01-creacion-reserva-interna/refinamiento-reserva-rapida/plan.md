# Plan

1. Mantener las pestañas, el mapa y la búsqueda de alternativas operativas existentes.
2. Añadir el formulario de creación al seleccionar una mesa. Reutilizar el snapshot de disponibilidad, el intervalo de 90 minutos y el cliente API generado.
3. Resolver el contacto por coincidencia inequívoca de teléfono y nombre antes de crear la reserva. El backend sigue validando capacidad, solapamientos y permisos.
4. Ajustar el panel a la referencia y comprobar el flujo real de guardado, sus conflictos y su diseño adaptable.
5. Retirar la página de alta interna y redirigir sus enlaces al mapa, incluido el horario al elegir una mesa alternativa.

## Patrones de diseño aplicados

| Patrón              | Por qué aquí                                                                  | Alternativa descartada                         |
| ------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------- |
| MVVM                | Valida el contacto e intervalo y controla el envío en un store de la feature. | Lógica de reserva en la plantilla.             |
| Adaptador existente | La reserva rápida usa los servicios de personas, reservas y datos del mapa.   | Duplicar endpoints o reglas de disponibilidad. |

Las notas usan un campo opcional en OpenAPI y en la fila de reserva existente. Se valida el contrato y se regenera el cliente antes de implementar la persistencia.
