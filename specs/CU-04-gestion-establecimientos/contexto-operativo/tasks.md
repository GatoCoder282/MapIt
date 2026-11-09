# Contexto operativo único — tareas y ejecución

- [x] Inspeccionar contexto global, shell, rutas y cuatro módulos.
- [x] Acordar confirmar descarte y bloquear salida durante escrituras.
- [x] Aprobar spec y continuación con plan/implementación.
- [x] Escribir plan, ámbitos separados y estrategia de verificación.
- [x] Implementar y probar guarda de salida.
- [x] Integrar reservas y recepción con pruebas de contexto/carreras.
- [x] Integrar pagos y excluir configuraciones ajenas con pruebas.
- [x] Integrar estructura/editores y validar pertenencia de recursos.
- [x] Retirar selectores locales e integrar UI/guardas sin rediseñar popup.
- [x] Reconciliar escritores, revisar seguridad y ejecutar verificación agregada.
- [x] Validar navegación/recarga/cambio en E2E y documentar límites.

## Notas de ejecución

- El usuario aprobó explícitamente la estrategia «Confirmar y bloquear» y la spec para continuar con plan, tareas, implementación y validación.
- Contexto real: `EstablishmentContext.active/status/establishments`, `load(): Promise<void>`, `confirm(id): boolean`. Las features solo leen, no confirman selección desde URL.
- Shell ya impide montar contenido sin activo y abre cambio mediante `/home?selectEstablishment=1`; `/admin/*` tiene shell propio.
- Recon encontró stores locales y listado de pagos sin filtro por establecimiento. Check-in ya tiene `requestVersion`/cleanup de watch; pagos ya tiene epochs. Se reutilizan, no se inventa otra fuente de verdad.
- HTTP Angular completa normalmente: añadir `take(1)` no resuelve respuestas tardías ante cambio. Se requiere invalidación/cancelación por ámbito y ciclo de vida.
- Se preserva workspace actual, con cambios previos en selector global, rutas, strings y E2E. No commits/push; no restaurar ni borrar trabajo ajeno. El nuevo ámbito documental es esta carpeta.
- Verificación pendiente; ninguna prueba de implementación se ha declarado ejecutada todavía.
- Backend inspeccionado sin modificar: `bootstrap/src/main/java/com/mapit/config/CheckInService.java` exige `authorization.canCheckIn(tenants.require(), actors.requireUserId(), establishmentId)` antes de lookup/register y pasa el mismo establecimiento a `readForOperator` y `reservations.checkIn`. La integración frontend no elimina esos controles.
- Primer intento del test de guarda falló por módulo aún no implementado y compilación transitoria de escritores paralelos (Angular compila también fuentes fuera de `--include`). La implementación mínima ya existe; reejecución verde pendiente de reconciliar UI/stores. No se confunde ese bloqueo con evidencia funcional roja completa.
- Reservas/recepción: primera ejecución focalizada del implementador reportó 34 tests verdes; revisión posterior detectó watch invalidado por consultas y dirty tras reserva guardada. Correcciones con tests añadidos y lint verde; nueva ejecución bloqueada por incompatibilidad temporal `SpacesStore.dirty` en UI paralela. Pendiente validación reconciliada.
- Pagos: implementación y corrección de `policySaving` tras readiness, contador de escrituras y reintento readiness de configuración nueva. Lint y formato focalizados reportados verdes; tests bloqueados por la misma incompatibilidad UI/store, no se declaran aprobados.
- E2E nuevo incluye navegación de las cuatro rutas, restauración/cambio, ausencia de selectores locales, entrada directa, descarte cancelado, escritura pendiente y `/admin` independiente. Primera ejecución bloqueada por overlay de compilación; casos ampliados esperan integración. Sus mocks no prueban autorización backend.
- Ruling: se trabaja en la rama feature existente `feat/matiasmv05/MAP-229-hu-6-03-integracion-de-pago-qr`, no en main ni en un checkout aislado que perdería las dependencias sin commit del contexto global. Se limitan ámbitos de escritura y se conserva el estado previo; no se realizan commits/push.
- Revisión independiente de concurrencia (oracle) detectó invalidación incompleta de consultas check-in A→B→A, continuación obsoleta tras segundo await de política, inicialización de configuración B bloqueada por escritura A y cleanup de watch al revocar rol. Correcciones enviadas a sus escritores con escenarios de regresión; no se aceptan como completos hasta evidencia verde.
- Revisión de estructura: respuesta obsoleta de validación de planta ejecutaba reset sobre ámbito nuevo; además faltaba bloquear edición antes de validar pertenencia. Se solicitó corregir ambas en la fuente y cubrir con tests, junto con callbacks de error/finalize y busy real.
- Revisión UI: una query `viewChild(SectorFormComponent)` desde SectorPage no atraviesa el componente SectorList; se pidió usar estado dirty verificable y probar el caso anidado. No se confunde ausencia de compilación roja con aprobación de comportamiento.
- Reanudación tras interrupción de cuota: se mantienen ámbitos y sesiones existentes, sin repetir implementación. Pendientes: cierre de lifecycle/recurso de editores, UI y E2E, revisión final y comprobación agregada.
- Ruling: proveer los dos stores de editor en sus páginas (sin eliminar su fallback root) aísla autosave y descendientes por ciclo de vida. No hay consumidores externos que requieran compartir sus instancias. `SpacesStore` permanece root por wizard multi-ruta; revisiones de borrador protegen nuevas ediciones ante respuestas anteriores.
- Ruling: durante escritura de editor se bloquean mutadores y cambio de recurso, en vez de introducir un sistema de revisiones de layout concurrentes. Se mantiene conteo real de escrituras y confirmación de descarte para cambios locales; no se modifica popup ni contexto global.
- Stores de estructura/editores: última ejecución focalizada del implementador reporta 48 tests verdes; formato y lint focalizados verdes. UI (wizard, sectores, pagos y propiedades): 5 archivos/13 tests verdes reportados. Pendiente evidencia agregada propia del orquestador.
- E2E detectó pantalla check-in incompleta. Causa: crear watch con `toObservable`/RealtimeClient dentro de un effect podía crear effects anidados (NG0602). El setup del watch se movió a `untracked`, conservando dependencias explícitas active/status/authorized y pruebas de refresh/cleanup.
- Revisión final estática independiente (oracle): siete hallazgos cerrados, providers/guardas/busy/dirty coherentes, sin bloqueantes restantes en su alcance. No ejecutó tests ni sustituye la comprobación agregada.
- Comprobación propia: búsqueda de selectores/métodos locales solo devuelve aserciones negativas de tests; sin cambios en backend, contrato ni cliente generado. `git diff --check` del ámbito pasa.

## Validación final ejecutada por el orquestador

- `pnpm check`: **verde** en todas las etapas: formato, lint sin warnings, tipos, tests frontend, builds frontend, hash de contrato y build backend. Tests frontend: **529/529** (Console 343, public-web 119, libs 67). Gradle finalizó correctamente; sus tareas de tests/ArchUnit estaban up-to-date, sin forzar reejecución.
- `pnpm --filter @mapit/e2e exec playwright test tests/console/operational-establishment.spec.ts --project=console --project=console-tablet --workers=1`: **10/10 verdes**. Incluye restauración y cambio A/B recorriendo los cuatro módulos, ausencia de selectores locales, ruta directa sin preferencia, descarte rechazado, escritura QR pendiente bloqueando salida y plataforma independiente.
- Diagnóstico del aparente fallo intermitente de estructura: el caso compuesto consumía el presupuesto global de 30 s (repeticiones propias en tablet: 29,8 y 29,4 s). Se asignó 60 s únicamente al recorrido de ocho rutas/restauración/capturas, manteniendo límite de 10 s por respuesta de carga. La ejecución final tardó 31,7 s en desktop y 34,4 s en tablet; no se alteró producción para ese timeout. Diagnósticos sanitizados se adjuntan solo al fallar.
- Revisión visual de capturas de las cuatro pantallas y revisión a11y del diff: se conserva identidad y formularios, sin huecos por controles eliminados. El botón de cerrar error tiene `strings.dismissError` como nombre accesible, verificado en el código final.
- Persisten warnings no bloqueantes de presupuestos de bundles/estilos, compilación parcial de libs y dependencias CommonJS; no se elevaron presupuestos ni se añadieron dependencias para ocultarlos.

## Límites de la evidencia

- El E2E nuevo usa respuestas HTTP controladas y sesión de prueba: demuestra integración frontend, no autorización contra backend real. Se inspeccionaron controles existentes sin modificarlos; no se ejecutó `be:it`/Testcontainers ni toda la suite E2E.
- Se revisaron capturas y viewport desktop/tablet; no se ejecutó una auditoría manual exhaustiva de teclado ni pruebas en dispositivos físicos. La revisión visual señaló navegación lateral superpuesta en algunas capturas del shell existente; ese shell y su selector no se rediseñaron en este cambio.
- Sin commits ni push; los cambios anteriores del workspace permanecen intactos.
