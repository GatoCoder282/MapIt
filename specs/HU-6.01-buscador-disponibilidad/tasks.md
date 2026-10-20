# Tareas — HU-6.01 Buscador de Disponibilidad

## Contrato y límites

- [x] Añadir operación GET pública por tenant, establecimiento y fecha al OpenAPI.
- [x] Validar y generar clientes desde el contrato; revisar el diff sin modificar archivos generados a mano.

## Backend

- [x] Definir la proyección pública y el puerto de consulta en `reservations-domain`.
- [x] Implementar el caso de uso de búsqueda con transacción de solo lectura.
- [x] Implementar adaptador JDBC con resolución de tenant activo, RLS explícita y cálculo del día con la zona horaria del establecimiento.
- [x] Implementar controlador anónimo y respuestas RFC 9457 para entrada inválida y recursos no visibles.
- [x] Probar elegibilidad por estado/tipo, reservas solapadas, límites semiabiertos, día local y aislamiento entre tenants.

## Frontend

- [x] Crear la feature `availability` y conectar el cliente OpenAPI generado.
- [x] Crear ruta, formulario de fecha y enlaces de establecimientos a la búsqueda.
- [x] Cubrir estados de carga, error recuperable, resultados y lista vacía con cadenas del catálogo.
- [x] Añadir tests del store/componente y un flujo E2E público desktop/móvil.

## Cierre

- [x] Ejecutar `pnpm check` y las pruebas E2E públicas de HU-6.01 en desktop/móvil; corregir fallos y dejar las verificaciones aplicables en verde.
- [x] Adjuntar al PR #40 una captura de Checks con todos los checks de pruebas requeridos en verde; evidencia en la descripción del [PR #40](https://github.com/GatoCoder282/MapIt/pull/40).
- [x] Enlazar el [PR #40](https://github.com/GatoCoder282/MapIt/pull/40) a MAP-227.

## Notas de ejecución

### Preparación

- MAP-227 / HU-6.01 pertenece a E06 — Portal Público y bloquea HU-6.02.
- Rama de implementación: `feat/GatoCoder282/HU-6.01-buscador-de-disponibilidad`.
- El directorio `specs/_template` que menciona `pnpm new:spec` no existe en este checkout; estos tres archivos se crearon manualmente en orden.

### Implementación

- OpenAPI: se añadió `GET /public/tenants/{tenantSlug}/establishments/{establishmentSlug}/availability`, con `date` ISO, salida mínima `{ establishmentId, date, elements: [{ id, type }] }` y acceso anónimo.
- Backend: `reservations-domain` define el puerto/proyección; `reservations-application` resuelve el caso de uso en solo lectura; infraestructura filtra por tenant y establecimiento, aplica RLS, calcula el día local y excluye elementos no disponibles o con reservas solapadas.
- Frontend: se añadió la pantalla pública responsive, ruta y enlaces desde las tarjetas; los estados de carga, error, resultados y lista vacía usan `STRINGS`.
- Harness: la skill `ticket-delivery` se copió a `.agents/skills`, `agent/skills` y `.claude/skills`; `AGENTS.md`, `CLAUDE.md`, `specs/AGENTS.md`, el template de PR y el workflow de GitHub incorporan reglas de rama/título, descripción breve, pruebas verdes y captura obligatoria.

### Verificación

- `pnpm fmt` y `pnpm be:fmt`: correctos.
- `pnpm api:lint`: correcto; conserva dos advertencias preexistentes en `/health` y `/demo-items` por respuestas 4xx no declaradas.
- `pnpm api:gen` + `pnpm api:check`: correctos y sincronizados.
- `pnpm check`: correcto (frontend, backend, ArchUnit, contrato y builds).
- `node tools/scripts/gradle.mjs :bootstrap:integrationTest --tests com.mapit.reservations.PublicAvailabilityIntegrationTest`: correcto, 4/4 tests.
- `PUBLIC_WEB_URL=http://127.0.0.1:4300 pnpm --filter @mapit/e2e exec playwright test tests/public-web/availability.spec.ts --project=public-web --project=public-web-mobile`: correcto, 4/4 tests.
- `pnpm e2e` completo no se ejecutó localmente porque este checkout no tiene `.env` ni el stack de backend/Mailpit. Tras el rebase, el workflow remoto de E2E sí ejecutó la suite completa: 28 pruebas pasaron; integración, frontend, backend y contrato también quedaron verdes.
- PR #40 abierto contra `main`, enlazado a MAP-227 y con la captura de Checks adjunta en su descripción. La evidencia apunta a la vista de Checks del PR para conservar una referencia estable al run vigente.
