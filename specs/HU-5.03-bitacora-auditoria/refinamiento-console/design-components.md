# Componentes · Tres pantallas

> [Diseño](design.md) · [Pautas](design-guidelines.md)

Especificaciones de composición de esta iteración aprobada (2026-11-04), no inventario del ui-kit. Usar componentes y tokens existentes; la decisión final aprobada conserva la tabla nativa de Auditoría tras verificar la licencia de PrimeNG. No anticipar ni hardcodear una API futura.

| Componente / pantalla | Especificación                                                                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encabezado            | Breadcrumb, título de página prominente y descripción. Barra azul izquierda en Pagos. Banda compacta de contexto en Pagos y Check-in; Auditoría rotula el alcance empresa con honestidad.                  |
| Filtros de Auditoría  | Grupo horizontal en escritorio con período, módulo, acción e ID exacto. Filtros apilados en ancho estrecho. Sin parámetro de establecimiento ni texto libre.                                               |
| Tabla de Auditoría    | Tabla nativa, cinco columnas: fecha, acción, recurso, responsable, cambio. Filas aproximadas de 54 px en la referencia, selección azul suave y paginación al pie. Scroll horizontal accesible en estrecho. |
| Detalle de Auditoría  | Panel lateral (~395 px en referencia), encabezado de detalle, recurso e icono, metadatos antes/después en pares y IDs técnicos colapsables.                                                                |
| Lista de Pagos        | Panel principal con tabs y acción principal; filas con icono, nombre, descripción, estado en chip y menú alineado. Mantener datos/contexto operativos actuales.                                            |
| Resumen de Pagos      | Panel lateral (~310 px en referencia), alineado con navegación/lista; pasa bajo la lista en tablet/móvil. Totales corresponden a elementos visibles.                                                       |
| Consulta Check-in     | Panel izquierdo con tabs Escanear QR / Ingresar código, superficie de vídeo, controles y ayuda debajo. Selector de cámara solo donde ya aplique.                                                           |
| Resultado Check-in    | Panel derecho con título de resultado, comprobante, separadores y pares cliente/espacio/fecha/estado; Registrar y Limpiar al pie. Apilado tras consulta en estrecho.                                       |
| Guía de escaneo       | Esquinas blancas y línea azul horizontal estática sobre vídeo real; nunca cubrir el área necesaria para leer el QR.                                                                                        |

No fijar anchos mediante posicionamiento absoluto: la geometría descrita es referencia para escritorio; adaptar con grid/flex y apilar en móvil. Los estados no ilustrados reutilizan implementaciones existentes.
