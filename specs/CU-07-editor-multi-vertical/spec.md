# CU-07 — Editor compartido multivertical

Especificación autorizada: documento de implementación multivertical y referencias aportadas por el usuario el 2026-11-22.

## Objetivo

Un mismo editor y motor para RESTAURANT, NIGHTCLUB, HOTEL y EVENT_HALL. Mantener estructura/catálogo a la izquierda, canvas central y propiedades a la derecha.

## Criterios verificables

- Dado un establecimiento activo, al abrir Agregar elemento aparecen categorías y modelos compatibles con su vertical persistida.
- Dado un modelo, al insertar por botón o arrastre se conservan geometría, nombre, capacidad y variante gráfica; copiar/pegar y la pila de historial usan las mismas instancias.
- Dado un mapa guardado, al recargar se recupera la variante de cada instancia desde appearance.elements, sin imágenes planas que sustituyan recursos.
- Dado un hotel, se ofrecen habitaciones y mobiliario no reservable con los tipos ROOM/DECOR que admite el dominio actual.
- Dado un salón, los montajes se componen de elementos individuales seleccionables y numerados, no de una imagen.
- Dado otro tenant, los IDs manipulados siguen rechazándose mediante las validaciones, filtros y RLS existentes.
- Dado un recurso, sus reglas de reserva proceden del catálogo autoritativo de verticales y su disponibilidad temporal no modifica su estado operativo.

## Límites respaldados por el dominio

Se preservan label/capacity y estilos validados. No existen eventos comerciales programados, precios por evento, exclusividad de grupos ni roomNumber único. Esas propiedades no se simularán como estilos ni mediante controles sin persistencia. La identificación de habitación usa el label existente y no promete unicidad. La accesibilidad de una plantilla es representación visual, no certificación de atributos físicos.

## Persistencia y seguridad

No se requieren nuevas tablas para variantes visuales: usar SectorAppearance. Toda escritura mantiene tenant JWT, pertenencia sector/piso/establecimiento, versiones y bloqueo de reservas. Investigar el 500 observado antes de declarar persistencia verificada.

## Ampliación autorizada: configuración de pisos

Solicitud posterior del usuario: decoración de cabecera en Estructura del espacio, controles del canvas y Deshacer/Rehacer arriba a la derecha, y acción Configurar plano en el menú del piso. Tras crear un piso se solicita el ancho y alto antes de editar el plano vacío. Se reutiliza el guardado de FloorLayout, sin nuevos contratos ni sectores ficticios: los espacios son sectores y sus elementos se editan dentro de ellos.

Criterios: dimensiones válidas y persistidas; rechazar reducción que excluya sectores; plano vacío visible; acceso a crear primer sector; conservar guardado y concurrencia existentes.
