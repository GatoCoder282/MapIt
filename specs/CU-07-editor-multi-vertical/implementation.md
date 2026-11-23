# Implementación y verificación

## Arquitectura reutilizada

Un solo ElementLibrary, MapEditorStore, FloorEditorStore y MapEnginePort. El registro element-catalog define categorías y modelos por vertical. furnitureFinish sirve tanto las tarjetas como el editor y el monitoreo. Los montajes crean recursos individuales en un único paso de historial; no son imágenes.

| Capacidad                                          | Estado anterior                      | Extensión                                                                              |
| -------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Editor, selección, geometría y permisos            | Reutilizable                         | Misma interfaz para cuatro verticales                                                  |
| Mesas, barras, plantas y zonas                     | Existente                            | Compatibilidad y claves preservadas                                                    |
| VIP, habitaciones, butacas, producción y servicios | Requería extensión                   | Catálogo y primitivas del motor existente                                              |
| Propiedades                                        | Metadatos y estilos existentes       | Controles pertinentes para mobiliario, sin controles de macetas en sofás               |
| Montajes                                           | No disponibles                       | Filas/columnas/separación con numeración, validación y undo atómico                    |
| Persistencia de apariencia                         | Existente                            | variant por UUID en SectorAppearance; sin nuevas tablas                                |
| Reglas de reservas                                 | Catálogo compartido existente        | Política de tipos unificada y validación temporal con zona horaria del establecimiento |
| Configuración de piso                              | Dimensiones editables en propiedades | Flujo inicial de tamaño, menú Configurar plano y plano vacío                           |

## Funciones por vertical

- Restaurante: modelos genéricos de mesas, barras, plantas, zonas y escenario; conservación de mapas existentes.
- Discoteca: mesas VIP, booth/lounge, pista, DJ, producción, barras, accesos y mobiliario.
- Hotel: seis modelos de habitación, identificación mediante label, capacidad y mobiliario de áreas comunes, bienestar y servicios. Solo ROOM se reserva; los muebles son DECOR.
- Salón: mesas, butacas, auditorios y banquetes con recursos independientes, escenarios, zonas, catering y circulación.

## Archivos principales

- apps/console/src/app/features/map-editor/model/element-catalog.ts y pruebas: registro visual.
- apps/console/src/app/features/map-editor/ui/element-library.{ts,html,scss} y pruebas: categorías, inserción y configuración.
- apps/console/src/app/features/map-editor/model/map-editor-store.ts y pruebas: montajes y pila existente.
- apps/console/src/app/features/map-editor/ui/layout-style.ts y pruebas: propiedades visuales por familia.
- libs/map-engine/src/lib/adapters/konva/{vertical-art,operational-art,konva-map-engine}.ts y pruebas: dibujo y vistas previas.
- apps/console/src/app/core/establishment-structure/establishment-structure.ts: decoración, accesos y apertura del plano.
- apps/console/src/app/features/map-editor/{ui/floor-editor-page,model/floor-editor-store}.ts y pruebas: configuración y pila del piso.
- apps/console/src/app/features/map-editor/ui/map-editor-page.{ts,html,scss}: navegación y controles superiores.
- apps/console/src/app/core/strings{,.en,.ja}.ts: textos por idioma.
- SpaceElementTypePolicy, ReservationResource, JdbcReservationResourceRepository y CreateReservation: políticas de dominio y proyección entre contextos.
- apps/e2e/tests/console/{company-admin-fixture,multi-vertical-editor.spec,establishment-structure.spec}.ts: recorridos reales.

## Contratos, datos y seguridad

Sin contratos REST, enums públicos, tablas ni migraciones nuevas en esta ampliación. Se usan FloorLayout y SectorLayout existentes y variantes validadas en appearance.elements. ReservationResource incorpora vertical y timezone como proyección interna; las reservas siguen usando Instant, bloqueos por recurso e intervalos de solapamiento existentes. Se conservan tenant del JWT, pertenencia de recursos, concurrencia optimista y RLS.

## Dependencias que no se simulan

No existe una entidad de evento comercial ni precios por evento, exclusividad agrupada, número de habitación único ni mantenimiento temporal por intervalo. La identificación de habitación es label. La plantilla accesible es una representación visual. El contrato público de reservas sigue limitado a fecha y horas del mismo día; el soporte temporal agregado se aplica al flujo interno existente con Instant. No se introducen controles que prometan esas operaciones ausentes.

## Herramientas utilizadas

Skills: Ponytail, antislop, design-orchestrator e Impeccable. Graphify se leyó, pero no había grafo utilizable. Serena para contexto de código; Context7 para documentación de Angular y Gradle; Playwright, Vitest/Angular, Gradle/JUnit y Testcontainers para verificación. Subagentes utilizados: architecture, domain y quality, con responsabilidades separadas de renderer/pisos, dominio y E2E.

Los resultados finales y notas de ejecución están en tasks.md.
