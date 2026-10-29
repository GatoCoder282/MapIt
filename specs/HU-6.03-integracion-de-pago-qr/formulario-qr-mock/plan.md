# Plan

Sustituir la gestión persistida anterior de esta pantalla por un formulario MOCK en memoria. Reutilizar estilos, catálogo y runtime existentes. Mantener las pruebas de checkout separadas y adaptar solo el recorrido de configuración.

## Patrones de diseño aplicados

| Patrón           | Por qué aquí                                    | Alternativa descartada                           |
| ---------------- | ----------------------------------------------- | ------------------------------------------------ |
| MVVM con signals | Borrador y copia de prueba verificables sin API | Cambiar backend o fingir persistencia definitiva |

Campos: establecimiento, país, banco, titular, cuenta y activo. Solo establecimiento, país y banco son obligatorios para esta prueba; titular y cuenta pueden permanecer vacíos como en la solicitud.
