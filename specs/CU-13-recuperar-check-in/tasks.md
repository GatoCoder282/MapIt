# Tareas y auditoría

- [x] Leer instrucciones backend, Console, infra y specs; inspeccionar log y base real.
- [x] Verificar pago/reserva confirmados, mesa disponible, ausencia de solapamiento.
- [x] Comparar los nueve checksums: V20–V28 antiguos equivalen a V23–V31 actuales.
- [x] Corregir errores técnicos de recepción con regresión.
- [x] Implementar y probar reconciliación local con respaldo y validación estricta.
- [x] Recuperar esquema local y comprobar preservación sin registrar la llegada real.
- [x] Validar pago/check-in idempotente y auditoría en PostgreSQL efímero.
- [x] Registrar comandos y resultados finales.

## Resultados y límites

- Rojo de recepción: 6/22 tests fallaron antes de corregir la clasificación HTTP.
  Verde: `pnpm exec ng test console --no-watch --include "**/check-in-api.spec.ts" --include "**/check-in-store.spec.ts"`, exit 0, 30/30.
- `pnpm exec node --test tools/scripts/reconcile-local-payment-migrations.test.mjs`:
  exit 0, 4/4; rechaza scripts/checksums alterados, fallos, duplicados e historial parcial.
- Recuperación local aplicada con la herramienta `--apply`: exit 0. Respaldo completo
  `.tmp/before-payment-history-1793237682183.dump`, ignorado por Git.
  Verificados 31 registros Flyway exitosos, audit_log y customer_history_access existentes.
  `pnpm db:migrate` posterior en modo normal: exit 0. Segunda planificación: sin cambios.
- Backend anterior del puerto 8080 identificado por PID, clase principal y ruta del
  proyecto; iniciado el 2026-10-27, antes del merge. Se reinició únicamente ese backend.
  El nuevo arranque valida Flyway y el checkout público respondió HTTP 200.
- Prueba HTTP/PostgreSQL inicialmente roja por consultar space_element_state_change,
  retirada por V21. Se actualizó la aserción a audit_log verificando tenant, actor y
  transición AVAILABLE → OCCUPIED. Suite PublicPaymentFlowIntegrationTest: 11/11;
  AuditLogMigrationIntegrationTest: 1/1; Gradle exit 0. Incluye llegada concurrente
  idempotente, ámbito tenant/sede, rollback por conflictos y preservación histórica.
- Reserva real de la captura preservada: CONFIRMED, pago CONFIRMED por 20 BOB, mesa
  AVAILABLE y checked_in_at vacío. No se cobró ni se registró la llegada del cliente.
- El log original no incluye la respuesta HTTP del POST de llegada; demuestra el
  FlywayValidateException y puertos 4200/4300 ya ocupados. No se atribuye un código HTTP
  concreto a aquel POST sin evidencia. No se ejecutó un E2E de navegador en esta revisión.
- `pnpm check`: exit 0 en todas las etapas; 292 tests Console, 119 Public Web y 67 libs,
  builds, contrato API y backend con ArchUnit aprobados. Evidencia local ignorada:
  `.tmp-checkin-check.log`, `.tmp-checkin-flow-green.log`, `.tmp-checkin-api-green.log`,
  `.tmp-checkin-db-validated.log` y `.tmp-checkin-recovery.log`.
  No commits, push ni cambios a migraciones existentes.
