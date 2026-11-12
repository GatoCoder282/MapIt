# Pautas · Tres pantallas

> [Diseño](design.md) · [Componentes](design-components.md)

## Accesibilidad y uso

- Mantener foco visible, etiquetas accesibles y orden de teclado lógico en filtros, filas, panel de detalle, tabs y acciones. Targets interactivos de al menos 44×44 px.
- No comunicar estado solo con color; texto y chip acompañan el color. Mantener contraste de texto normal ≥4,5:1 y controles/iconos esenciales ≥3:1.
- Tabla con encabezados semánticos, selección anunciable y desplazamiento horizontal accesible en viewport estrecho; no ocultar columnas sin alternativa legible.
- Los paneles apilados conservan el orden de tarea: lista antes que detalle; consulta antes que resultado.
- Reutilizar estados actuales de carga, vacío y error de Console. No inventar estados visuales ni mensajes de producto nuevos.

## Criterios por pantalla

- **Auditoría:** alcance tenant/empresa, sin filtro por establecimiento ni búsqueda por texto libre. El contexto activo es informativo, no una condición de consulta. Evitar N+1; IDs técnicos quedan en el bloque colapsable.
- **Pagos:** preservar el contexto operativo real, sus datos y el flujo/asistente existente. El resumen refleja la lista visible.
- **Check-in:** conservar el vídeo despejado; guía de esquinas y línea azul fija sin tapar la lectura. Errores y estado de cámara quedan en texto/controles fuera del vídeo.

## Movimiento

No añadir animación nueva. La guía de escaneo es estática. En Pagos se conservan únicamente las transiciones y la alternativa de movimiento reducido ya existentes.
