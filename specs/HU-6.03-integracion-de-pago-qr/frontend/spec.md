# Frontend QR — especificación aprobada

Alcance aprobado por usuario: configuración real, checkout/comprobante/check-in en rutas finales con mocks explícitos y animaciones contenidas. Backend, OpenAPI y generado intactos en esta etapa.

## Criterios

- ADMIN configura mediante API existente; otros roles no editan métodos.
- Preview requiere configuración explícita y build de desarrollo/test; no fallback ante error de API.
- Producción sin integración muestra indisponibilidad y no confirma nada.
- Checkout muestra snapshot, anticipo/moneda, método y todos los estados de pago simulados.
- QR generado solo contiene URL MapIt de checkout/comprobante; QR bancario siempre imagen suministrada, no generado.
- Comprobante solo muestra pago verificado en fixtures confirmadas y distingue anticipo/saldo.
- Escáner requiere ADMIN/STAFF, cámara a petición, alternativa manual, consulta por adaptador, llegada explícita/idempotente y limpieza completa de recursos.
- Token fixture sintético no constituye credencial; token/tenant/establecimiento inválidos no operan ni siquiera en demo.
- Reutilizar azul #2563EB y tokens; strings en catálogos, Signals y data/model/ui.
- Animaciones 120/160/180/220ms según plan, QR/importes estables, reduced-motion sin traslación/escala.
- Pruebas unitarias y Playwright/capturas escritorio/tablet/móvil; no declarar E2E financiero real.
