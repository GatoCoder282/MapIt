# Checkout y comprobante QR

Extensión operativa del sistema vigente, sin nueva paleta. Azul #2563EB; tokens globales, Inter y Manrope locales (assets/fonts, licencias OFL). Las guías antiguas de reservas se sincronizan con el azul global.

## Composición

- Checkout: encabezado simple, aviso de simulación persistente, selector de escenario y dos columnas método/resumen. Bajo 800px, resumen primero y controles después; no se ocultan importes ni se agrega drawer.
- Métodos: radio nativo con icono Lucide y descripción de verificación. QR bancario solo si existe imagen suministrada; el fixture estático no inventa una imagen cobrable.
- Comprobante: documento de reserva y anticipo/saldo con área de QR separada. Columna única en móvil, incluido 320px. El QR mantiene zona blanca y ancho limitado al contenedor.
- Loading, error/reintento, ámbito inexistente e integración no disponible tienen vistas explícitas. No se muestra comprobante pagado desde un estado pendiente.

## Movimiento y accesibilidad

Feedback de pulsación0.98/120ms solo sin focus-visible; estado/detalles160–180ms con --mapit-ease-out. QR/importes no se animan. Reduced motion elimina escalas/traslación, hover limitado a punteros finos.
Etiquetas asociadas, radios nativos, aria-live para cambios de estado, foco visible, cifras tabulares y formatos Intl. QR PNG con alt/dimensiones; código completo visible como alternativa.

Los escenarios son exclusivamente sintéticos y requieren opt-in development/test. Token fixture conocido no es credencial backend. Capturas y pruebas: apps/e2e/tests/payment-preview; no son evidencia de pago real.
