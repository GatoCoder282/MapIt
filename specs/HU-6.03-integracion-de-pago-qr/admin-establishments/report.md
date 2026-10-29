# Administración de pagos y contexto de establecimiento

## Resultado implementado

Console exige elegir un local físico antes de entrar en las rutas operativas. Una cookie de preferencia recuerda el ID durante 30 días por usuario y tenant, con SameSite=Lax, Path=/ y Secure cuando se utiliza HTTPS. Al restaurarla, se consulta primero GET /establishments/accessible; un ID ajeno o revocado nunca habilita acceso. Cambiar establecimiento está en Configuración y en la barra del local activo. Salir del establecimiento borra esa preferencia; cerrar sesión conserva el recuerdo del usuario y elimina la sesión de autenticación.

Una empresa sin locales puede acceder a la administración empresarial para crear el primero. No se selecciona automáticamente un único local. SUPER_ADMIN permanece en el shell de plataforma. Las pantallas empresariales existentes conservan su alcance empresarial; pagos y check-in consumen el contexto operativo seleccionado.

Administración → Configuración → Métodos de pago dispone de ruta canónica y alias /payment-methods. Configura titular, banco, cuenta pública, país, moneda, QR, proveedor y alcance. Distingue métodos heredados, configuración empresarial y configuración local. Los receptores de métodos utilizados se conservan; el reemplazo crea un método inactivo y desactiva el anterior. El listado de pagos utiliza HTTP real, filtros, paginación y verificación manual contextual con referencia bancaria y confirmación explícita del ingreso.

ADMIN representa al administrador de la empresa y puede administrar todos sus locales propios. STAFF requiere concesión explícita persistida para check-in y salas de establecimiento. El servidor revalida concesiones durante la entrega STOMP y deja de entregar eventos después de revocar acceso. No se introduce un administrador local implícito ni privilegios financieros de plataforma. V23 añade titular nullable para legado y establishment_staff_access con FKs por tenant, índice único compuesto y RLS; V21 y V22 permanecen intactas.

Public Web distingue empresa y establecimiento, filtra el catálogo por tenantSlug, pagina y muestra dirección, código y zona horaria existentes. La consulta directa de metadata usa ambos slugs y no depende de que el local aparezca en la primera página. Disponibilidad, reserva, checkout y comprobante muestran ese contexto. La autorización de recursos y reservas sigue en backend; no se crea Branch, no se inventan coordenadas ni horarios.

## Real, simulado y pendiente

- Real: configuración, titular/QR, política, listado, permisos, selección/cookie, catálogo y metadata, reserva, credencial pública, persistencia, comprobante, check-in, auditoría y STOMP.
- Simulado explícitamente: proveedor MOCK_GATEWAY y escenarios de desarrollo; las pruebas visuales de preview usan adaptadores sintéticos. La prueba conectada utiliza HTTP/PostgreSQL/STOMP reales y simula solamente al proveedor de dinero.
- Pendiente: banco/pasarela real, credenciales y sandbox autorizados, eventual rol administrativo restringido a un local, PR/CI remoto y captura de Checks. No se publican cambios ni se modifica Jira.

## Validación

- pnpm fe:test: 277 Console + 43 Public Web + 64 librerías = 384 aprobados. Se aprobaron tres regresiones adicionales: ámbito visible de edición, recepción con opciones asincrónicas y revalidación al autenticar de nuevo al mismo usuario (387 casos únicos en total). Incluye selección, aislamiento por usuario/tenant, cookies revocadas, respuesta obsoleta, guard, navegación, titular, reemplazo, filtros, verificación, permisos y cámara.
- pnpm fe:typecheck y pnpm fe:lint: aprobados.
- Builds de ambas aplicaciones aprobados. Inicial final Console 723,07 kB y Public Web 279,82 kB; QR/lector y pantallas permanecen diferidos. Persisten avisos de presupuesto blando y CommonJS, sin aumentar límites. Console se verificó finalmente en serie con NG_BUILD_MAX_WORKERS=1: una compilación concurrente con otro proceso Angular terminó con cierre nativo de Node (0xC0000005). No se alteraron dependencias ni cachés.
- pnpm api:lint y pnpm api:check: aprobados; dos avisos anteriores de respuestas 4xx en health/demo.
- Gradle test y bootJar: aprobados. Integración completa: 132 pruebas; 127 aprobaron y cinco detectaron fechas fijas de HU-6.02 dependientes de la hora real. Se añadió Clock fijo en su fixture; su clase completa (7 pruebas) reaprobó mediante ejecución dirigida, sin modificar reglas de producción. Pruebas del controlador público ampliado: 4 aprobadas. Spotless aprobado.
- V23 aplicada y comprobada en PostgreSQL local; V21, V22 y V23 figuran success=true. Sin repair, borrado ni reconstrucción de datos.
- Prettier y git diff --check aprobados. Lint y tipos reejecutados con los binarios locales cuando pnpm intentó consultar el registro fuera del sandbox; no se instaló ninguna dependencia.
- E2E conectado aprobado: selección inicial entre dos locales, cookie, recarga, cambio/salida, configuración por HTTP, catálogo público filtrado, reserva, cobro MOCK_GATEWAY por webhook HTTP, comprobante y check-in persistido ACTIVE/OCCUPIED con actualización STOMP. PostgreSQL y backend aislados; contenedor de prueba limpiado.
- E2E visual: 9 aprobados en escritorio/tablet/móvil; referencias regeneradas y comparación final también 9 aprobados. Se fijó scroll al inicio antes de capturar para estabilizar el sidebar sticky. Cámara virtual y decodificador ZXing real; no se probó una cámara física.
- Suite E2E general: se adaptaron los fixtures de activación, plantillas y plantas al selector obligatorio y al ADMIN empresarial. Verificados sus tipos; no se ejecutó toda la suite general ni CI remoto en esta entrega. No se declara el ticket aprobado para revisión remota.

## Evidencia local

- [Selector inicial, escritorio](C:/Users/matia/Desktop/MapIt/test-results/payment-live/selector-initial-desktop.png).
- [Selector inicial, móvil](C:/Users/matia/Desktop/MapIt/test-results/payment-live/selector-initial-mobile.png).
- [Configuración con API real](C:/Users/matia/Desktop/MapIt/test-results/payment-live/payment-settings-real.png).
- [Checkout conectado](C:/Users/matia/Desktop/MapIt/test-results/payment-live/checkout-real.png), [comprobante](C:/Users/matia/Desktop/MapIt/test-results/payment-live/receipt-real.png) y [llegada persistida](C:/Users/matia/Desktop/MapIt/test-results/payment-live/check-in-real.png).
- Baselines: apps/e2e/tests/payment-preview/snapshots/ (19 capturas).
- Informe Playwright: apps/e2e/playwright-report/payments/index.html; recorrido conectado en apps/e2e/playwright-report/payment-live/index.html.

## Revisión de diseño y movimiento

Se extendió el diseño existente con impeccable, sin dependencias ni paleta nueva. Se consultaron las [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Selector con radios nativos, labels, fieldset, foco visible, estado vacío/error/reintento y cortes de texto largo. Importes y QR no animan.

| Antes                                                                        | Después                                                                                            | Motivo                                      |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| La pulsación de la tarjeta pública conservaba escala en movimiento reducido. | Se elimina transform en ese modo.                                                                  | Evitar movimiento solicitado como reducido. |
| Selector sin feedback de pulsación.                                          | Escala 0.98 durante 120 ms con --mapit-ease-out, excluyendo foco de teclado y movimiento reducido. | Feedback breve conforme al plan autorizado. |

Revisión de movimiento: no se añadieron animaciones de layout, barridos del escáner ni librerías. La duración explícita del plan del usuario prevalece sobre recomendaciones generales de la skill. La revisión final es local; no se presenta como aprobación independiente ni de CI.
