# Componentes del flujo

> Ver [tokens](design.md) y [pautas](design-guidelines.md).

| Vista         | Composición y medidas objetivo                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lista         | Encabezado con descripción, banda informativa del local, barra con Métodos de pago y Políticas generales, acción Agregar método. Filas con borde de 1 px, radio de 8 px, icono de tipo, nombre, descripción y distintivo textual de estado. |
| Tipo          | Stepper lateral de unos 176 px y panel flexible. Tarjetas con borde de 1 px, radio de 12 px y 16 px de padding. Selección con fondo suave, borde azul y marca. Cancelar y Siguiente alineados a la derecha.                                 |
| Configuración | Panel de datos y zona QR separados por 24 px. Campos de ancho completo, etiquetas encima y errores debajo. Previsualización cuadrada sin recorte y acciones Cambiar imagen y Quitar imagen. La pasarela muestra su disponibilidad real.     |
| Revisión      | Resumen en filas etiqueta/valor con separador de 1 px. Mostrar local, tipo, datos permitidos, estado solicitado y QR cuando corresponda. Anterior y Guardar método alineados al final.                                                      |
| Confirmación  | Panel centrado, icono verde, título, estado devuelto por la API y dos acciones. Ver métodos de pago es la acción principal.                                                                                                                 |

Usar el shell de Console para barra lateral, cabecera y navegación. En móvil, apilar tarjetas y columnas, mostrar el progreso por encima del formulario y permitir que las acciones se ajusten al ancho.
