# Tareas — HU-7.08 Observabilidad operativa y salud de tenants

## MAP-308 — Indicadores, privacidad y fuentes

- [x] Documentados en `spec.md`.

## MAP-313 — Feature toggle

- [x] `mapit.s6.tenant-observability` OFF en enum Java, catálogo TS y `flags.json`.

## MAP-309 — Consultas seguras

- [x] Contrato, migración V44 y DBML.
- [x] Supresión, proyecciones, caso de uso, controlador y regla SUPER_ADMIN.

## MAP-310 y MAP-311 — Dashboard y detalle

- [x] Feature de Console con resumen, listado y detalle; textos es, en y ja.

## MAP-312 — QA

- [x] Unitarias, integración de privacidad y acceso, ViewModels y E2E.
- [x] `pnpm check` y `pnpm be:it`.
- [ ] Captura de checks en el PR.

## Notas de ejecución

- Los agregados recorren las empresas una a una, cada una en su transacción con `app.tenant_id`:
  sin `SECURITY DEFINER` ni bypass de RLS. `platform_access_log` es append-only por permisos.
- `GuardedCount` no conserva el número suprimido. La supresión complementaria evita deducirlo
  restando; el límite de comparar ventanas de 7 y 30 días queda declarado en `spec.md`.
- Las métricas de API salen de `http.server.requests` del propio proceso: se reinician al
  desplegar y no distinguen instancias.
- **Migración:** V44 supone que el PR #84 (V43) entra antes. Si no, o si #75 entra primero,
  renombrar antes de mergear (skill `new-migration`, regla 5).
- **Conflictos esperados con #84** en rutas, menú, textos, seguridad, flags y contrato: el que
  entre segundo se rebasa sobre `main`.
- Retiro previsto de la flag según `flags.json`; sembrarla en cada Unleash al desplegar.
