# TASKS · Refinamiento de Console

- [x] Investigar las tres rutas, contratos, contexto global y componentes.
- [x] Contrastar la referencia con los tokens de Console.
- [x] Aplicar filtros y paginación en Auditoría.
- [x] Implementar tabla de Auditoría, panel de detalle e identificadores colapsables.
- [x] Compactar la lista de Pagos y agrupar sus acciones.
- [x] Separar los modos de Check-in y simplificar los estados de cámara y resultado.
- [x] Adaptar pruebas focalizadas y consumidores E2E.
- [x] Ejecutar lint, tests, build y revisión Ponytail.
- [x] Capturar y comparar las tres rutas en escritorio y móvil.

## Notas de ejecución

- Auditoría enlaza con [HU-5.03](../spec.md). La API aplica filtros de fecha, recurso, evento e ID de recurso sobre todo el tenant.
- Pagos continúa el [asistente existente](../../HU-6.03-integracion-de-pago-qr/metodos-de-pago-console/spec.md). Check-in reutiliza el [flujo de comprobantes](../../HU-6.03-integracion-de-pago-qr/receipt-check-in-design.md).
- Ponytail está instalado como plugin de OpenCode en modo `full`. Para este trabajo en Codex se consultaron sus reglas y la guía de revisión incluidas en el paquete instalado.
- OpenCode registró `full` en su configuración local, pero su CLI no listó plugins. Se aplicó la guía vendorizada al diff de forma manual.
- Pasaron `pnpm fe:lint`, `pnpm fe:test` (366 de Console, 122 de Public Web y 81 de librerías) y `pnpm fe:build`. La compilación emitió avisos de tamaño y dependencias CommonJS. Los cambios de Auditoría se verificaron también en una ejecución focalizada final.
- Playwright pasó el recorrido de QR Mock contra Spring y PostgreSQL aislados. Cubrió alta, edición del país, rechazo nativo del campo obligatorio, desactivación, regeneración y consulta táctil. El typecheck de E2E también pasó.
- Chromium ejecutó Console compilado con respuestas controladas y verificó paginación, UUID exacto, detalle, vacío y reintento de Auditoría. En Pagos comprobó el menú con teclado y el acceso a Políticas generales. En Check-in comprobó permiso denegado, entrada manual, lectura ZXing con cámara virtual y un único registro de llegada.
- Comparación de escritorio con los tres recortes del montaje, normalizados a 160 × 100 px y con diferencias mayores que 32 en un canal. Auditoría 18,79 %, Pagos 22,21 % y Check-in 31,46 %. El montaje tiene otra escala de shell y otros datos. El alcance de empresa y la búsqueda exacta de Auditoría, y el inicio explícito de la cámara, son adaptaciones funcionales.

## Segunda iteración

- [x] Contrastar las nuevas referencias con las vistas existentes.
- [x] Ajustar jerarquía, ancho y composición en los tres módulos.
- [x] Eliminar la guía superpuesta en Check-in y verificar la lectura QR.
- [x] Agregar el resumen derivado de Pagos y verificar los estados existentes.
- [x] Validar el panel de Auditoría, los estados responsive y las capturas nuevas.

Pasaron 19 pruebas focalizadas, ESLint de los archivos afectados y la compilación. Chromium ejecutó el bundle de Console con respuestas controladas y cámara virtual. Verificó la lectura QR sin elementos sobre el vídeo, la alineación de filtros y detalle en Auditoría, los totales de Pagos y el ancho sin desborde en escritorio y móvil.

Comparación de capturas anteriores y nuevas contra las referencias individuales, normalizadas a 160 × 100 px con tolerancia de 32 por canal. Auditoría pasó de 17,19 % a 16,98 %, Pagos de 14,79 % a 15,49 % y Check-in de 33,77 % a 27,44 %. La medida incluye el shell y datos ilustrativos distintos. En Check-in también incluye la eliminación de la guía que sí aparece en la referencia.

## Fidelidad visual · 2026-11-04

- [x] Investigar las tres vistas, contratos, contexto, herramientas y restricciones actuales.
- [x] Obtener aprobación: alcance empresa de Auditoría, comparación sin diff numérico y excepción final para tabla nativa tras verificar licencia PrimeNG.
- [x] Registrar spec y plan de esta iteración sin alterar evidencia histórica.
- [x] Actualizar los tres documentos visuales y reconciliar con tokens globales.
- [x] Capturar estado inicial de las tres vistas en los cuatro viewports.
- [x] Ajustar y verificar tabla nativa/detalle de Auditoría.
- [x] Ajustar y verificar Métodos de pago conservando operaciones.
- [x] Ajustar y verificar Check-in conservando cámara y llegada en la implementación y pruebas automatizadas; cámara física pendiente.
- [x] Revisar diff, accesibilidad, simplicidad y guidelines.
- [x] Ejecutar verificación frontend completa y capturas finales.
- [x] Entregar informe de evidencia y limitaciones reales.

### Notas de ejecución de esta iteración

- Aprobación del usuario: «Usar PrimeNG p-table», «Continuar sin diff numérico», «continua».
- Decisión posterior que prevalece: «Conservar tabla nativa». Se leyó `LICENSE.md` del tarball npm oficial `primeng@22.1.4`: exige clave válida y puede mostrar aviso sin ella; no se incorporó el paquete ni se eludió ese mecanismo.
- Ruling: trabajar en la rama de feature actual y conservar los cambios previos sin stash/reset/commits. Un worktree nuevo desde HEAD perdería el estado no versionado que estas vistas ya necesitan.
- Baseline de cambios previos guardado fuera del repo en `C:/Users/matia/AppData/Local/Temp/opencode/mapit-ui-baseline{.diff,-status.txt}`. No constituye evidencia de pruebas.
- Se detectaron listeners en 4200, 4300 y 8080; se reutilizarán. Salud, autenticación y datos todavía deben verificarse mediante el recorrido real.
- Evidencia asignada: cada implementador ejecuta solo sus suites focalizadas; coordinador reconcilia y ejecuta comprobación frontend completa una vez. Playwright genera capturas y diagnóstico de geometría; revisión visual no equivale a medición píxel a píxel.
- Baseline real: `MAPIT_VISUAL_PHASE=before pnpm --filter @mapit/e2e exec playwright test --project=console tests/console/operational-visual.spec.ts` pasó tras corregir el recorrido de autenticación del test. Artefactos: `apps/e2e/screenshots/operational-redesign/before-report.json` y 12 PNG. Incluyen estados vacíos de la fixture real, no filas/reservas inventadas.
- Se descartó el primer intento de capturas porque mostraba login. El recorrido ahora exige sesión/contexto, ruta y contenido específicos y navegación SPA; un heading genérico no prueba que la ruta solicitada se haya cargado.
- Implementación reconciliada en vistas: Auditoría mantiene tabla nativa y todas sus columnas, scroll local y pie al fondo; Pagos ajusta banda/lista/resumen; Check-in recupera guía estática abierta, controles de cámara y ayuda. Ningún servicio ni contrato nuevo.
- El chequeo estático de referencias `--mapit-*` en los cuatro SCSS afectados resuelve todos los tokens usados contra el archivo compartido y las variables locales. Se corrigió el token inexistente `--mapit-space-5` durante revisión.
- Impeccable: se ejecutó `impeccable.cmd context --target apps/console/src/app/features/audit` y, tras reconciliar vistas, `detect --json` sobre los tres ámbitos. Marcó la barra azul de Pagos (requerida por referencia) y dos `<img>` como faltos de `src` (usan `[src]` Angular dentro de condiciones de imagen). No se aplican cambios automáticos por esas advertencias.
- Verificación completa del frontend de esta iteración: `pnpm fe:lint`, `pnpm fe:typecheck`, `pnpm fe:test` y `pnpm fe:build`, todos con código de salida 0. Vitest: Console 367, Public Web 122, librerías 81 (570 total). Logs fuera del repo: `C:/Users/matia/AppData/Local/Temp/opencode/mapit-ui-validation/`.
- Build con advertencias, no errores: Console inicial 783,32 kB y Public Web 498,55 kB; presupuestos de aviso CSS superados, incluidos Auditoría 8,57 kB, Check-in 9,62 kB y estilos principales de Pagos 11,14 kB (por debajo del límite de error de 12 kB por hoja); dependencias CommonJS existentes. No se modificaron presupuestos para ocultar avisos.
- Primer AFTER falló antes de capturas válidas. Se escaló el diagnóstico del spec: un valor DOM de contraseña no acredita sincronización de `ngModel`, y faltaba esperar la inicialización del contexto en el suplemento. La corrección se limita al test; no se cambia autenticación ni backend. Las capturas AFTER y el suplemento poblado siguen pendientes de evidencia.
- AFTER corregido: login mediante API real y restauración estándar de sesión (no prueba del formulario login). Pasaron por separado el recorrido `operational visual captures` y `mocked populated operational views`, ambos con `--project=console --workers=1`. Reportes `empty-real-after-report.json` y `populated-controlled-after-report.json`: 12 capturas reales vacías y 12 pobladas controladas; no se confunden mocks con evidencia de autorización backend.
- Revisión visual de escritorio/móvil: se ampliaron objetivos táctiles a 44 px; se corrigió la guía para mostrar esquinas abiertas; el resultado de Check-in pasó a pares etiqueta/valor y el UUID completo quedó en un disclosure semántico separado. Datos de cliente/cantidad ausentes no se inventaron. La animación de entrada señalada por revisión ya existía en HEAD, por lo que no se eliminó ni se presentó como una adición nueva.
- Verificación tras ajustes finales: 28 pruebas focalizadas en cinco archivos, tipos de Console y E2E, build de Console y ESLint focalizado con 0 warnings, todos pasaron. Console inicial 783,43 kB, con avisos de presupuesto/CommonJS conservados. Tras mover el disclosure fuera del `dl`, también pasó de nuevo `check-in.spec.ts` (2 pruebas).
- Pendiente de confirmación final: regenerar capturas con resultado de reserva antes de registrar llegada y pestaña de escaneo visible. No se afirma equivalencia píxel a píxel. Cámara física y lectura óptica real no verificadas en este entorno; las pruebas del scanner no las sustituyen.

### Cierre · 2026-11-05

- Confirmación final: las dos pruebas de `operational-visual.spec.ts` pasaron con `MAPIT_VISUAL_PHASE=final`, `API_BASE_URL=http://127.0.0.1:8080/api/v1`, `--project=console --workers=1`. Se preservaron las 12 capturas BEFORE; los reportes `empty-real-final-report.json` y `populated-controlled-final-report.json` acompañan 12 capturas reales vacías y 12 pobladas controladas en los cuatro viewports solicitados.
- El recorrido real recibió 25/25 respuestas HTTP 200. El suplemento verificó filtros, paginación y detalle de Auditoría; filas/estado/resumen/menú de Pagos; tabs de teclado, consulta, llegada única y limpieza de Check-in. El rechazo de permiso de cámara se inyectó únicamente en el test y se restauró después: **no es una prueba de cámara física ni lectura QR real**.
- La captura final de Check-in muestra escaneo y reserva confirmada antes de registrar llegada. Una aserción comprueba que el botón principal queda dentro de 1600 × 900 sin auto-scroll. Se ocultó solo el ornamento en móvil para no invadir el texto. Las capturas pobladas de móvil son de página completa y los reportes distinguen ese modo del viewport de escritorio.
- Las pruebas finales no registraron errores de consola/página ni API inesperadas. El recorrido real y el suplemento no reportan desborde horizontal del documento. La tabla de Auditoría mantiene scroll horizontal local para conservar columnas.
- Última confirmación del producto: ESLint focalizado, Prettier, tipos de Console y build de Console pasaron tras el ajuste final; inicial 783,54 kB. Check-in CSS 10,70 kB, Auditoría 8,64 kB y estilos principales de Pagos 11,14 kB: avisos por encima de 4 kB, por debajo del error de 12 kB. No se relajan budgets.
- Web Design Guidelines y revisión a11y: se corrigieron objetivos táctiles y semántica del disclosure; se retiró el hallazgo erróneo de animaciones nuevas porque eran preexistentes. Ponytail: sin dependencias, servicios, estados de selección ni componentes compartidos nuevos; se simplificó la geometría de esquinas reutilizando una guía común.
- `design-taste-frontend` estaba instalado. Se consultó y se ejecutó solo su preflight `lint.mjs` sobre las vistas: 17 FAIL y 20 WARN de reglas de landing (puntos mediante radial-gradient, sombras, bordes/divisores y eyebrow). Son rasgos explícitos de las referencias y la UI operativa; se registran, no se aplican automáticamente ni se cambia la dirección visual. No se ejecutó generación de dirección, imágenes ni motion; no se inventaron dials ausentes de esta versión.
- `extract-design-system` se consultó: su flujo oficial exige una URL pública y no extrae imágenes locales; no se ejecutó su CLI ni se simuló una extracción. La consistencia se contrastó con `libs/ui-kit/DESIGN.md`, `_tokens.scss` y las tres guías locales de `design-system`.
- Límites de entrega: sin porcentaje de similitud por aprobación expresa; shell y tokens existentes conservados; Auditoría de empresa y búsqueda UUID según el contrato; nombres, cliente y cantidad de personas no se fabrican cuando faltan. Cámara física, lectura óptica QR real y autorización backend bajo todas las variantes de rol requieren validación adicional; no se presentan los mocks como prueba de esos aspectos.
