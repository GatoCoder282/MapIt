# Informe frontend QR — implementación del plan aprobado

> Informe histórico de la etapa de preview. La integración posterior con HU-6.02, API y check-in persistido se documenta en [integration/report.md](../integration/report.md).

## A. Resumen

Configuración real de métodos preservada. Checkout, comprobante y recepción/check-in en rutas finales con adaptadores explícitamente sintéticos. Ningún pago/reserva/espacio real se confirma por estos mocks. Backend, OpenAPI y generado no recibieron cambios nuevos en esta etapa.

## B. Arquitectura

Features data/model/ui y Signals. Tipos de presentación y fixtures compartidos no generados en api-client, separados del contrato HTTP. Puertos y adaptadores frontend permiten sustituir fixtures cuando haya APIs estables.
paymentPreviewEnabled es false por defecto; requiere opt-in, entorno development/test e isDevMode(). No hay fallback a mocks ante error HTTP ni apertura de salas STOMP al público.
Rutas: /payment-methods (ADMIN); /pago/:tenantSlug/:establishmentSlug/:reservationId; /comprobante/:token; /check-in (ADMIN/STAFF).
Mock de recepción valida token fixture, tenant demo, establecimiento y permisos antes y después de esperas. Llegada explícita/idempotente solo actualiza datos en memoria y auditoría sintética. Token de fixture fijo/público, sin validez en backend ni garantía de identidad.

## C. Subagentes y skills

Principal: contratos compartidos, dependencias, Playwright/cámara virtual, capturas, pruebas e integración.
Agente Public Web: checkout/comprobante, adaptadores/stores, catálogos, formatos y QR.
Agente Console: configuración, escáner, lifecycle de cámara, guards, llegada y pruebas.
QA independiente de solo lectura: aislamiento, permisos, recursos tardíos, stale responses y motion.
Skills aplicadas: impeccable, pick-ui-library, find-animation-opportunities, animate, review-animations y web-design-guidelines. No Figma ni instalación de skills nuevas.
Checklist: imagen no; React no; motion sí; jerarquía sí; múltiples vistas sí; capacidad QR sí; nueva dirección visual no.
extract-design-system instalada extrae sitios públicos; no se ejecutó una extracción ajena para comparar tokens locales. design-taste instalada no es necesaria para reinventar estas pantallas operativas.

## D. Cambios y dependencias

- Public Web: qrcode 1.5.4 MIT y @types/qrcode 1.5.6 desarrollo; generación PNG solo de URLs MapIt de checkout/comprobante. Nunca QR bancario arbitrario.
- Console: @zxing/browser 0.2.1 MIT, motor peer @zxing/library 0.23.0; import diferido únicamente al iniciar cámara.
- Reutilizadas fuentes WOFF2 latinas Inter/Manrope ya instaladas, con licencias OFL copiadas; no se añadió librería de fuentes.
- Tokens azul #2563EB conservados y referencias documentales antiguas sincronizadas.
- Angular serve sin prebundle: el optimizador Vite de la raíz no resuelve dependencias limitadas a paquetes de app y sus transitivas. Angular las empaqueta conservando imports diferidos; producción mantiene sus presupuestos y chunks.
- Estilos públicos separados en común/checkout/comprobante para cumplir límite de componente sin ampliar budgets.
- Playwright payments config separada y cámara Y4M generada en .tmp ignorado. No usa cámara física.
- Corrección mínima de workers opcional en configuración Playwright existente para exactOptionalPropertyTypes; sin cambio de concurrencia efectiva.

## E. Comportamiento y aceptación

| Capacidad                           | Estado y evidencia                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Administración métodos real         | Cliente generado GET/POST/PUT existente; UI/store probados. Playwright intercepta HTTP solo dentro del test de edición. |
| Checkout/resumen/anticipo/moneda    | Implementado con fixtures explícitas; escenarios pendiente/manual/confirmado/fallido/expirado/conciliación/carga/error. |
| QR compartir checkout               | Opcional, enlace MapIt de demo; no paso obligatorio ni QR bancario.                                                     |
| Comprobante                         | Solo fixture confirmada; anticipo/saldo y QR de URL sintética. No factura fiscal ni recibo bancario.                    |
| Escaneo                             | Cámara ZXing real y alternativa manual; contexto seguro, dispositivo, denegación, cancelación y limpieza tardía.        |
| Consulta y check-in                 | Simulados; tenant/establecimiento/rol revalidados, llegada explícita sin doble ocupación en fixture.                    |
| Actualización de espacios/auditoría | Únicamente vista y datos sintéticos de recepción; no modifica dashboard/mapa real.                                      |
| Realtime/reconexión                 | Simulación en adaptador de prueba, sin nuevo transporte ni evento oficial STOMP.                                        |
| Tokens seguros backend              | Bloqueado; token de fixture conocido no es credencial real ni evidencia de pago.                                        |
| Confirmación bancaria/check-in real | Pendiente de HU-6.02/HU-5.02, precios/políticas y contratos backend.                                                    |

Motion: feedback120ms scale0.98 solo puntero (excluye focus-visible); estados/detalles160–180ms con curva existente. Sin movimiento de QR/importes/video; reduced-motion retira escala/traslación. No se creó drawer móvil innecesario; el resumen se apila visible. Los 220ms reservados al panel móvil no se aplican a una superficie que no existe.
Revisión estática: sin bloqueantes después de corregir método manual que cambiaba a mock, anuncio accesible del resultado y límite de ancho QR. Observación opcional no aplicada: retirar transiciones de color de superficies pequeñas; no se amplió el polish aprobado.

## F. Verificación

- Suite frontend completa: 254 Console + 22 Public Web + 60 bibliotecas, aprobadas.
- Tipos finales de ambas apps y E2E: aprobados.
- Lint completo final: aprobado, cero warnings de ESLint.
- pnpm fmt:check y git diff --check: aprobados al cierre.
- Builds finales aprobados: Console inicial702.37kB dentro de1MB; Public Web277.71kB dentro800kB. QR/scanner quedan diferidos. Persisten avisos no bloqueantes de600kB en Console, CSS sobre4kB y CommonJS.
- Playwright: 9/9 aprobados en tres viewports. Recorrido simulado checkout→comprobante→cámara virtualZXing→llegada, seguridad sin opt-in y edición administrativa con HTTP interceptado. Comparación final sin regenerar baselines también aprobada.
- 16 baselines nuevas de escritorio/tablet/móvil y comprobante320px;16 comparaciones dentro del umbral2%, cero fallos visuales. No comparan contra una imagen de referencia suministrada. Inspección visual agrupada completada; QR visible y sin recorte, sin overflow horizontal.
- Fecha de auditoría simulada enmascarada en captura por ser variable; los demás datos/QR se verifican. Reloj global virtual retirado porque interfería con URLs HMR Angular; no se ocultó un error de producto.
- Fallos encontrados y corregidos: resolución de paquetes Vite, budget CSS, exports CommonJS qrcode que impedían mostrar QR y selección visual de escenario. Prueba reforzada exige PNG visible, no solo host del componente.
- No se ejecutó pnpm check (incluye backend) ni E2E financiero real en esta etapa frontend.

## G. Límites

Los proveedores reales no se conectan. No hay webhooks HTTP integrados, conciliación @Scheduled nueva ni confirmación backend por QR. No se publicaron cambios ni se alteró Jira.
Los desajustes previos de peers Vitest/chokidar y los avisos de build se registran sin instalar reemplazos ni elevar budgets. Las pantallas nuevas también producen avisos CSS sobre 4 kB, dentro del límite de error de 12 kB. qrcode CommonJS y su dijkstrajs producen avisos nuevos y permanecen diferidos.
El modo demo no comparte estado realtime entre orígenes; utiliza fixtures consistentes y escenarios locales. La prueba de navegador valida continuidad de presentación, no atomicidad financiera entre servicios.

## H. Uso y próximos pasos

En desarrollo, activar paymentPreviewEnabled en assets/config.json de cada app; Console requiere usuario autenticado ADMIN/STAFF del tenant demo. Mantener false en despliegues y nunca usar token de fixture como credencial.
Ejecutar: pnpm --filter @mapit/e2e exec playwright test --config playwright.payments.config.ts.
Conectar puertos a APIs futuras solo después de estabilizar reservas, precio/anticipo, comprobantes con hash y autorización por establecimiento. Reutilizar outbox/STOMP y probar confirmación y ocupación reales antes de declarar MAP-229 terminada.
