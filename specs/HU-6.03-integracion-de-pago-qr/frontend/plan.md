# Plan frontend QR

## Contratos y propietarios

Principal: tipos/fixtures compartidos en api-client no generado, dependencias/lockfile, documentación, E2E/visual/revisión. Agente public: apps/public-web excepto package.json. Agente console: apps/console excepto package.json. QA independiente: solo lectura.

Rutas: /pago/:tenantSlug/:establishmentSlug/:reservationId, /comprobante/:token, /check-in (ADMIN/STAFF). Modo paymentPreviewEnabled opt-in en runtime config, habilitado solo development/test y isDevMode(). Portadores de datos reales aún indisponibles fallan cerrado.

Fixtures compartidas exclusivamente sintéticas, sin llamadas HTTP financieras. No eventos STOMP nuevos; adaptadores simulan cambios/reconexión solo demo. Los valores de token fixture no autorizan backend.

## Patrones de diseño aplicados

| Patrón                       | Por qué aquí                               | Alternativa descartada |
| ---------------------------- | ------------------------------------------ | ---------------------- |
| Puertos/adaptadores frontend | Cambiar mocks por API cuando haya contrato | Inventar endpoints     |
| MVVM Signals                 | Estado verificable separado de plantilla   | Estado en componente   |
| Lazy loading                 | Cámara/QR fuera del bundle inicial         | Import global          |
| Fixture compartida           | Continuidad reproducible entre apps        | Datos incompatibles    |

## Diseño y validación

Impeccable + tokens existentes. CSS nativo/Angular para feedback y cambios; sin nuevas libs motion. qrcode public-web y ZXing browser console. Pruebas de estados/seguridad/lifecycle; Playwright pruebas de frontend simuladas con aviso persistente, cámara virtual/imagen QR, screenshots y overflow.
