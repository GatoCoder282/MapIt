# Tareas

- [x] Auditar arquitectura/dominio/frontend/calidad con tres subagentes.
- [x] Registro y catálogos por vertical con traducciones.
- [x] Renderer y propiedades por familia visual.
- [x] Montajes de recursos individuales.
- [x] Políticas backend compartidas y pruebas.
- [x] Persistencia real y aislamiento.
- [x] Verificación frontend y E2E de cuatro verticales.

- [x] Configuración del plano del piso y flujo tras creación.
- [x] Decoración de estructura, menú Configurar plano y controles superiores a la derecha.

## Notas de ejecución

- Arquitectura existente reutilizable: siete tipos, appearance validada por UUID, MapEnginePort, historial y flujo de guardado por lotes.
- No hay entidad de evento comercial ni número único de habitación. Se documentan como dependencias de dominio, no se simulan.
- El 500 observado en layout no tiene todavía causa demostrada por stacktrace. No se presupone backend obsoleto.

Verificación intermedia: typecheck frontend pasa; catálogo7, biblioteca7, store42 y estilo10 pruebas pasan. E2E genérico pasa contra código backend actual aislado8082. Flyway info confirma esquema36 sin pendientes. Primer E2E multivertical interrumpido durante cambios/HMR; no cuenta como validación de persistencia. El servidor existente bloquea JAR en Windows: compilación de verificación usa directorio temporal separado, sin detener servidores ajenos.

- Pasaron 72 pruebas focalizadas del editor de sectores, 16 del editor de pisos y 3 de dibujo. La compilación de desarrollo y el typecheck de frontend pasaron.
- Playwright completó los seis recorridos en el backend de verificación: guardado y recarga en las cuatro verticales, creación y configuración duradera del piso y regresión del catálogo y los atajos. Se obtuvieron capturas de escritorio y móvil. El 500 anterior no se reprodujo en esta ejecución.
- Pasaron las 14 pruebas HTTP de creación de reservas. La suite general de Java falló en ArchUnit por un ciclo que involucra pruebas existentes de identity y platform.
- Pasaron las 8 pruebas de integración de FloorLayout, incluidos los controles de pertenencia al tenant.
