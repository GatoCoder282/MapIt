# Tasks integración

- [x] Fetch/pull origin/main y respaldo stash conservado; restauración sin conflictos.
- [x] Inspección Jira/HU602/código por tres agentes; contradicciones y faltantes documentados.
- [x] Spec→plan→tasks antes de implementar integración.
- [x] Principal: V20/V21, OpenAPI y generación.
- [x] A: reservas/capability/transiciones/catálogo y operaciones.
- [x] B: pagos/política/mockwebhook/recibos persistentes.
- [x] C: portal real, corrección booking, checkout/comprobante/scanner HTTP.
- [x] Principal: wiring/seguridad/check-in/realtime y E2E conectado a PostgreSQL aislado.
- [x] Revisión cruzada de seguridad y pruebas; regresión de historial corregida.
- [x] Cierre: 9/9 Playwright visual sin actualizar referencias en la última comparación; 1/1 E2E conectado con actualización STOMP del comprobante.
- [x] Formato, lint, tipos frontend/E2E, api:lint/gen/check, builds frontend y backend aprobados. Informe con separación real/mock/pendiente y capturas.
- [ ] PR/CI remotos y captura Checks en verde (no se realizó push).

## Notas

- [x] Corregido arranque local: V21 original restaurada, V22 incremental aplicada y validada; prueba de conservación de datos aprobada. `pnpm dev` comprobado con HTTP 200 en API, Console y Public Web.

Pull main a0f0c03 integrado con merge local; stash previo se conserva. AGENTS.md local del usuario preservado. No despliegue/push/Jira write. Páginaoficial se interpreta como apps/public-web del repositorio con runtime URL configurable.
