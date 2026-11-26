# Tareas — HU-7.07 Configuración de plataforma para Super Admin

## MAP-302 — Inventario de parámetros

- [x] Catálogo editable y de solo lectura documentado en `spec.md`.

## MAP-307 — Feature toggle

- [x] `mapit.s6.platform-settings` OFF en enum Java, catálogo TS y `flags.json`.

## MAP-303 — API autorizada y auditoría

- [x] Contrato OpenAPI y cliente generado.
- [x] Migración V46 y DBML.
- [x] Dominio, caso de uso, adaptadores y regla de seguridad SUPER_ADMIN.
- [x] `CustomerHistoryPolicy` aplica el valor guardado.

## MAP-304 y MAP-305 — Pantalla y panel de flags

- [x] Feature de Console con parámetros, solo lectura, servicios, flags e historial.
- [x] Textos es, en y ja.

## MAP-306 — QA

- [x] Pruebas unitarias, de integración y de ViewModel.
- [x] `pnpm check`, `pnpm be:it` y E2E.
- [ ] Captura de checks en el PR (pendiente: requiere los checks remotos).

## Notas de ejecución

- `/admin/settings` era un placeholder; ahora monta la feature `platform-settings`.
- `platform_setting` es global (sin `tenant_id` ni RLS): `CustomerHistoryPolicy` la lee dentro de
  transacciones de un tenant, donde RLS devolvería 0 filas sin avisar. Claves y rangos van en CHECK.
- Solo dos parámetros son editables porque son los únicos que rigen sin reiniciar y sin tocar
  política de seguridad. Añadir otro exige entrada en `PlatformSetting`, CHECK nuevo y textos.
- El filtro JWT exige que el usuario exista: los IT dan de alta un usuario por rol.
- Integración de main en HU-2.04 (26/11/2026): HU-7.06 ocupa V43 a V45; la migración de
  plataforma pasa a V46 conservando exactamente su SQL. Las migraciones de HU-2.04 pasan
  de V40-V43 a V47-V50. No se modifica el historial de la base local existente; la verificación
  utiliza una base independiente con la cadena completa.
- Verificación (25/11/2026): `pnpm check` en verde; `pnpm be:it` 250 tests, 0 fallos;
  `pnpm be:test` 613 unitarios, 0 fallos y 1 omitido preexistente (`SmtpAdminRecoveryMailTest`);
  `ng test console` 494; E2E `platform-settings` (flag ON y OFF), `tenants-admin` y `smoke` en verde.
- El E2E local corrió con el `bootJar` contra un Postgres 17 desechable, Unleash local y la
  Console compilada servida en `:4200`.
- Despliegue: sembrar `mapit.s6.platform-settings` en cada Unleash; sin ella la sección responde 404.
  Retiro previsto de la flag: 26/02/2027 (`flags.json`).
