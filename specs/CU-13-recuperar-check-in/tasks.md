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

## Seguimiento: arranque duplicado a las 22:14 (Bolivia)

- Este log sí era nuevo: Flyway validaba y el fallo ocurría después. Se identificaron
  listeners MapIt en 4200/4300/8080. El backend 8080 era el dejado activo por el agente
  durante la verificación anterior. Se detuvieron solo esos tres procesos tras validar
  PID, nombre y ruta de proyecto; Docker y los datos se conservaron.
- `dev.mjs` ahora comprueba los puertos solicitados antes de arrancar infraestructura
  o procesos, tanto en IPv4 como IPv6. Usa el puerto real de backend y pasa los puertos
  configurados a Angular. El diagnóstico indica qué servicio ocupa cada puerto.
- `pnpm exec node --test tools/scripts/dev.test.mjs`: 3/3 aprobados. Formato y ESLint
  focalizados sin errores. `pnpm dev` con instancias existentes devolvió exit 1 esperado,
  identificó los tres puertos y no lanzó procesos nuevos.
- Arranque limpio con `pnpm dev`: Console :4200, Public Web :4300 y
  `/actuator/health` :8080 respondieron HTTP 200. Se detuvo la sesión de prueba con
  Ctrl+C y se verificó que no quedan listeners en esos tres puertos antes de la entrega.
- Se corrigió la documentación que sugería que `pnpm stop` detiene procesos host:
  solo baja Docker; Angular/Java de `pnpm dev` se detienen con Ctrl+C en su terminal.
- No se repitió `pnpm check` completo para este cambio del lanzador; la verificación
  global anterior pertenece al arreglo de check-in. Evidencia nueva: `.tmp-dev-clean-start.log`.
