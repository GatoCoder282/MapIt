<!-- Título del PR: usa el nombre exacto del ticket Jira, incluido su código. -->

## Qué hace este PR

<Una o dos frases.>

## Trazabilidad Jira y ramas

- Historia Jira: [MAP-XXX](https://matiasmv2005.atlassian.net/browse/MAP-XXX) · Historia de usuario: `HU-X.XX`
- Nombre exacto del ticket: `HU-X.XX — <nombre exacto de Jira>`
- Rama: `feat/<github-handle>/<ticket-id>-<ticket-slug>`
- Rama base: `<rama-base>`
- Siguiente PR apilado: `<enlace o N/A>`

## Caso de uso o historia técnica

Especificación: `specs/CU-XX-.../` o `specs/HU-X.XX-.../`, o contrato/ADR de la historia técnica

- [ ] Si aplica CU: `spec.md` completa y sus criterios de aceptación marcados
- [ ] Si aplica HU: `spec.md` completa y sus criterios de aceptación marcados
- [ ] Si aplica CU: `plan.md` con la sección **Patrones de diseño aplicados** llena
- [ ] Si aplica CU: `tasks.md` con las notas de ejecución
- [ ] Si aplica HU: `plan.md`, `tasks.md` y notas de ejecución actualizadas
- [ ] Si aplica historia técnica: contrato/ADR y subtareas de implementación actualizados

## Checklist

<!-- Cuando todos los checks estén en verde, pega la captura en esta descripción del PR para que GitHub genere un enlace user-attachments. -->

- [ ] `pnpm check` en verde
- [ ] Todas las pruebas aplicables ejecutadas y en verde
- [ ] Si cambió el contrato: `openapi.yaml` editado **primero** y `pnpm api:gen` corrido
- [ ] Si hay tablas nuevas: `tenant_id` + índice + RLS, y **test de aislamiento entre tenants**
- [ ] Si cambió el esquema: `docs/db/mapit.dbml` actualizado en este mismo PR
- [ ] Si hay una flag nueva: creada en los 3 sitios y en la UI de Unleash
- [ ] Si es un `release` toggle: tiene fecha de retiro e issue de limpieza
- [ ] Todos los workflows requeridos de GitHub Actions del PR están en verde
- [ ] Captura de las pruebas de este PR adjunta como imagen, mostrando todos los checks de prueba en verde

## Cómo probarlo

1. …
