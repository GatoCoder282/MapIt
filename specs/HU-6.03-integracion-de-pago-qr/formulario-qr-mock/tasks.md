# Tareas

- [x] Reemplazar formulario y store por configuración QR de prueba en memoria.
- [x] Retirar adaptador persistido sin consumidores y ajustar pruebas.
- [x] Comprobar defaults, guardado local, aislamiento de sesión, tipos y accesibilidad.

## Notas de ejecución

La prueba se descarta al recargar o salir de la pantalla. No se carga QR ni se envía información bancaria al backend. El campo establecimiento pertenece a este formulario y no restaura el selector global eliminado.

Se sustituyeron `payment-methods-store.ts`, su prueba, el componente/plantilla de pagos y su prueba; se adaptaron sus estilos, `STRINGS`, el recorrido de configuración y las capturas de Playwright. Se retiró `payment-methods-api.ts` porque el formulario ya no realiza operaciones persistidas. Se actualizó la especificación visual en `apps/console/design/check-in.md`.

Verificación: 7 pruebas unitarias/UI pasan; 3 recorridos Playwright pasan en escritorio/tablet/móvil, incluyendo valores iniciales, ausencia de peticiones a pagos, guardado local y borrado al recargar. Typecheck de aplicación y ESLint pasan. Prettier y detector Impeccable pasan (sin hallazgos). Producción compila fuera del sandbox de Windows con los avisos de tamaño/CommonJS existentes. Revisión de accesibilidad y Web Interface Guidelines completada: etiquetas nativas, foco visible, mensajes accesibles y controles de al menos 44px. No se afirma integración backend ni comparación exacta contra una imagen de referencia.
