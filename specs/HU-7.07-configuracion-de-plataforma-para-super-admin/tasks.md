# Tareas — HU-7.07 Configuración de plataforma para Super Admin

## MAP-302 — Inventario de parámetros

- [x] Catálogo editable y de solo lectura documentado en `spec.md`.

## MAP-307 — Feature toggle

- [x] `mapit.s6.platform-settings` OFF en enum Java, catálogo TS y `flags.json`.

## MAP-303 — API autorizada y auditoría

- [x] Contrato OpenAPI y cliente generado.
- [x] Migración V46 (renumerada tras integrar main) y DBML.
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
- **Colisión resuelta (26/11/2026):** tras integrar #75 y #84, main contenía dos V43 y Flyway
  bloqueaba el arranque. La migración de plataforma se renumeró a V46 sin cambiar su SQL;
  V43–V45 de notificaciones se conservan. No redefinen restricciones de `audit_log`.
  Se añadió una prueba de unicidad de versiones y se reprodujo y corrigió el fallo del
  historial canónico en los tests de scripts. No se modificó ningún historial de BD.
- Verificación de la corrección (26/11/2026): 27 tests de scripts, 827 frontend, los dos
  tests de `TenantApiIntegrationTest` y 23 IT de notificaciones/configuración, sin fallos.
  `pnpm check` pasó lint, tipos, tests, builds, contrato y backend/ArchUnit; formato se
  revalidó aparte tras normalizar una caché local ignorada (`.impeccable/hook.cache.json`).
  Un entorno que ya aplicó la V43 de plataforma desde una rama necesita revisar su historial
  antes de desplegar; esta corrección no ejecuta repair ni modifica bases desplegadas.
- Verificación (25/11/2026): `pnpm check` en verde; `pnpm be:it` 250 tests, 0 fallos;
  `pnpm be:test` 613 unitarios, 0 fallos y 1 omitido preexistente (`SmtpAdminRecoveryMailTest`);
  `ng test console` 494; E2E `platform-settings` (flag ON y OFF), `tenants-admin` y `smoke` en verde.
- El E2E local corrió con el `bootJar` contra un Postgres 17 desechable, Unleash local y la
  Console compilada servida en `:4200`.
- Despliegue: sembrar `mapit.s6.platform-settings` en cada Unleash; sin ella la sección responde 404.
  Retiro previsto de la flag: 26/02/2027 (`flags.json`).
