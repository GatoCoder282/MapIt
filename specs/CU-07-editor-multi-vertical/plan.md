# Plan

1. Auditar catálogo, renderer, reservas y persistencia actuales.
2. Extender element-catalog con un registro declarativo de categorías/modelos por vertical, conservando claves de restaurante.
3. Usar el mismo ElementLibrary, MapEditorStore y MapEnginePort para todas las verticales.
4. Extender furnitureFinish con representaciones compartidas de habitaciones, asientos, producción, mobiliario y servicios.
5. Mantener propiedades pertinentes por familia; los montajes crean recursos independientes en una transacción de borrador y un paso de undo.
6. Alinear validaciones backend con VerticalCatalog y verificar persistencia real, concurrencia y aislamiento existentes.
7. Ejecutar pruebas focalizadas, build y E2E multivertical con capturas.

## Patrones de diseño aplicados

| Patrón                     | Por qué aquí                                            | Alternativa descartada             |
| -------------------------- | ------------------------------------------------------- | ---------------------------------- |
| Registro declarativo       | Categorías/plantillas varían por vertical en una fuente | Condicionales repartidos por la UI |
| Puerto/adaptador existente | Preview/editor/operación comparten geometría            | Otro motor gráfico                 |
| Snapshot existente         | Composiciones, estilos y elementos se deshacen juntos   | Otra pila por vertical             |
| Proyección de recursos     | Reservas usa reglas autoritativas sin importar spaces   | Acoplar módulos o confiar en la UI |
