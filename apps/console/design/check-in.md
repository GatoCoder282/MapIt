# Recepción, escaneo y métodos de cobro

Conserva shell, tokens azul #2563EB, Inter/Manrope y densidad operativa. No introduce tabla/gráfico ni primitiva adicional.

## Recepción

Selección local de establecimiento dentro de recepción, panel cámara/manual y panel de reserva. No hay selección global al entrar ni barra de establecimiento en el shell. Dos columnas amplias; bajo1024px se apilan. Cámara reservada4:3 sin barrido ni elementos animados sobre el QR.
Inicio y parada explícitos, selector de cámara, alternativa de enlace/código. Errores de HTTPS, permiso o dispositivo permiten continuar manualmente. Cambio de establecimiento/datos invalida consulta previa.
Resultado: ubicación multi-elemento, horario, estados separados, anticipo/saldo y acción de llegada. Anuncio persistente accesible, llegada explícita/idempotente, auditoría visible identificada como sintética.

## Métodos

«Configuración QR propio» guarda la configuración de desarrollo en el backend por tenant y establecimiento. El establecimiento se elige entre locales autorizados de la API y el país proviene del catálogo internacional ISO del servidor.

Cada selector es una única caja combinada: muestra la selección y abre una lista filtrable por nombre, dirección o código. Flechas y Enter seleccionan; Escape y Tab cierran. Solo confirmar una opción establece el UUID/ISO; escribir texto libre invalida la selección hasta elegir una opción válida. La dirección aparece debajo del nombre en las opciones. Los estados de carga deshabilitan el control y la búsqueda vacía muestra un mensaje.

Guardar envía el UUID y el código ISO mediante el cliente OpenAPI. El listado, edición, activación y regeneración persisten en PostgreSQL. La imagen QR se reconstruye desde la URL de simulación al recargar, sin incorporar datos bancarios. Se mantiene el bloqueo fuera de development/dev/test; el backend exige además habilitación explícita y aislamiento por tenant.

## Movimiento y accesibilidad

Pulsación0.98/120ms sin focus-visible, avisos160ms y detalle180ms. Movimiento reducido sin transform. Formularios nativos, foco visible, estado anunciado y acciones táctiles de44px. QR/video/importes estables.
Capturas escritorio/tablet/móvil y tests de teclado en apps/e2e/tests/payment-preview. La cámara virtual de pruebas sustituye hardware físico; los datos demo jamás modifican mapa, reservas o auditoría reales.
