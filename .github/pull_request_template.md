## Qué hace este PR

<Una o dos frases.>

## Caso de uso

Especificación: `specs/CU-XX-.../`

- [ ] `spec.md` completa y sus criterios de aceptación marcados
- [ ] `plan.md` con la sección **Patrones de diseño aplicados** llena
- [ ] `tasks.md` con las notas de ejecución

## Checklist

- [ ] `pnpm check` en verde
- [ ] Si cambió el contrato: `openapi.yaml` editado **primero** y `pnpm api:gen` corrido
- [ ] Si hay tablas nuevas: `tenant_id` + índice + RLS, y **test de aislamiento entre tenants**
- [ ] Si cambió el esquema: `docs/db/mapit.dbml` actualizado en este mismo PR
- [ ] Si hay una flag nueva: creada en los 3 sitios y en la UI de Unleash
- [ ] Si es un `release` toggle: tiene fecha de retiro e issue de limpieza

## Cómo probarlo

1. …
