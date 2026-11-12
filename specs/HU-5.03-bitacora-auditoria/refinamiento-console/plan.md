# PLAN · Refinamiento de Console

1. Extender `features/audit/model/audit-store.ts` con filtro aplicado y tamaño de página. Reutilizar AuditApi y el cliente generado. Reorganizar `features/audit/ui/audit-page.{ts,html,scss}` para mostrar filtros, tabla y detalle adaptable. Derivar resúmenes de campos conocidos y conservar metadatos disponibles como texto.
2. Ajustar la lista en `features/payments/ui/payment-methods.{ts,html,scss}`. Reutilizar el toolbar y sus dos vistas, los stores, los estados, las acciones existentes y Lucide. Usar Angular CDK Menu, ya instalado, para navegación por teclado, cierre y restauración de foco. Verificar el presupuesto de CSS.
3. Reorganizar `features/check-in/ui/check-in.{ts,html,scss}` con modos de consulta y panel de resultado. Reutilizar CheckInStore, CheckInApi, QrScanner, QR lazy y LocalizedDatePipe. Detener cámara al pasar a entrada manual, preservar el resultado y actualizar las interacciones del E2E existente.
4. Mantener textos en `core/strings*.ts`, conservar el shell y sus tokens. Ajustar las suites de los tres módulos y los consumidores E2E existentes de acciones de pago y entrada manual. Validar lint, tests, build y capturas de Console en escritorio y móvil. Priorizar el stack real. Si el ambiente lo impide, registrar qué se verificó con respuestas controladas.

## Patrones de diseño aplicados

| Patrón                       | Por qué aquí                                                                              | Alternativa descartada                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| MVVM con signals             | Mantiene filtros, permisos, escrituras y resultados verificables en los stores existentes | Reimplementar las operaciones en componentes                          |
| Vista de tabla y detalle     | Conserva densidad en filas y expone el evento completo al seleccionarlo                   | Repetir identificadores y cambios extensos por fila                   |
| Menú de Angular CDK          | Reutiliza la gestión de teclado y foco ya instalada                                       | Implementar a mano la navegación del menú                             |
| Contexto operativo existente | Aísla borradores y resultados de pagos y check-in por local                               | Selección redundante o filtrado en cliente de una página de auditoría |

Dependencias y riesgos. Auditoría depende de la semántica real de fechas y de paginación del endpoint. Pagos depende de mantener las acciones de cada clase de método y del límite de 12 kB para estilos. Check-in depende de liberar la cámara al cambiar de modo y preservar las restricciones operativas.

## Plan de la segunda iteración

1. Ajustar las plantillas y los estilos de Auditoría, Pagos y Check-in. Aprovechar el ancho de contenido, reforzar los títulos y diferenciar las superficies con los tokens de Console.
2. En Check-in, retirar el bloque decorativo `camera-guide` y sus estilos. Revisar que las indicaciones de cámara describan el escaneo sin pedir centrarlo dentro de una guía.
3. En Pagos, derivar el resumen de los métodos visibles de los stores existentes. Mantener la navegación por teclado y el menú CDK. Ajustar el CSS dentro del presupuesto actual.
4. Repetir capturas de escritorio y móvil contra las tres nuevas referencias y ejecutar las pruebas focalizadas, lint y build. Comprobar un escaneo con la cámara virtual de Chromium.

## Plan de implementación · fidelidad 2026-11-04

**Objetivo:** reproducir las tres referencias sobre las vistas reales sin cambiar backend ni contratos.
**Arquitectura:** conservar MVVM/signals, servicios, rutas, contexto global y shell. Auditoría conserva su tabla semántica por la excepción aprobada; el listado de Pagos y los menús CDK existentes no se reemplazan.
**Stack:** Angular 22, tabla nativa, Lucide, SCSS tokens, Vitest y Playwright. Sin dependencias nuevas.
**Spec:** [spec.md](spec.md), sección de fidelidad aprobada; valores visuales en [design.md](design.md).

### Restricciones globales

- Backend, contratos, código generado y `/admin/*` intocables. No commits, reset ni eliminación de cambios previos del usuario.
- Auditoría de empresa y UUID exacto, sin N+1 ni nombres ficticios. Pagos/check-in dependen exclusivamente del `EstablishmentContext` existente.
- Sin nuevas animaciones, selectores, cookies, almacenamiento ni librerías.
- Textos en `core/strings*.ts`; Manrope/Inter, colores y radios existentes. Las capturas originales no están disponibles como archivos: comparación visual, no porcentaje inventado.

### Foco de revisión

Cambios de local durante consultas/escrituras; alcance tenant de auditoría; cámaras/permisos y llegada duplicada; navegación/foco de tabla y menú; desbordes y estados vacíos/error en los cuatro viewports.

### Tarea 1 · Baseline y contrato visual

Archivos: los tres documentos de diseño de esta carpeta; `apps/e2e/tests/console/operational-visual.spec.ts` y artefactos ignorados `apps/e2e/screenshots/operational-redesign/`.

- [ ] Actualizar tokens/componentes medidos o inferidos sin sobrescribir el sistema global.
- [ ] Añadir recorrido Playwright focalizado, login/fixtures reales, cuatro viewports y detección de errores/desborde.
- [ ] Ejecutar capturas BEFORE antes de modificar vistas; registrar cualquier barrera real del entorno.

### Tarea 2 · Auditoría

Archivos: `features/audit/ui/audit-page.{ts,html,scss}` y sus pruebas. Consume `AuditStore` sin cambiar su interfaz ni paginación remota. Produce tabla y detalle accesibles con datos existentes; manifests/lockfile no cambian.

- [x] Verificar paquete/versión/licencia: `primeng@22.1.4` exige clave válida según `LICENSE.md` del tarball oficial. Usuario aprobó conservar tabla nativa; no instalar ni eludir licencia.
- [ ] Añadir primero regresión de selección, cierre/foco, filtros y paginación; ejecutar la suite focalizada para establecer baseline.
- [ ] Ajustar tabla nativa con tokens MapIt e iconos Lucide; conservar orden y significado de las cinco columnas y paginación externa.
- [ ] Ajustar geometría con detalle alineado a filtros, no al encabezado; ejecutar `pnpm exec ng test console --no-watch --include "**/audit-page.spec.ts" --include "**/audit-store.spec.ts"`.

### Tarea 3 · Métodos de pago

Archivos: `features/payments/ui/payment-methods.{ts,html,scss}`, `payment-list.scss` y pruebas de pantalla. Consume ambos stores existentes; no modifica endpoints ni métodos.

- [ ] Verificar tests de tabs, resumen, menú de teclado y restricciones de herencia/pasarela; ampliar solo cobertura del cambio real.
- [ ] Reproducir banda activa, encabezado, tabs, lista y resumen; preservar todos los estados del asistente/formularios.
- [ ] Ejecutar `pnpm exec ng test console --no-watch --include "**/payment-methods.spec.ts"`; propietario de revisión valida el diff de este ámbito.

### Tarea 4 · Recepción y check-in

Archivos: `features/check-in/ui/check-in.{ts,html,scss}` y pruebas de pantalla. Consume `CheckInStore`, `CheckInApi` y `QrScanner` existentes sin cambiar protocolos.

- [ ] Verificar/añadir regresión de tabs, vídeo real, controles de cámara, resultado y limpieza; mantener pruebas de concurrencia del store.
- [ ] Reproducir las dos columnas, guía estática decorativa no interactiva, datos de resultado disponibles y acciones. Mantener cierre de cámara y semántica accesible.
- [ ] Ejecutar `pnpm exec ng test console --no-watch --include "**/check-in.spec.ts" --include "**/qr-scanner.spec.ts" --include "**/check-in-store.spec.ts"`.

### Tarea 5 · Reconciliación y evidencia final

- [ ] Revisar artefactos de los tres ámbitos, corregir copy en catálogos sin cambiar diseño y revisar Ponytail/a11y/Web Design Guidelines.
- [ ] Ejecutar una vez la verificación frontend completa tras reconciliar: `pnpm fe:lint`, `pnpm fe:typecheck`, `pnpm fe:test`, `pnpm fe:build`; formato y `git diff --check` focalizados. No ejecutar `pnpm check` si implica modificar/ejecutar backend prohibido; declarar cobertura.
- [ ] Ejecutar AFTER en las tres rutas/cuatro tamaños y comprobar teclado, estados y errores de consola. Inspección visual conjunta, una tanda de correcciones materiales y confirmación.
- [ ] Actualizar tasks/notas con comandos, resultados reales, capturas, desviaciones y pendientes. No reutilizar cifras de iteraciones previas como evidencia de ésta.

### Patrones aplicados en esta iteración

| Patrón                                          | Por qué aquí                                                                | Alternativa descartada                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------- |
| MVVM y contexto existentes                      | Preserva operaciones, permisos e invalidación ya probadas                   | Reescritura de stores/servicios                           |
| Tabla semántica con paginación remota existente | Excepción explícita aprobada sin dependencia licenciada ni estado duplicado | Carga de todo el historial para filtrar en cliente        |
| Tokens compartidos y estilos de feature         | Mantiene identidad sin propagar rediseño a toda Console                     | Sistema visual nuevo o overrides globales indiscriminados |
