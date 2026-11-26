# Auditoría frontend de feature toggles

Fecha: 2026-11-17. Alcance: `libs/feature-flags`, consumidores de console, integración con proxy y realtime. Backend e infraestructura inspeccionados solamente en lectura. No se cambiaron flags externas, tickets ni dependencias. El árbol ya contenía modificaciones ajenas; se conservaron.

## Resultado

Se corrigió un defecto que impedía apagar flags con default `true`: el cliente mezclaba la respuesta de `GET /proxy` con los defaults. Ese endpoint devuelve solamente las flags activas; una flag ausente significa OFF, no fallback. También se corrigieron validación del payload, concurrencia y cancelación del sondeo, contexto de evaluación y acceso por URL a superficies desactivadas.

El sistema conserva la API de Signals y el cliente `fetch` existente. No se instaló el SDK de Unleash. Los defaults del catálogo no se cambiaron.

## Inventario y comportamiento efectivo

Fuente: `libs/feature-flags/src/lib/feature-flag.catalog.ts`. ON/OFF en esta tabla describe el comportamiento frontend, no una autorización de servidor.

| Flag                     | Default | Consumidor efectivo en console                                        | ON                                               | OFF                                                                        |
| ------------------------ | ------- | --------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| `demo.hello`             | true    | Ninguno                                                               | Sin cambio visible                               | Sin cambio visible                                                         |
| `payments.qr`            | false   | `features/home/ui/reservations-panel/reservations-panel.html`         | Nota de capacidad activa                         | Nota de capacidad pendiente                                                |
| `realtime.websocket`     | true    | `app.config.ts` → `RealtimeClient`                                    | Permite STOMP con sesión y URL válidas           | Desconecta, conserva referencias a suscripciones y no reintenta transporte |
| `spaces.editor-grouping` | false   | Ninguno                                                               | No implementa agrupación                         | Sin cambio visible                                                         |
| `spaces.floors`          | true    | `piso-list.ts`, `piso-form.ts`, ruta `floors/:establishmentId`        | Lista/formulario y navegación permitidos         | Lista/formulario ocultos y nueva navegación redirigida                     |
| `spaces.sectors`         | true    | `sector-list.ts`, ruta `floors/:floorId/sectors`                      | Lista y navegación permitidas                    | Lista oculta y nueva navegación redirigida                                 |
| `map-editor.enabled`     | true    | `wizard-summary.ts`, enlace en `sector-list.ts`, tres rutas de editor | Accesos y navegación disponibles, sujetos al rol | Accesos de resumen/sector ocultos y nuevas navegaciones redirigidas        |
| `vertical.hotel`         | true    | `wizard-establishment.ts` vía `isVerticalEnabled('HOTEL')`            | Opción Hotel disponible                          | Opción deshabilitada con indicación existente                              |
| `vertical.event-hall`    | true    | Mismo wizard, `EVENT_HALL`                                            | Opción Salón disponible                          | Opción deshabilitada con indicación existente                              |

`RESTAURANT` y `NIGHTCLUB` son verticales base sin toggle. El mapa de verticales está en `libs/feature-flags/src/lib/vertical-flags.ts`. Ninguna flag está duplicada dentro del catálogo TS ni del bootstrap; las copias entre capas son catálogos mantenidos por separado, con riesgo de deriva.

`payments.qr` actualmente cambia una nota del dashboard: no controla métodos de pago, checkout, verificación ni llamadas de pago. No debe presentarse como kill switch de operaciones. `demo.hello` tampoco muestra el banner descrito por sus comentarios: no tiene consumidor efectivo en las apps. No se reintrodujo una demo ni se implementó agrupación para justificar esas flags.

## Consistencia con Unleash

| Fuente                                                                             | Resultado estático                                                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Catálogo TS                                                                        | 9 claves                                                                              |
| `infra/docker/unleash/flags.json`                                                  | 8 claves; falta `map-editor.enabled`                                                  |
| `apps/backend/shared-kernel/src/main/java/com/mapit/shared/flags/FeatureFlag.java` | 6 claves; no incluye `spaces.floors`, `spaces.sectors`, `map-editor.enabled`          |
| Defaults compartidos                                                               | Coinciden entre las fuentes donde existe cada clave                                   |
| Contexto de verticales                                                             | Backend usa propiedad `tenantId`; console ahora envía `properties[tenantId]` al proxy |

La ausencia de `map-editor.enabled` en bootstrap es una dependencia de configuración pendiente: con una respuesta válida del proxy que no incluya esa clave, el editor queda OFF. No se inventó una excepción para volver a encenderlo ni se ejecutó el seeder.

Verificación local real, de solo lectura:

- `http://localhost:3063/proxy/health`: HTTP 200.
- Console en `:4200`: HTTP 200; backend en `:8080` respondió 401 a una consulta sin credenciales.
- `GET /proxy` usando la URL y clave públicas del config runtime de console: HTTP 200 y únicamente `demo.hello: true` en contexto anónimo.
- Playwright confirmó el mismo HTTP 200 desde el origen `http://localhost:4200`, por lo que CORS funciona en ese recorrido local.

Esta lectura no distingue una flag apagada de una inexistente o excluida por estrategia. No prueba el catálogo administrativo completo ni la evaluación de tenants reales. No se usaron tokens administrativos ni se cambiaron estrategias.

El [contrato oficial de Unleash Proxy](https://github.com/Unleash/unleash-proxy#readme) establece que `GET /proxy` devuelve las flags activas. `/proxy/all` requiere habilitación explícita; no es necesario habilitarlo para esta solución.

`tools/scripts/new-flag.mjs` fue inspeccionado: escribe el enum Java, el catálogo TS y el bootstrap. **No se ejecutó.** `seed-flags.mjs` añade estrategias y aplica ON/OFF incluso a flags existentes; no debe usarse para reconciliar producción sin revisión, pues puede alterar decisiones operativas y repetir estrategias.

## Hallazgos y correcciones implementadas

| Hallazgo                                                      | Riesgo                                                                              | Corrección                                                                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Defaults mezclados con respuesta válida                       | Kill switches con default true no se podían apagar por omisión del proxy            | Reconstruir cada snapshot válido con claves conocidas en false y aplicar las recibidas                                                    |
| Cast de JSON sin validación                                   | `enabled: "false"` podía actuar como verdadero; payloads corruptos alteraban estado | Validación de estructura y booleanos, rechazo atómico de duplicados y filtrado de claves desconocidas                                     |
| Peticiones solapadas                                          | Una respuesta antigua podía sobrescribir una más reciente                           | Una solicitud en vuelo por contexto                                                                                                       |
| Fetch sin límite ni cancelación al destruir                   | Conexiones colgadas y publicación tardía                                            | Timeout de 10 s, AbortController, cancelación de intervalo y descarte de respuestas abortadas                                             |
| Sin contexto de usuario/tenant/local                          | Divergencia con estrategias por tenant y evaluación compartida entre sesiones       | Callback reactivo opcional en configuración; console entrega usuario y propiedades de tenant/establecimiento                              |
| Resultados anteriores al cambiar ámbito                       | Datos de flags de otra sesión o establecimiento seguían siendo aplicables           | Reiniciar defaults y `listo`, cancelar ámbito anterior y reevaluar inmediatamente                                                         |
| Editor disponible por URL aunque el resumen ocultara el botón | Toggle incompleto en navegación                                                     | Guards en `/spaces/editor`, `/spaces/editor/:sectorId` y `/spaces/floors/:floorId/editor`; enlace del sector condicionado a la misma flag |
| Rutas de pisos/sectores sin guard de flag                     | URL directa no respetaba la decisión de UI                                          | Guards en sus rutas con redirección a `/home`                                                                                             |
| Comentario de guard prometía no cargar bundle                 | Garantía incorrecta sobre `canActivate`                                             | Documentar comprobación de navegación y su carácter de UX                                                                                 |

Los requests al proxy usan exclusivamente la clave pública en `Authorization`, `credentials: 'omit'` y `cache: 'no-store'`. No se envía JWT ni se persisten evaluaciones. Las propiedades de contexto solo sirven para evaluación de UX: son manipulables en el navegador y no acreditan identidad.

## Estados, sesión y recuperación

1. Sin proxy configurado: defaults del catálogo y sin polling.
2. Antes de la primera respuesta válida: defaults; `listo()` es false.
3. Respuesta válida, incluso `toggles: []`: snapshot completo; claves ausentes OFF; `listo()` true.
4. Error HTTP/red/JSON/esquema: conservar último snapshot válido. Si nunca hubo uno, conservar defaults. No convertir OFF conocido en ON durante una caída.
5. Error repetido: un log de degradación por episodio, sin URL, contexto, cuerpo ni clave. Primera respuesta válida posterior: log de recuperación y actualización normal.
6. Cambiar sesión, cerrar sesión o cambiar establecimiento: cancelar y descartar respuestas del contexto anterior; volver a defaults mientras llega la nueva evaluación. Los valores permisivos de esos defaults siguen siendo una limitación deliberada del catálogo existente.
7. Polling cada 15 s por defecto; un request tarda como máximo 10 s. La latencia total también depende del refresco proxy → Unleash, por lo que no se promete un corte instantáneo.
8. `listo` significa que hubo una respuesta válida en el ámbito actual; no significa que la conexión siga sana. Una caída posterior no lo vuelve false.

## Resultados ON/OFF y pruebas

Las pruebas de cliente recorren las nueve claves en ON → ausencia/OFF → ON y comprueban que se conserva la identidad del Signal. Son pruebas de evaluación; no afirman que las dos flags sin consumidor creen funcionalidad.

| Nivel                                     | Cobertura y resultado                                                                                                                                                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitario y render Angular de libs         | 31 pruebas: catálogo, logging, nueve flags, OFF explícito, vacío, errores de esquema/JSON/HTTP/red, duplicados, claves desconocidas, timeout, no solapamiento, cancelación, contexto, `@if` y directiva/inversión. Pasaron |
| Integración flags → STOMP                 | Suite realtime: 5 pruebas. La nueva prueba ON/OFF/ON desconecta transporte, elimina suscripciones activas y las restaura al recuperar ON. Pasaron                                                                          |
| Integración Angular Router y consumidores | 54 pruebas en rutas, dashboard, wizard y sector-page. Las cinco rutas reales aceptan ON y redirigen OFF. El dashboard comprueba ambas notas de pagos. Pasaron                                                              |
| Integración lista de sectores y monitor   | 4 pruebas: enlace del editor ON/OFF, ocultación de sectores y tres escenarios del monitor. Pasaron                                                                                                                         |
| Playwright                                | 1 recorrido de dashboard en Chromium: ON → OFF → red caída conservando OFF → recuperación ON sin reload. Valida contexto y headers. Pasó                                                                                   |
| Proxy real local                          | Lectura anónima HTTP/CORS 200 desde navegador. No se conmutaron flags reales                                                                                                                                               |

El test Playwright crea una sesión ficticia exclusivamente en su browser context y simula APIs y proxy con `page.route`. No usa fixtures que creen empresas ni escribe al backend. El reloj de Playwright adelanta el sondeo; no usa `waitForTimeout`. Es integración del navegador con la app real y servicios simulados, no una prueba completa de autorización de servidor.

Comandos ejecutados desde la raíz, con Node 24.19.0 y pnpm 11.9.0 mediante Corepack:

```text
corepack pnpm exec ng test libs --no-watch --include "**/feature-flag*.spec.ts" --include "**/realtime.spec.ts"
  PASS: 4 archivos, 36 pruebas.
corepack pnpm exec ng test console --no-watch --include "**/app.routes-flags.spec.ts" --include "**/wizard-establishment.spec.ts" --include "**/sector-page.spec.ts" --include "**/home.spec.ts"
  PASS: 4 archivos, 54 pruebas.
corepack pnpm --filter @mapit/e2e exec playwright test --project=console tests/console/feature-flags.spec.ts
  PASS: 1 prueba.
corepack pnpm exec ng build console
  PASS con warnings: initial 811.65 kB frente al warning de 600 kB, presupuestos SCSS y CommonJS.
corepack pnpm exec ng test console --no-watch --include "**/sector-list-flags.spec.ts" --include "**/space-monitor-store.spec.ts"
  PASS: 2 archivos, 4 pruebas.
corepack pnpm exec ng build public-web
  PASS con warnings: initial 532.51 kB frente al warning de 400 kB, presupuestos SCSS y CommonJS.
corepack pnpm --filter @mapit/e2e exec tsc --noEmit
  FAIL: tests/console/unified-login.spec.ts:7, propiedad reducedMotion no admitida por el tipo de fixture.
```

Total de pruebas dirigidas: **95 pasaron**, incluidas las existentes relevantes. ESLint sobre todos los TS modificados de esta auditoría: PASS, cero warnings. Se aplicó Prettier solo a archivos de esta tarea. Los primeros intentos revelaron restricciones de lectura de esbuild en el sandbox y errores de tipos/lint de los tests; se corrigieron y se repitieron fuera del sandbox con autorización. Corepack preparó el gestor fijado; no se instalaron dependencias del proyecto.

No se ejecutaron `pnpm check`, `pnpm fmt`, codegen ni comandos de setup/migración/backend, porque pueden construir o modificar backend o ampliar el alcance. El cliente generado ya estaba presente.

## Recomendación de activación por entorno

| Entorno    | Recomendación, sin cambios realizados                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desarrollo | Revisar que las nueve claves que se desean evaluar existan; probar ON/OFF mediante estrategias de un tenant de prueba. Corregir el bootstrap de editor en una tarea autorizada de configuración                                       |
| Staging    | Validar dos tenants, dos establecimientos, cambio de sesión y pérdida de proxy con estrategias representativas. Comprobar también 403 del backend para verticales apagadas y comportamiento durante edición activa                    |
| Producción | Revisar flags existentes antes de desplegar: la corrección hace efectivos OFF antes ignorados. Mantener `payments.qr` y agrupación OFF hasta completar sus capacidades. No ejecutar el seeder para sobrescribir decisiones operativas |
| Todos      | Tratar realtime como mitigación operativa; vigilar degradación/recuperación. No usar defaults o flags frontend como permisos. Definir responsables y retiro de flags release/experiment                                               |

No se recomienda encender una funcionalidad solo porque su default actual sea true. Las verticales deben activarse según capacidad comprobada y política del tenant. Las release `payments.qr` y `spaces.editor-grouping` tienen `expiresAt: 2026-12-31` en bootstrap: revisar su retiro antes de esa fecha.

## Dependencias externas y backend no modificado

| Archivo o área                                                                                                                                                                                                                                                       | Riesgo / límite observado                                                                                                                                          | Corrección sugerida fuera de este cambio                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/shared-kernel/src/main/java/com/mapit/shared/flags/FeatureFlag.java`                                                                                                                                                                                   | Tres flags frontend no figuran en el enum. No hay denegación servidor por esas claves                                                                              | Decidir si son solo UX o gates operativos; si deben denegar operaciones, definirlas en el puerto y verificar en casos de uso, con pruebas HTTP y por tenant |
| `apps/backend/modules/payments/payments-infrastructure/src/main/java/com/mapit/payments/infrastructure/PublicCheckoutController.java` y `apps/backend/modules/payments/payments-application/src/main/java/com/mapit/payments/application/PublicCheckoutService.java` | No se encontró un uso operativo de `PAYMENTS_QR`; apagarla no demuestra bloqueo de pagos. No implica por sí mismo que los endpoints carezcan de otras validaciones | Precisar si la flag afecta solo QR o toda la capacidad; si se requiere un corte real, evaluarla en la operación correspondiente y probar acceso directo     |
| `apps/backend/shared-kernel/src/main/java/com/mapit/shared/vertical/VerticalGate.java` y `apps/backend/modules/platform/platform-infrastructure/src/main/java/com/mapit/platform/infrastructure/flags/UnleashFeatureFlagAdapter.java`                                | Sí existe evaluación por `tenantId` en backend; el contexto enviado por navegador no es autoridad                                                                  | Mantener derivación del tenant autenticado/URL validada y verificar aislamiento con pruebas backend autorizadas                                             |
| `infra/docker/unleash/flags.json`                                                                                                                                                                                                                                    | Editor ausente y descripción de demo sin consumidor                                                                                                                | Reconciliar definición, intención y entorno sin activar automáticamente capacidades                                                                         |
| `infra/docker/compose.yml`                                                                                                                                                                                                                                           | Usa imagen proxy `latest`; la versión ejecutada no queda fijada                                                                                                    | Fijar versión en una tarea de infraestructura y evaluar migración a Edge por el estado de mantenimiento del proxy, sin mezclarla con esta corrección        |
| `tools/scripts/seed-flags.mjs`                                                                                                                                                                                                                                       | Repetirlo puede añadir estrategias y reaplicar ON/OFF a flags existentes                                                                                           | Separar alta idempotente de cambios operativos, preservar estrategias existentes y verificar respuestas HTTP                                                |

La inspección de backend fue estática. No se ejecutaron tests backend ni se afirmó vulnerabilidad explotable o denegación efectiva sin probarla. No hubo cambios en `apps/backend`.

## Flags sin uso y posibles nuevos toggles

- Retirar `demo.hello` cuando ya no sea necesaria la comprobación de transporte; actualizar comentarios que prometen un banner inexistente.
- `spaces.editor-grouping` es una reserva sin implementación: mantener OFF o retirar, sin construir agrupación como parte de la auditoría.
- Para una mitigación independiente de check-in podría justificarse un toggle operativo, pero solo junto al gate backend y pruebas. No se creó.
- Si se necesita controlar checkout QR en caliente, definir primero el alcance de `payments.qr`; evitar crear una segunda flag duplicada de pagos.
- `paymentPreviewEnabled` ya es una configuración runtime independiente. No se convirtió en otra flag sin una necesidad operativa concreta.

## Pipeline obligatorio y revisión visual

La definición completa existe en `docs/prompts/prompt_diseño_frontend.md`, sección de pipeline. No faltan puntos. Se evaluó antes de editar y se conserva aquí:

- [x] 1. ¿Hay imagen/screenshot adjunta? **No**. No aplica recreación ni `design-system`.
- [x] 2. ¿Hay archivos .tsx/.jsx de referencia? **No**. No hay traducción React/Framer → Angular/GSAP que reportar.
- [x] 3. ¿Menciona/implica animación o movimiento? **No**. No se añade ni altera motion.
- [x] 4. ¿Implica layout, tipografía, jerarquía o pulido visual? **No**. La auditoría es funcional; no se rediseña.
- [x] 5. ¿Toca más de un componente o página? **Sí en la inspección de consumidores**. Se consultó `extract-design-system`: su versión local extrae sitios públicos con CLI, no audita tokens de un repo. No se ejecutó una extracción ni se instaló nada. Se verificó que el cambio no introduce valores de diseño y se conserva el sistema existente.
- [x] 6. ¿Se necesita capacidad de UI nueva? **No**. No se eligieron ni instalaron librerías.
- [x] 7. ¿Hace falta dirección visual sin spec/referencia o se creó UI nueva? **No**. No se requiere ni instala `design-taste-frontend`.

Paso 0: se consultó `libs/ui-kit/DESIGN.md`, el DESIGN existente encontrado. No existe `DESIGN.md` en raíz. No se cambiaron tokens, estilos, iconos ni textos de producto. `design-orchestrator` se consideró; no se activa una fase de diseño para esta corrección lógica. Skills técnicas usadas: Ponytail, `investigate-first`, Context7. No había grafo `graphify-out/graph.json`; la investigación usó búsqueda directa y archivos fuente.

Se leyó la skill local `web-design-guidelines` y se consultaron las [reglas actuales de Vercel](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Checklist corrido sobre el cambio de UI: sin hallazgos nuevos en el enlace condicionado; conserva elemento `a`, `RouterLink`, nombre accesible contextual, SVG decorativo y estilos de foco existentes. No es una certificación de accesibilidad de toda la app. Gate visual de Antislop: no se generó diseño ni contenido visual; no se introdujeron activos, navegación inventada o motion. Verificación funcional del alcance: build, render tests y recorrido Playwright pasaron.

## Limitaciones pendientes

- Un guard comprueba el snapshot disponible al navegar, con los defaults existentes antes de sincronizar. No espera la primera respuesta ni revoca una ruta ya abierta. No se fuerza salida ni se destruyen borradores al apagar el editor.
- El enlace principal al mapa del shell puede permanecer visible y redirigir a home con el editor OFF. Se conservó la navegación previa; no se rediseñó el shell.
- Las listas de pisos/sectores ocultas no impiden llamadas directas a sus stores/API. No hay garantías de bloqueo de operaciones por esas flags sin gates backend.
- El monitor operacional sí combina eventos/reconexión con polling de 15 s. Home conserva la foto y permite refrescar; su temporizador corrige deriva después de eventos, pero no es polling periódico durante todo el tiempo que STOMP esté OFF. No se añadió un nuevo subsistema de polling en esta auditoría.
- No se verificó una conmutación administrativa real ON/OFF en Unleash, producción, aislamiento servidor entre tenants ni sesión real con dos establecimientos. Esos escenarios de cliente se simulan en tests; la lectura real del proxy fue anónima.
- No se ejecutó toda la suite E2E ni una auditoría visual/accesible integral. La navegación Playwright de login mostró un 404 de `favicon.ico`, ajeno al sistema de flags; no se corrigió.
- El typecheck global de E2E está bloqueado por `apps/e2e/tests/console/unified-login.spec.ts:7`, fuera de los archivos de esta auditoría. La nueva prueba Playwright sí compiló y pasó al ejecutarla; no se corrigió el fixture ajeno.
- Las advertencias de bundle/SCSS/CommonJS observadas no se resolvieron ni se atribuyen exclusivamente a esta auditoría: el checkout tenía cambios previos.
