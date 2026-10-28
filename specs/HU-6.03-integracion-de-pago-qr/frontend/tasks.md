# Tareas frontend QR

- [x] Inspeccionar dependencias, rutas, tokens y skills locales.
- [x] Obtener aprobación del plan y motion.
- [x] Principal: contratos fixture, dependencias verificadas y lockfile.
- [x] Public: checkout/comprobante, adaptadores, strings y pruebas.
- [x] Console: configuración refinada, escáner, guard/limpieza y pruebas.
- [x] Principal: Playwright/capturas y pruebas frontend completas.
- [x] QA: revisar seguridad, animaciones y Web Interface Guidelines.
- [x] Principal: informe con funcionalidad real/simulada/bloqueada.

## Notas

Backend previo preservado sin modificaciones. No instalación de skills/Figma/rediseño de marca. Sin publicación.

## Evidencia final

- pnpm fe:test: aprobado; 254 Console, 22 Public Web, 60 bibliotecas (336 total).
- Tras corregir exports CommonJS de qrcode, repetición focalizada pública: 18/18 aprobadas.
- pnpm fe:lint: aprobado, cero warnings de ESLint.
- pnpm fmt:check y git diff --check: aprobados al cierre.
- pnpm fe:typecheck y pnpm exec tsc -p apps/e2e/tsconfig.json --noEmit: aprobados.
- pnpm fe:build: aprobado en ambas apps; Console inicial702.37kB <1MB, Public Web277.71kB <800kB. QR y scanner diferidos.
- Playwright configuración payments: 9/9 aprobados en escritorio/tablet/móvil; creación y segunda comparación de baselines sin --update-snapshots aprobadas.
- 16 capturas comparadas con umbral maxDiffPixelRatio0.02; cero comparaciones fallidas. Incluye comprobante320px, QR PNG visible, cámara ZXing real sobre Y4M sintético, teclado/reduced motion y edición por cliente HTTP interceptado solo en test.
- Inspección visual agrupada: checkout/comprobante/recepción/configuración; sin desbordamiento horizontal y QR sin recorte a320px.
- Cámara física no utilizada. No pagos/reservas/ocupación reales modificados. No E2E financiero declarado.
- Guías oficiales Web Interface Guidelines consultadas; hallazgos funcionales/a11y corregidos. Revisión de animaciones: sin bloqueantes; repaint de color menor se dejó como propuesta opcional.
- Artefactos: apps/e2e/tests/payment-preview/snapshots/, apps/e2e/playwright-report/payments/ y report.md de esta carpeta.

## Correcciones verificadas

Resolución Vite de paquetes por app (prebundle solo dev desactivado), CSS público dividido sin ampliar budgets, import CommonJS qrcode normalizado, selector visual de escenario sincronizado, resultado accesible anunciado y recursos de cámara tardíos liberados.
Se retiró reloj global Playwright porque alteraba timestamps HMR de Angular; solo fecha variable de auditoría se enmascara en capturas. No se ocultó el fallo de QR: test reforzado exige imagen PNG visible.
