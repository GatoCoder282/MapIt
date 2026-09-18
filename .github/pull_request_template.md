## Qué hace este PR

<Una o dos frases.>

## Trazabilidad Jira y ramas

- Historia: `MAP-XXX` / `HUT-XX`
- Rama base: `<rama-base>`
- Siguiente PR apilado: `<enlace o N/A>`

## Caso de uso o historia técnica

Especificación: `specs/CU-XX-.../`, o contrato/ADR de la historia técnica

- [ ] Si aplica CU: `spec.md` completa y sus criterios de aceptación marcados
- [ ] Si aplica CU: `plan.md` con la sección **Patrones de diseño aplicados** llena
- [ ] Si aplica CU: `tasks.md` con las notas de ejecución
- [ ] Si aplica historia técnica: contrato/ADR y subtareas de implementación actualizados

## Checklist

- [ ] `pnpm check` en verde
- [ ] Si cambió el contrato: `openapi.yaml` editado **primero** y `pnpm api:gen` corrido
- [ ] Si hay tablas nuevas: `tenant_id` + índice + RLS, y **test de aislamiento entre tenants**
- [ ] Si cambió el esquema: `docs/db/mapit.dbml` actualizado en este mismo PR
- [ ] Si hay una flag nueva: creada en los 3 sitios y en la UI de Unleash
- [ ] Si es un `release` toggle: tiene fecha de retiro e issue de limpieza

## Cómo probarlo

1. …
