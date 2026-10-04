# Tareas — MAP-189

- [x] Aprobar alcance backend, frontend y diagnóstico local.
- [x] Crear rama feat/gatocoder282/MAP-189-sprint-2-aplicar-logging-estructurado-en-el-proyecto.
- [x] Documentar y regenerar contrato de correlación.
- [x] Implementar logging backend y pruebas.
- [x] Implementar logging frontend y pruebas.
- [x] Configurar Nginx y rotación Docker.
- [x] Ejecutar prueba de integración del logger, E2E y check completo.
- [x] Completar ADR, guía de uso y defensa.
- [ ] Abrir PR con evidencias y enlace a Jira.

## Notas de ejecución

- Estado inicial: logging SLF4J localizado en SuperAdminBootstrap; frontend usa console directamente. Ya existen Actuator, listeners globales Angular y outbox con event_id.
- Archivos locales no relacionados preexistentes (.agents, .codex, .postman y postman) se conservan fuera de la entrega.
- `pnpm check`: PASS; formato, lint, tipos, pruebas y build frontend, contrato API, build/tests/ArchUnit backend.
- `:bootstrap:integrationTest --tests com.mapit.config.logging.LoggingHttpIntegrationTest --max-workers=1`: PASS; 1 test, 0 fallos (XML de Gradle).
- `pnpm be:it` global se interrumpió tras más de cinco minutos sin avance al pausar contextos Spring en paralelo; la prueba de integración propia se ejecutó aislada y pasó.
- `pnpm infra:full`: PASS; imágenes de backend y ambas apps reconstruidas y servicios healthy.
- `pnpm logging:smoke`: PASS; correlación, privacidad, JSON de Nginx y rotación Docker.
- `pnpm e2e --project=console logging.spec.ts`: PASS; 1 test de correlación del login rechazado.
- La suite completa de integración no se considera aprobada por la ejecución aislada; queda documentada como limitación de esta verificación.
