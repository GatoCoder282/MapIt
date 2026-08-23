---
name: new-usecase
description: Arranca un caso de uso de MapIt con el ciclo Spec-Driven completo (spec → plan → tasks). Úsalo cuando el usuario quiera empezar un CU nuevo, o diga "implementemos CU-XX".
---

# Arrancar un caso de uso

MapIt se desarrolla con **Spec-Driven Development**: como el código lo escribe mayormente
un agente, el entregable valioso es la especificación. No escribas código antes de que la
spec esté aprobada.

## Paso 1 — Crear el andamiaje

```bash
pnpm new:spec CU-12-crear-reserva
```

Crea `specs/CU-12-crear-reserva/` con `spec.md`, `plan.md` y `tasks.md`, y precarga el
enunciado desde `docs/roadmap/use_cases.md`.

## Paso 2 — Llenar `spec.md` (QUÉ y POR QUÉ)

Lee el enunciado del CU en `docs/roadmap/use_cases.md` y los requerimientos relacionados
en `project_definition.md`.

Lo importante:

- **Criterios de aceptación verificables.** Formato _Dado… cuando… entonces…_. Si no se
  puede escribir un test que lo compruebe, está mal redactado.
- **Fuera de alcance explícito.** Lo que no se hace, para que nadie lo dé por supuesto.
- **§9 Impacto multi-tenant.** Si hay tablas nuevas, cómo se aíslan.

**Pregunta al usuario lo que no esté claro antes de seguir.** Una spec ambigua produce
código ambiguo, y con agentes eso se multiplica.

## Paso 3 — Llenar `plan.md` (CÓMO)

- **§2 Patrones de diseño es OBLIGATORIA.** Consulta
  `docs/architecture/design-patterns.md`. Las columnas _por qué aquí_ y _alternativa
  descartada_ existen para que cada patrón se justifique o se caiga. Si el CU es un CRUD
  sin complejidad real, decir "ninguno, no hace falta" es una respuesta válida y honesta.
- Si hay cambios de API, se listan aquí y se editan en el contrato **antes** del código.
- Si hay tablas nuevas, se anota la migración y el test de aislamiento.

## Paso 4 — Llenar `tasks.md`

Tareas en orden, cada una **verificable**: al terminarla, algo observable cambia.
El orden habitual es contrato → migración → dominio → casos de uso → adaptadores →
ViewModel → UI → cierre.

## Paso 5 — Ejecutar

Delega en el agente adecuado según la tarea:

| Tarea     | Agente              |
| --------- | ------------------- |
| Contrato  | `api-contract`      |
| Migración | `db-migration`      |
| Backend   | `backend-hexagonal` |
| Frontend  | `angular-feature`   |

## Paso 6 — Cerrar

- [ ] Criterios de aceptación de `spec.md` marcados
- [ ] `pnpm check` en verde
- [ ] `docs/db/mapit.dbml` actualizado si cambió el esquema
- [ ] **Notas de ejecución** escritas en `tasks.md` — es lo que demuestra que el equipo
      entendió lo que se construyó, y lo que se defiende ante el docente
