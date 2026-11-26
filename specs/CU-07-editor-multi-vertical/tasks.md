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

- Referencia visual de inicio: panel de estructura vacío destacado, ilustración de plano
  generada para MapIt y tres pasos para crear piso, organizar zonas y diseñar. Se conserva
  el botón real de creación y la navegación global; el hero ocupa el ancho libre del editor.
  El panel destacado solo aparece sin pisos, carga, errores ni formularios abiertos.
  «Empieza aquí» queda anclado encima del botón real «Agregar piso», con un indicador
  descendente también visible en móvil; no depende de coordenadas del hero.
- Ajuste visual solicitado para HU-2.04: sin piso seleccionado, el editor muestra una guía
  hacia el panel de Estructura izquierdo y oculta el lienzo, las herramientas y las propiedades.
  La guía destaca con superficie clara, acentos azules y tipografía Manrope de MapIt,
  sin ilustraciones ni controles adicionales.
  La versión final añade un título, dos pasos numerados y una flecha hacia el panel:
  izquierda en escritorio y arriba cuando la estructura se apila en móvil. La guía queda
  en un componente de presentación propio para mantener acotado el CSS del editor.
  Se elimina el botón redundante de estructura y la campana antigua que enlazaba al monitor;
  se conserva el centro de notificaciones con su panel y evaluación por sesión.
  Verificación: `pnpm check` completo en verde (929 pruebas frontend y build backend),
  ocho E2E del editor aprobados en escritorio/tablet y revisión visual del estado vacío,
  apertura de notificaciones y creación del primer piso. El E2E de distribución ahora exige
  la guía y el lienzo oculto, en lugar del botón eliminado. Capturas y logs locales en
  `.tmp/hu204-merge/ui-*` (sin versionar); las respuestas de notificaciones se simularon
  solo en la revisión visual, y sus seis pruebas de componente pasaron en `pnpm check`.
  Tras destacar la guía se repitieron el build de console y los dos E2E de distribución,
  ambos en verde. Se comprobó también el estado vacío a 390 px, sin recortes ni overflow,
  conservando los presupuestos de CSS existentes.
- Arquitectura existente reutilizable: siete tipos, appearance validada por UUID, MapEnginePort, historial y flujo de guardado por lotes.
- No hay entidad de evento comercial ni número único de habitación. Se documentan como dependencias de dominio, no se simulan.
- El 500 observado en layout no tiene todavía causa demostrada por stacktrace. No se presupone backend obsoleto.

Verificación intermedia: typecheck frontend pasa; catálogo7, biblioteca7, store42 y estilo10 pruebas pasan. E2E genérico pasa contra código backend actual aislado8082. Flyway info confirma esquema36 sin pendientes. Primer E2E multivertical interrumpido durante cambios/HMR; no cuenta como validación de persistencia. El servidor existente bloquea JAR en Windows: compilación de verificación usa directorio temporal separado, sin detener servidores ajenos.

- Pasaron 72 pruebas focalizadas del editor de sectores, 16 del editor de pisos y 3 de dibujo. La compilación de desarrollo y el typecheck de frontend pasaron.
- Playwright completó los seis recorridos en el backend de verificación: guardado y recarga en las cuatro verticales, creación y configuración duradera del piso y regresión del catálogo y los atajos. Se obtuvieron capturas de escritorio y móvil. El 500 anterior no se reprodujo en esta ejecución.
- Pasaron las 14 pruebas HTTP de creación de reservas. La suite general de Java falló en ArchUnit por un ciclo que involucra pruebas existentes de identity y platform.
- Pasaron las 8 pruebas de integración de FloorLayout, incluidos los controles de pertenencia al tenant.

### Integración de main en HU-2.04 (26/11/2026)

- Se integra `origin/main` en `031d4dd5` mediante merge, conservando el historial de HU-2.04.
  Los diez conflictos combinan los permisos espaciales, autorización de reservas y eventos de
  HU-2.04 con Mi cuenta, notificaciones y configuración de plataforma de main.
- El contexto operativo sigue en `EstablishmentContext`; la selección de piso y sector del
  editor sigue en `StructureEditorContext`, y el canvas usa `MapEnginePort`. Las notificaciones
  mantienen su evaluación independiente por usuario y sesión. El contexto global de flags
  conserva usuario, tenant y establecimiento, así como la invalidación de respuestas antiguas.
- El E2E detectó una consulta de establecimientos al entrar como Super Admin porque la
  configuración de flags instancia el contexto operativo. Ahora este contexto excluye ese rol
  y limpia la selección al cambiar desde staff; dos pruebas nuevas cubren ambos casos.
- Se resuelven las colisiones Flyway sin cambiar el SQL: configuración de plataforma pasa de
  V43 a V46; tamaño de grupo, apariencia de sectores, orden de plantas y notas privadas pasan
  de V40–V43 a V47–V50. Se verificaron cincuenta versiones consecutivas y únicas, contenido SQL
  idéntico al original y arranque real con las cincuenta migraciones aplicadas.
- `pnpm check` completo en verde: formato, lint, tipos, 597 pruebas de console, 154 de public-web,
  179 de libs, builds, contrato API y backend con tests y ArchUnit. También pasaron 24 pruebas
  de tooling y `pnpm api:lint` (dos advertencias existentes).
- `pnpm e2e --workers=4` sobre los builds finales de producción y el JAR verificado: 114 pruebas
  aprobadas, cero fallos y nueve omitidas por configuración (seis de Mi cuenta con opt-in, dos
  del centro de notificaciones con fixture específico y configuración de plataforma en tablet).
  Incluye escritorio, tablet, móvil y el flujo de incorporación de negocios. No se relajaron
  aserciones, timeouts ni snapshots. La ejecución con servidores de desarrollo produjo demoras
  e interrupciones del entorno y no se usa como evidencia final de aceptación.
- La verificación usa PostgreSQL aislado en `:15433`, backend `:18080` y frontends `:14201` y
  `:14301`. No se reinició la base habitual ni se modificó su historial Flyway. Una base local
  que ya aplicó las antiguas V40–V43 de HU-2.04 requiere reconciliar ese historial antes de
  reutilizarse con esta integración; no se debe ejecutar `repair` ni borrar datos para ocultarlo.
- Evidencia local ignorada por Git: `.tmp/hu204-merge/check.log`, `e2e-final.log`,
  `e2e-results.json`, `migration-proof.json` y `tooling-tests.log`.
