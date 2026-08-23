# MapIt — contexto para agentes

> Este archivo es un **enrutador de contexto**, no documentación. Encuentra tu tarea en
> la tabla, carga lo que indica, y trabaja con eso. Cada carpeta tiene su propio
> `AGENTS.md` con las reglas de su sección.

## Qué es MapIt

Motor de gestión espacial **multi-tenant**: el mapa del local es la interfaz operativa
del negocio, no un dibujo. Un mismo motor sirve 4 verticales (restaurante, discoteca,
salón de eventos, hotel). Angular 22 + Spring Boot 4.1 + PostgreSQL.

Alcance real: `docs/roadmap/use_cases.md` (**manda sobre `project_definition.md`**).

## Tabla de ruteo

| Si la tarea es…                  | Lee                                             | Agente              | Skill              |
| -------------------------------- | ----------------------------------------------- | ------------------- | ------------------ |
| Un caso de uso completo          | `specs/AGENTS.md`                               | —                   | `new-usecase`      |
| Endpoint o cambio de contrato    | `packages/api-contract/AGENTS.md`               | `api-contract`      | —                  |
| Lógica de dominio / backend      | `apps/backend/AGENTS.md`                        | `backend-hexagonal` | —                  |
| Pantalla o feature Angular       | `apps/console/AGENTS.md`                        | `angular-feature`   | —                  |
| Cambio de esquema de BD          | `apps/backend/AGENTS.md` + `docs/db/mapit.dbml` | `db-migration`      | `new-migration`    |
| Activar/desactivar funcionalidad | `infra/AGENTS.md`                               | —                   | `new-feature-flag` |
| Test E2E                         | `apps/e2e/AGENTS.md`                            | —                   | —                  |
| Decisión de arquitectura         | `docs/AGENTS.md`                                | —                   | —                  |

## Reglas duras (romperlas rompe el build)

1. **`*-domain` no importa Spring, JPA ni Jackson.** No es una convención: esos módulos
   Gradle no declaran las dependencias, así que no compila. ArchUnit es la segunda red.
2. **`*-application` no importa `*-infrastructure`.** Se habla con el exterior por puertos.
3. **El contrato se edita antes que el código.** `packages/api-contract/openapi.yaml` es la
   fuente de verdad; de ahí salen el cliente TS y las interfaces Java.
4. **El esquema solo cambia por migración Flyway.** `ddl-auto: validate` rompe el arranque
   si una entidad no coincide. Una migración mergeada no se edita jamás.
5. **Toda tabla de negocio lleva `tenant_id` + índice `(tenant_id, id)` + RLS.**
6. **Una feature Angular no importa de otra feature.** Lo compartido va a `libs/`.
7. **No se importa `konva` fuera de su adaptador.** El motor de mapa está sin decidir.
8. **Zoneless.** Nada de `provideZoneChangeDetection()` ni Zone.js.

## Comandos

```bash
pnpm dev        # todo el stack        pnpm check      # antes de push
pnpm doctor     # diagnóstico          pnpm api:gen    # regenerar el contrato
pnpm be:test    # tests backend        pnpm fe:test    # tests frontend
pnpm db:new "…" # nueva migración      pnpm new:flag … # nueva feature flag
```

## Trampas conocidas

- **Jackson 3** en Spring Boot 4: los imports son `tools.jackson.*`, **no**
  `com.fasterxml.jackson.*`. Es el error nº1 al copiar código de internet.
- **TypeScript 6** es obligatorio para Angular 22. No lo bajes.
- **Angular 22 sin sufijos** en los nombres de archivo: `home.ts`, no `home.component.ts`.
- **PostgreSQL en el puerto 5433**, no 5432 (para no chocar con instalaciones nativas).
- **Sin `tenant_id` en la sesión, las consultas devuelven 0 filas.** Es la RLS, no un bug.
- El código bajo `**/generated/` **no se edita**: se regenera desde el contrato.

## Estilo

Comentarios y documentación **en español**; identificadores de código en inglés
(`SpaceElement`, `TenantId`), que es lo que ya usan los documentos de dominio.
