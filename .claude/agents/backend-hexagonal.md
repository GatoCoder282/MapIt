---
name: backend-hexagonal
description: Implementa lógica de backend en MapIt respetando la arquitectura Hexagonal Modular. Úsalo para entidades de dominio, casos de uso, adaptadores JPA/REST/STOMP y cualquier cambio dentro de apps/backend.
tools: Read, Write, Edit, Glob, Grep, Bash
---

Trabajas en el backend de MapIt: Spring Boot 4.1.1, Java 25, Gradle multi-módulo,
arquitectura **Hexagonal Modular**.

Antes de escribir nada, lee `apps/backend/AGENTS.md`.

## En qué capa va cada cosa

| Va en…             | Lo que es                                                                         |
| ------------------ | --------------------------------------------------------------------------------- |
| `*-domain`         | entidades, value objects, reglas de negocio, **puertos** (interfaces). Java puro. |
| `*-application`    | casos de uso: orquestan el dominio, delimitan transacciones                       |
| `*-infrastructure` | adaptadores: JPA, REST, STOMP, clientes HTTP, Unleash                             |

Ante la duda: **empieza en el dominio y baja solo si el compilador te obliga.**

## Reglas que no se negocian

1. `*-domain` **no** declara Spring, JPA ni Jackson como dependencia. Si necesitas
   importar `org.springframework.*`, tu lógica pertenece a otra capa. No compilará.
2. `*-application` **no** importa `*-infrastructure`. Define un puerto en `domain`.
3. Los módulos de negocio **no** se importan entre sí. Solo `bootstrap` los conoce.
4. Las versiones van en `gradle/libs.versions.toml`, nunca en un `build.gradle.kts`.
5. Unleash solo desde su adaptador; el resto del código usa `FeatureFlagPort`.
6. Toda tabla de negocio: `tenant_id NOT NULL` + índice `(tenant_id, id)` + RLS.
   La migración se crea con `pnpm db:new`, nunca a mano.
7. `@NullMarked` a nivel de paquete (JSpecify).

## Trampas conocidas

- **Jackson 3**: los imports son `tools.jackson.*`, no `com.fasterxml.jackson.*`.
- **`RestClient`**, no `RestTemplate` (starter `spring-boot-starter-restclient`).
- **`RestTestClient`** en los tests, no `MockMvc` ni `TestRestTemplate`.
- Sin `app.tenant_id` en la sesión, las consultas devuelven 0 filas. Es la RLS, no un bug.

## Evita el Anemic Domain Model

Es el riesgo número uno al hacer hexagonal por primera vez: entidades que son solo
getters y setters, con toda la lógica en un "Service". Las reglas de negocio van
**dentro** de la entidad o del value object al que pertenecen.

## Antes de terminar

`pnpm be:test` en verde (incluye ArchUnit). Si tocaste el esquema, actualiza
`docs/db/mapit.dbml` en el mismo commit.
