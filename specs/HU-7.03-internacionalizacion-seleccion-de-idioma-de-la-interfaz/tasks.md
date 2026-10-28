# Tareas — HU-7.03 Internacionalización y selección de idioma de la interfaz

## Especificación y preparación

- [x] Leer MAP-240, incluida su descripción, actividad y subtareas MAP-250/MAP-251/MAP-252.
- [x] Confirmar el catálogo de idiomas con el usuario para esta implementación: español (`es`), inglés (`en`) y japonés (`ja-JP`); fallback español.
- [x] Revisar catálogos y patrones actuales en Console, Public Web y librerías compartidas.
- [x] Crear `spec.md`, `plan.md` y `tasks.md` en ese orden.

## Infraestructura compartida

- [x] Crear `@mapit/i18n` con tipo/opciones de idioma, preferencia reactiva y persistencia tolerante a `localStorage` bloqueado.
- [x] Implementar catálogo tipado, selección del idioma, `document.documentElement.lang` y fallback a español ante claves ausentes/códigos inválidos.
- [x] Añadir selector compartido accesible y sus traducciones; verificar comportamiento responsive.
- [x] Exportar la API pública y registrar dependencias/tipos de workspace sin romper las reglas de arquitectura.

## Catálogos y aplicaciones

- [x] Añadir catálogos inglés y japonés para Console, Public Web y catálogos compartidos reutilizables; mantener español como fuente de fallback.
- [x] Instalar el provider en Console y Public Web y exponer el selector en login/shells y navegación/flujo público.
- [x] Centralizar cadenas visibles restantes en las vistas de alcance; localizar validaciones, errores, éxitos, estados vacíos y formatos de fecha/número.
- [x] Mantener valores del Tenant, vertical, permisos, términos funcionales y payloads de reserva independientes del idioma.

## Pruebas y calidad

- [x] Cubrir servicio, fallback, preferencias inválidas/storage bloqueado y selector con unit tests.
- [x] Cubrir cambio de idioma en ambas apps y la regresión del flujo de reservas/Tenant/vertical.
- [x] Verificar presentación de escritorio y móvil con tests aplicables.
- [x] Ejecutar `pnpm fmt:check`, `pnpm fe:lint`, `pnpm fe:typecheck`, `pnpm fe:test`, `pnpm fe:build`, `pnpm api:check` y `pnpm check`; corregir fallos y repetir.
- [x] Ejecutar los E2E aplicables cuando el stack local esté disponible y registrar comandos/resultados en estas notas.

## Entrega

- [x] Crear PR hacia `main` con el título exacto de Jira, trazabilidad MAP-240 y la plantilla completa (PR #51).
- [ ] Esperar workflows requeridos y adjuntar captura de Checks con todos los checks de prueba en verde.
- [ ] Marcar criterios aplicables y actualizar notas de ejecución con la evidencia del PR.

## Notas de ejecución

### Preparación

- Issue: MAP-240, `HU-7.03 — Internacionalización y selección de idioma de la interfaz`; épica MAP-10.
- Subtareas leídas: MAP-250 (selector/fallback compartido), MAP-251 (catálogos de Console y Public Web), MAP-252 (persistencia/fallback/regresión de vertical).
- Decisión de idioma: el usuario confirmó español (`es`), inglés (`en`) y japonés (`ja-JP`) para esta implementación. La issue no adjunta la lista de evaluación; no se afirma que exista una rúbrica externa verificada.
- Base actual: `origin/main` en `4ba7a8d` (`MAP-226 — Tests de integración de auditoría`).
- Rama: `feat/GatoCoder282/MAP-240-hu-7-03-internacionalizacion-seleccion-de-idioma-de-la-interfaz`.
- El generador `pnpm new:spec` solo admite `CU-XX` y `specs/_template` no existe en este checkout; los tres archivos se preparan manualmente en el orden exigido por `specs/AGENTS.md`.

### Implementación

- `@mapit/i18n` implementa selección, persistencia por origen, fallback, sincronización de `html[lang]`, selector compartido y formato localizado de fecha/número.
- Console, Public Web, `ui-kit` y `auth` usan catálogos centralizados para español, inglés y japonés; las cadenas de negocio/vertical permanecen separadas.
- El selector sincroniza cada opción seleccionada desde el estado de idioma restaurado, incluso antes de mostrar el primer render. La prueba de navegador encontró y verificó esta regresión.
- Se añadió persistencia E2E para Console y Public Web: Playwright cubre Console desktop/tablet y Public Web desktop/móvil.
- Se cambió la configuración de Playwright para omitir `workers` fuera de CI en vez de pasar `undefined`, compatible con `exactOptionalPropertyTypes`.

### Verificación

- `pnpm check` pasó completo después de configurar un shim temporal que permite al script encontrar Corepack pnpm: formato, ESLint, typecheck, 310 tests frontend, builds, contrato API y backend build/tests/ArchUnit.
- `pnpm --filter @mapit/e2e run typecheck` pasó.
- `pnpm --filter @mapit/e2e exec playwright test tests/console/language.spec.ts tests/public-web/language.spec.ts --reporter=line` pasó: 4/4 (Console desktop/tablet, Public Web desktop/móvil).
- `node tools/scripts/gradle.mjs :bootstrap:integrationTest --tests "com.mapit.realtime.RealtimeWebSocketIntegrationTest"` pasó tras reparar fixtures obsoletos: V21 retiró `space_element_state_change` y el `audit_log` append-only impide borrar usuarios referenciados; el test ahora conserva/upsertea las identidades.
- El setup local creó `.env` y levantó Postgres/Unleash. La migración local se omitió porque el volumen ya existente tiene un checksum distinto en V12; no se reparó ni borró la base. Los E2E de idioma no dependen del backend.
- El primer E2E completo de CI encontró que el ajuste responsive ocultaba la campana en Console tablet, contradiciendo una expectativa existente. Se eliminó esa regla de ocultamiento; se mantiene visible la campana/avatar y se oculta solo el texto del usuario en viewports pequeños.
- CI run `40632262062`: el E2E completo pasó; el job de integración reportó 3 fallas en `RealtimeWebSocketIntegrationTest` por fixtures incompatibles con V21. Los fixtures ya quedaron corregidos y la clase pasa localmente; el nuevo run de CI verificará el arreglo.
- Se detuvieron los frontends y contenedores iniciados para las pruebas; los volúmenes locales se conservaron.

### PR y evidencia

PR [#51](https://github.com/GatoCoder282/MapIt/pull/51) abierto hacia `main`. El nuevo run tras el ajuste de fixtures y la captura requerida de Checks en verde siguen pendientes.
