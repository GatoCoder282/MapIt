# Tareas

- [x] Definir y validar OpenAPI; regenerar cliente.
- [x] Implementar dominio, aplicación, JDBC, controlador y migración con aislamiento.
- [x] Implementar selectores buscables, banco/titular/cuenta, listado y edición persistida.
- [x] Generar y regenerar QR seguro y pantalla de simulación sin efectos financieros.
- [x] Comprobar persistencia al recargar, aislamiento entre tenants, RLS y bloqueo de producción.
- [x] Ejecutar controles de contrato, frontend, backend y navegador; documentar resultados.

## Notas de ejecución

### Corrección de selectores

- [x] Reemplazar búsqueda más select por una caja combinada accesible en cada catálogo.
- [x] Validar UUID e ISO contra los catálogos cargados desde la API.
- [x] Comprobar selección, guardado y recarga con cliente HTTP y navegación de teclado/táctil.

El componente `SearchSelect` reemplaza los dos controles por campo. Comparte filtrado sin
acentos, opciones con dirección/código, navegación con flechas/Enter/Escape y manejo de foco.
El store solo acepta identificadores presentes en los catálogos obtenidos con el cliente
generado y filtra locales sin permiso de gestión. Se conserva la API existente; no hacen
falta cambios de contrato ni de esquema para corregir esta conexión.

Verificación de esta corrección: 12 pruebas unitarias de consola, TypeScript de consola/E2E y ESLint sin
errores. El nuevo `apps/e2e/tests/payment-live/mock-qr.spec.ts` pasó con Spring Boot y PostgreSQL
aislados, autenticación real y HTTP sin interceptar: búsqueda por dirección/ISO, UUID real en
POST, edición en PUT, recarga, desactivación y regeneración. También comprobó selección táctil
en viewport móvil. Se revisaron capturas de escritorio y móvil. La prueba anterior que exigía
persistencia solo en memoria fue retirada al quedar sustituida por este recorrido persistido.

Se trabaja sobre la rama existente MAP-229 con cambios previos extensos, que se preservan.

**Implementación.** El recurso `mock-qr` ya existía en el contrato y en `payments`; el hueco real
era la tabla. Se rellenó `V24__crear_configuracion_qr_mock_persistida.sql` con
`mock_qr_configuration` (FK compuestas a tenant/establecimiento/actores, unicidad por
`(tenant_id, establishment_id)`, unicidad de token, `enable_tenant_isolation` y trigger de
`updated_at`) y se actualizó `docs/db/mapit.dbml`. El QR se reconstruye desde
`simulationPath` con `qrcode` ya instalado; nunca contiene banco, titular ni cuenta. La
pantalla de simulación vive en `public-web` (`/simulacion/qr/:token`), es estática y no llama a
la API. La corrección posterior de selectores se describe arriba.

**Subagentes.** El proveedor bloqueó el cupo de modelos gratuitos
(`free-models-per-day`), así que la implementación se hizo directamente en la sesión raíz en
lugar de repartirla entre backend/frontend/QA.

**Verificación ejecutada.**

- `pnpm api:lint` válido (2 warnings preexistentes de `/health` y `/demo-items`).
- `pnpm api:check`: contrato y cliente sincronizados.
- Backend unit: `:modules:payments:payments-application:test --tests MockQrConfigurationServiceTest` en verde.
- Backend integración (Testcontainers): `:bootstrap:integrationTest --tests MockQrConfigurationIntegrationTest`,
  3/3 en verde (CRUD, duplicados, tenant ajeno, RLS, 401/403, país inválido).
- Consola: `ng test console --include "**/features/payments/**/*.spec.ts"`, 11/11 en verde.
- `tsc --noEmit` de `console` y `public-web` sin errores; `ng build public-web` correcto (warnings
  preexistentes de presupuesto SCSS y CommonJS de `qrcode`/`stompjs`).
- ESLint y Prettier sobre los archivos tocados, sin warnings.
- `pnpm db:info` mostraba V24 como Pending; `pnpm db:migrate` la aplicó. Consulta directa a
  `pg_class`: `mock_qr_configuration` existe con RLS habilitada y forzada.
- `pnpm check` completo en verde: formato, lint, tipos, tests de las tres apps, build frontend,
  contrato y backend (build + tests + ArchUnit).

**Pendiente / no ejecutado.** `pnpm be:it` con toda la suite (solo se corrió la clase nueva) y la suite
E2E completa. El recorrido específico y la revisión de capturas se completaron en la corrección de
selectores descrita arriba. Si otra base local ya aplicó la plantilla vacía de V24, hay que
borrar esa fila de `flyway_schema_history` (o `pnpm infra:reset`, que borra datos locales) y
volver a migrar; de lo contrario Flyway fallará por checksum y faltará la tabla.
