# Tareas

- [x] Eliminar selección global y sus pruebas específicas.
- [x] Simplificar navegación y barra de establecimiento.
- [x] Reducir configuración de pagos a MOCK de empresa.
- [x] Validar entorno, duplicados y aislamiento del estado frontend.
- [x] Adaptar pruebas existentes y ejecutar verificaciones.
- [x] Compilar consola en desarrollo y producción fuera del sandbox de Windows.
- [x] Completar capturas en navegador en escritorio, tablet y móvil.

## Notas de ejecución

La petición directa del usuario define el alcance; el texto adjunto se usa como referencia funcional. Hay cambios previos extensos en el workspace que deben conservarse.

El segundo documento del usuario restringe el trabajo a frontend: no se modificó ningún archivo del backend. La configuración usa PaymentMethodsApi → PaymentsService y PostgreSQL existente. No hay nueva persistencia local, librerías ni migraciones.

### Archivos y responsabilidades

- `apps/console/src/app/app.routes.ts`: retirada de ruta y guard del selector global.
- `apps/console/src/app/layout/staff-shell.{ts,html,scss}`: eliminación de barra de establecimiento y grupo duplicado de navegación.
- `apps/console/src/app/core/strings.ts`: catálogo de pantalla simple y limpieza de textos eliminados.
- `apps/console/src/app/features/payments/data/payment-methods-api.ts`: adaptador reducido a listar/crear/editar.
- `apps/console/src/app/features/payments/model/payment-methods-store{,.spec}.ts`: gestión MOCK de empresa, estado, errores, concurrencia de UI y cancelación por cambio de sesión.
- `apps/console/src/app/features/payments/ui/payment-methods.{ts,html,scss,spec.ts}`: listado y formulario alternados, sin QR bancario, políticas, movimientos ni permisos.
- `apps/console/src/app/features/check-in/ui/check-in.{ts,html,spec.ts}`: desacoplamiento de contexto global mediante el selector local ya existente.
- `apps/e2e/tests/console/{home-visual,floor-editor,templates}.spec.ts` y `apps/e2e/tests/public-web/activation.spec.ts`: entrada directa al home.
- `apps/e2e/tests/{payment-preview,payment-live}/flow.spec.ts`: retirada de pasos del selector y expectativas de paneles eliminados.
- `apps/console/design/check-in.md`: actualización explícita de las especificaciones afectadas por la simplificación solicitada.

Eliminados: `core/establishment-context{,-guard}{,.spec}.ts`, pantalla `features/establishment-context/ui/select-establishment.{ts,html,scss}` y stores de política, ledger y permisos de pagos con sus pruebas. No se eliminan pruebas de cobros, reservas ni aislamiento del backend.

### Verificación

- Suite completa de consola: 256 pruebas pasaron; una nueva prueba UI falló por esperar antes de finalizar la carga.
- Repetición tras corregir la espera: 10/10 pruebas afectadas pasan (store MOCK, UI de pagos y UI de recepción).
- TypeScript de aplicación, pruebas y E2E: pasó.
- Prettier de archivos afectados: pasó.
- ESLint del alcance modificado: pasó tras corregir el import solo de tipo de ElementRef.
- Detector Impeccable sobre las plantillas/estilos modificados: `[]`, sin hallazgos.
- Auditoría de correctness y a11y: consumidor de contexto global desacoplado; respuestas de otra sesión canceladas; foco al abrir/cerrar formulario y etiquetas de controles conservados.
- Web Interface Guidelines: checklist corrido, sin hallazgos pendientes en el alcance; formularios nativos, nombres, foco visible, feedback y reducción de movimiento revisados.
- Build de consola: development y producción pasaron fuera del sandbox. Dentro del sandbox hubo terminación nativa Windows `3221225477` (`0xC0000005`), sin diagnóstico Angular. Producción conserva avisos de budgets y CommonJS.
- Playwright: 9/9 recorridos frontend con mocks pasaron en escritorio, tablet y móvil. Se actualizaron solo las capturas afectadas de métodos, recepción y llegada; se eliminaron las tres capturas del selector global. Checkout y comprobante conservaron sus capturas. Capturas de formulario inspeccionadas visualmente sin desbordes. No se afirma equivalencia de píxeles con las imágenes de eliminación del usuario.
- La primera ejecución Playwright detectó una dependencia de runtime sin proveedor. Se corrigió usando RuntimeConfigStore, que es el servicio registrado por la aplicación, y se repitieron pruebas/validación visual.

Skills consultadas: impeccable (distill), correctness, a11y, design-system, extract-design-system y web-design-guidelines. Las capturas indican eliminaciones, por lo que no se recreó el diseño de referencia; extract-design-system está orientada a extraer sitios públicos, sin aplicación efectiva en esta tarea. No se añadieron animaciones ni una nueva dirección visual.

Pendiente de HU-6.03: descripción opcional en el contrato, proveedores reales, QR bancarios y demás ampliaciones fuera de esta solicitud. El bloqueo de activación MOCK existente del backend se conserva; guardar MOCK inactivo y garantizar unicidad concurrente requerirían un cambio backend expresamente excluido por el último documento.
