# ADR-0001 — Monorepo con pnpm workspaces + Angular CLI multi-proyecto

- **Estado:** Aceptado
- **Fecha:** 2026-08-23

## Contexto

El proyecto necesita un repositorio donde convivan **Java y TypeScript**: un backend Spring
Boot y dos aplicaciones Angular, con código compartido entre ellas. Debe inicializarse igual
en Windows, macOS y Linux (los 5 integrantes no usan el mismo sistema), y estar preparado
para GitHub y para Docker.

## Decisión

**pnpm workspaces + Angular CLI multi-proyecto**, sin herramienta de monorepo adicional.

- `angular.json` declara los tres proyectos de frontend (`console`, `public-web`, `libs`).
- `pnpm-workspace.yaml` une apps, libs y packages compartidos.
- El backend Java vive en `apps/backend/` con su propio build de Gradle, invocado desde los
  scripts de `package.json` para que nadie tenga que saber Gradle para levantarlo.
- **`package.json` es la única puerta de entrada**: nadie escribe `./gradlew` ni `ng` a mano.
- La orquestación se hace con scripts **Node** (`tools/scripts/*.mjs`), nunca con `.sh`, para
  que funcionen igual en PowerShell y en bash.

## Alternativas consideradas

| Opción                         | Por qué no                                                                                                                                                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nx**                         | Aporta caché de tareas, grafo de dependencias y `affected`. Potente, pero es otra capa que aprender para un equipo que ya está aprendiendo hexagonal, multi-tenant y SDD. Sus plugins de Java son inmaduros y solo cubren Gradle parcialmente. |
| **Turborepo**                  | Solo orquestador y caché. Liviano, pero no aporta nada específico a Angular, que ya sabe gestionar varios proyectos en un workspace.                                                                                                           |
| **Dos repositorios separados** | Rompe el versionado atómico del contrato API: un cambio de endpoint tendría que coordinarse entre dos PRs en dos repos. Es exactamente el problema que el monorepo evita.                                                                      |

Nx sigue siendo una opción razonable si el CI se vuelve lento. Migrar más adelante es viable
porque Nx puede adoptarse sobre un workspace existente de Angular CLI.

## Consecuencias

**A favor**

- Cero herramientas nuevas: `pnpm` y el CLI de Angular, que el equipo va a usar igualmente.
- Un solo commit puede cambiar el contrato, el backend y el frontend a la vez.
- Portabilidad real: wrapper de Gradle, Corepack para pnpm, scripts en Node.

**En contra**

- Sin caché de tareas: el CI reconstruye todo en cada push. Aceptable a esta escala.
- Sin `affected`: los tests corren completos siempre. También aceptable hoy.
