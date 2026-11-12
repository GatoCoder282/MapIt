# Pautas de diseño y accesibilidad

> Ver [tokens](design.md) y [componentes](design-components.md).

- Conservar tipografía, espaciado y colores compartidos. Usar azul para acción principal, foco y selección. Reservar verde para estados positivos confirmados.
- Presentar el establecimiento como nombre y dirección disponible. El shell contiene la única interacción de selección operativa.
- Mantener contraste mínimo de 4,5:1 en texto normal y 3:1 en iconos de estado, foco y límites interactivos. Identificar estados con texto además de color.
- Usar controles nativos etiquetados, opciones de tipo como grupo de radio y un único paso con `aria-current="step"`. Tras un cambio de vista, llevar el foco al encabezado. Mantener el orden lógico al apilar columnas.
- Exponer carga con estado y fallos con alertas. Asociar errores de archivo con el campo. Comunicar envío bloqueando el segundo guardado y mostrando un texto de progreso. Usar la curva compartida de salida para un fundido de paso de 150 ms, la marca de selección de 150 ms y la entrada del icono de confirmación de 250 ms. Con movimiento reducido, cambiar estos estados de inmediato.
- Carga, vacío, errores y foco se derivan de los patrones de Console porque el montaje solo muestra el recorrido principal.
