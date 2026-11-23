# Sprites de MapIt

Los recursos viven en `libs/map-engine/assets/sprites/v1/`. Console y Public Web los sirven desde `/assets/map/sprites/`. El manifiesto inicial está vacío y el motor usa figuras vectoriales.

## Preparar y registrar un recurso

1. Dibuja en vista cenital, con fondo transparente y las mismas convenciones de perspectiva e iluminación del resto del catálogo. Mantén el mobiliario dentro de su huella visible.
2. Exporta WebP con transparencia o PNG. Para un icono vectorial, usa SVG autocontenido sin scripts, fuentes ni referencias externas. Usa aproximadamente dos píxeles por unidad visible para el tamaño previsto a zoom normal y comprueba el peso y la nitidez ampliada.
3. Usa minúsculas y guiones. Guarda el archivo en `v1/furniture` (mesas, barras, asientos), `v1/architecture` (muros, puertas, ventanas), `v1/decor` (plantas), `v1/floors` (superficies) o `v1/icons` (pictogramas).
4. Añade una entrada a `libs/map-engine/assets/sprites/manifest.json`. Conserva el identificador cuando reemplaces una imagen de la misma pieza. Para una nueva pieza usa un identificador distinto.

```json
{
  "version": 1,
  "sprites": [
    {
      "id": "table-round-oak",
      "category": "furniture",
      "path": "v1/furniture/table-round-oak.webp",
      "version": 1,
      "originalSize": { "width": 256, "height": 256 },
      "aspectRatio": 1,
      "anchor": { "x": 0.5, "y": 0.5 },
      "defaultSize": { "width": 80, "height": 80 },
      "elementType": "TABLE",
      "verticals": [],
      "variants": { "walnut": "v1/furniture/table-round-walnut.webp" }
    }
  ]
}
```

Los nombres del ejemplo corresponden a archivos futuros. `aspectRatio` es ancho dividido entre alto. `anchor` alinea la imagen dentro del espacio libre de su huella en el plano. `0` alinea al inicio, `0.5` al centro y `1` al final de cada eje. El motor conserva el aspecto dentro de la geometría persistida y gira imagen y figura juntas alrededor del origen del elemento. `defaultSize` documenta el tamaño recomendado para una futura biblioteca visual. Las altas siguen el catálogo de tipos vigente.

El motor busca por `spriteId` cuando el consumidor lo suministra, luego por tipo y vertical compatible, y finalmente por el primer recurso compatible con el tipo. Usa `verticals: []` para un recurso general. Las claves conocidas son `RESTAURANT`, `NIGHTCLUB`, `EVENT_HALL` y `HOTEL`. En las pantallas cuyo contexto aún no expone vertical, registra un recurso general. Las variantes aceptan `spriteVariant` en el modelo de render. La API actual de elementos no persiste esos atributos y la interfaz aún no ofrece selección de variante. Los archivos nunca identifican mesas, reservas ni estados.

## Probar y sustituir

- Abre el editor, monitoreo y mapa público. Verifica imagen, selección, estado, arrastre y rotación a distintos niveles de zoom.
- Inspecciona la pestaña de red. Una ruta se solicita una vez por montaje del motor, incluso si varias figuras comparten la imagen. Al desmontar se cancelan las cargas pendientes y se liberan las referencias.
- Retira temporalmente la ruta o fuerza un error de imagen y verifica que la figura mantenga geometría, selección y estado.
- Confirma que el build de ambas apps contiene el manifiesto y el nuevo archivo en `assets/map/sprites`. Para reemplazar el dibujo, conserva la ruta o actualiza el manifiesto y publica los archivos juntos.

Por ahora el adaptador carga imágenes asociadas a un `SpaceElementType`. Muros, puertas, ventanas y texturas independientes requerirán un modelo explícito de colocación. Las carpetas preparan sus recursos sin inventar entidades en la API.
