# MAP-189 — Logging estructurado

- Estado: aprobada mediante el plan y la solicitud de implementación del usuario.
- Jira: https://matiasmv2005.atlassian.net/browse/MAP-189
- Responsable: Diego Valdez.

## Objetivo

Diagnosticar operaciones de MapIt mediante logs JSON uniformes, correlacionados y sin datos sensibles, en backend, ambas apps Angular e infraestructura de aplicación.

## Criterios de aceptación

- [x] Dada una petición HTTP, el backend devuelve un `X-Request-ID` UUID y registra estado, duración y operación; acepta únicamente UUID canónicos y genera uno si falta o es inválido.
- [x] Dadas peticiones concurrentes y tareas de distintos tenants, sus contextos permanecen aislados y se limpian incluso ante excepciones.
- [x] Dados fallos de autenticación, correo, flags, STOMP y outbox, existen eventos con niveles y contexto apropiados; los reintentos se enlazan por `event_id`.
- [x] Dados secretos señuelo en peticiones y errores, no aparecen en los registros emitidos ni en `last_error` del outbox.
- [x] Ambas apps utilizan un logger compartido; sus errores HTTP se correlacionan con backend sin enviar identificadores a terceros.
- [x] Los logs de Nginx excluyen URLs, referers, cookies e identidad; Docker limita su almacenamiento.
- [x] Tests unitarios, la prueba de integración de logging, E2E de correlación y `pnpm check` pasan; la configuración conserva compatibilidad con CI.
- [x] Existe guía de uso, ADR y demostración reproducible para la defensa del 6 de octubre de 2026.

## Límites

Los logs del navegador se conservan únicamente en DevTools. No se incorporan recolección centralizada, alertas, trazas distribuidas, auditoría de negocio ni migraciones. El dominio y shared-kernel siguen sin frameworks. Los logs no son una fuente de autorización.
