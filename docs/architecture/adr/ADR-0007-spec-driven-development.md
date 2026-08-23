# ADR-0007 — Spec-Driven Development con agentes de IA

- **Estado:** Aceptado
- **Fecha:** 2026-08-23
- **Deciden:** Equipo MapIt

## Contexto

El equipo desarrolla apoyándose en agentes de IA, con muy poco código escrito a mano. Eso
cambia dónde está el cuello de botella del proyecto: escribir código deja de ser lo caro, y
pasan a serlo **decidir qué construir** y **verificar que lo construido es correcto**.

Hay además una restricción académica que no se puede ignorar: el equipo debe **defender** el
sistema ante un docente. Un proyecto que nadie sabe explicar no aprueba, por bien que funcione.

## Decisión

Adoptar **Spec-Driven Development**: la especificación es el entregable primario y el código
es su consecuencia.

Cada caso de uso tiene un directorio en `specs/` con tres documentos, completados en orden:

1. **`spec.md`** — QUÉ y POR QUÉ. Criterios de aceptación _verificables_ (si no se puede
   escribir un test que lo compruebe, está mal redactado), reglas de negocio, fuera de alcance.
2. **`plan.md`** — CÓMO. Módulos afectados, cambios de contrato, migraciones y una sección
   **obligatoria** de patrones de diseño con _por qué aquí_ y _alternativa descartada_.
3. **`tasks.md`** — Tareas ejecutables y verificables, en orden, más notas de ejecución.

`pnpm new:spec CU-XX-...` crea el andamiaje. Un PR sin spec asociada se devuelve.

### Barreras automáticas, no disciplina

Es la mitad menos obvia de la decisión y la más importante. Si el código lo produce un
agente, el review humano no puede ser la única defensa: es exactamente donde se pierde la
atención. Por eso cada garantía se delega a una herramienta que falla el build:

| Garantía                                | Quién la impone                                                             |
| --------------------------------------- | --------------------------------------------------------------------------- |
| El dominio no depende de frameworks     | el compilador: los módulos `*-domain` no declaran Spring                    |
| Las capas no se saltan                  | ArchUnit                                                                    |
| Las features del frontend no se acoplan | ESLint (`no-restricted-imports`)                                            |
| El esquema solo cambia por migración    | Hibernate `ddl-auto: validate` rompe el arranque                            |
| Contrato y código no divergen           | el build de Java falla si el controlador no implementa la interfaz generada |
| Un tenant no ve datos de otro           | Row-Level Security de PostgreSQL                                            |

Ninguna depende de que cinco personas recuerden una convención.

## Alternativas consideradas

| Opción                                      | Por qué no                                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Desarrollo tradicional, documentar después  | Con agentes, la documentación a posteriori describe código que nadie decidió conscientemente.               |
| Instalar spec-kit u otra herramienta de SDD | El flujo cabe en tres archivos Markdown y unas plantillas. Una herramienta más que aprender no aporta aquí. |
| Prompts sueltos sin especificación          | Es lo que produce sistemas que funcionan y nadie sabe explicar. Incompatible con la defensa.                |

## Consecuencias

**A favor**

- La especificación es revisable en un PR y versionada; el código se valida contra ella.
- El review se centra en la spec y en los tests, no en el estilo del código.
- Las especificaciones son, literalmente, el material de la defensa.

**En contra / riesgos**

- Escribir la spec antes se siente más lento al principio. Lo compensa no reescribir.
- **Riesgo principal: que el equipo no entienda lo que el agente produjo.**
  Contramedida: cada integrante es dueño de sus CU y debe poder explicar su `spec.md` y su
  `plan.md` sin ayuda. Las notas de ejecución de `tasks.md` documentan lo aprendido.
- Las specs pueden quedar desactualizadas respecto al código. Contramedida: los criterios de
  aceptación se marcan en el PR que los implementa.

## Soporte en el repositorio

- `AGENTS.md` en la raíz y en cada sección: enrutamiento de contexto para los agentes
- `.claude/agents/`: subagentes por capa, cada uno con las reglas de su zona
- `.claude/skills/`: flujos repetibles (`new-usecase`, `new-migration`, `new-feature-flag`)
- `specs/_template/`: las tres plantillas
