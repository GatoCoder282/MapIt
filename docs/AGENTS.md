# Documentación — contexto para agentes

## Dónde vive cada cosa

| Carpeta                           | Qué contiene                                      | Formato                                |
| --------------------------------- | ------------------------------------------------- | -------------------------------------- |
| `roadmap/`                        | alcance, requerimientos, casos de uso             | Markdown                               |
| `architecture/adr/`               | decisiones de arquitectura y su porqué            | Markdown, plantilla en `adr/README.md` |
| `architecture/c4/`                | diagramas C4: contexto, contenedores, componentes | Mermaid                                |
| `architecture/design-patterns.md` | catálogo de patrones y dónde encajan              | Markdown                               |
| `db/mapit.dbml`                   | **modelo de datos** (fuente de verdad conceptual) | DBML                                   |
| `diagrams/`                       | UML: casos de uso, secuencia, estados             | Mermaid o PlantUML                     |
| `api/`                            | lo que OpenAPI no cubre (WebSocket/STOMP)         | Markdown / AsyncAPI                    |
| `prompts/`                        | prompts guardados del equipo                      | Markdown                               |

## Reglas duras

1. **`use_cases.md` manda sobre `project_definition.md`.** El primero amplió el alcance
   para el equipo de 5 (multi-tenant, reservas públicas, pagos QR, 4 verticales).
   Ante cualquier duda de alcance, prevalece `use_cases.md`.
2. **`mapit.dbml` se actualiza en el MISMO commit que la migración de Flyway.**
   Un modelo desactualizado es peor que no tenerlo: la gente confía en él.
3. **Los diagramas se escriben como texto** (Mermaid o PlantUML), nunca como imagen suelta.
   Una imagen no se puede revisar en un PR ni actualizar sin el archivo original.
4. **Una decisión no evidente se registra como ADR.** Si alguien pregunta «¿por qué así?»
   dos veces, faltaba un ADR.

## Al añadir un ADR

Numera el siguiente, usa la plantilla de `adr/README.md` y **añádelo al índice**.
La sección _Alternativas consideradas_ no es decorativa: es lo que se defiende ante el docente.
