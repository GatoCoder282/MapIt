# Architecture Decision Records

Un **ADR** es un archivo corto que registra _qué se decidió, cuándo, y por qué se
descartaron las alternativas_. Sirve para dos cosas muy concretas:

1. Que dentro de tres meses nadie vuelva a discutir lo mismo desde cero.
2. Tener con qué responder cuando el docente pregunte «¿por qué así?».

## Formato

```markdown
# ADR-XXXX — <decisión, en una frase>

- **Estado:** Propuesto | Aceptado | Sustituido por ADR-YYYY
- **Fecha:** AAAA-MM-DD
- **Deciden:** <quiénes>

## Contexto

<Qué problema hay que resolver. Restricciones reales.>

## Decisión

<Qué se hace. En presente y en afirmativo.>

## Alternativas consideradas

| Opción | Por qué no |
| ------ | ---------- |

## Consecuencias

<Qué se gana, qué se pierde, qué queda más difícil a partir de ahora.>
```

## Índice

| ADR                                         | Decisión                                     | Estado        |
| ------------------------------------------- | -------------------------------------------- | ------------- |
| [0001](ADR-0001-monorepo-tooling.md)        | pnpm workspaces + Angular CLI multi-proyecto | Aceptado      |
| [0002](ADR-0002-arquitectura-backend.md)    | Hexagonal Modular con módulos Gradle         | Aceptado      |
| [0003](ADR-0003-arquitectura-frontend.md)   | MVVM con Signals + feature-first             | Aceptado      |
| [0004](ADR-0004-multi-tenant.md)            | Columna discriminadora + RLS                 | Aceptado      |
| [0005](ADR-0005-feature-toggles.md)         | Unleash self-hosted                          | Aceptado      |
| [0006](ADR-0006-motor-de-mapa.md)           | Motor de mapa tras un puerto                 | **Propuesto** |
| [0007](ADR-0007-spec-driven-development.md) | Spec-Driven Development                      | Aceptado      |
