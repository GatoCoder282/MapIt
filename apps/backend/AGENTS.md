# Backend — contexto para agentes

## Dónde estás

Spring Boot 4.1.1 sobre Java 25, con **Gradle multi-módulo** y arquitectura
**Hexagonal Modular**. Aquí vive toda la lógica de negocio.
Lo que NO vive aquí: nada de presentación (eso es `apps/console` y `apps/public-web`).

## Estructura

```
shared-kernel/          TenantId, TenantContext, FeatureFlagPort — sin frameworks
modules/<contexto>/
  <contexto>-domain/          entidades, value objects, PUERTOS. Java puro.
  <contexto>-application/     casos de uso, @Transactional
  <contexto>-infrastructure/  adaptadores: JPA, REST, STOMP, HTTP
bootstrap/              la app: solo config y wiring. Único con `main`.
build-logic/            convention plugins (la arquitectura como código de build)
```

Contextos y sus casos de uso:

| Módulo         | CU                                                            |
| -------------- | ------------------------------------------------------------- |
| `platform`     | CU-01…CU-03 tenants, super admin                              |
| `identity`     | CU-23, CU-24 auth JWT, roles                                  |
| `spaces`       | CU-04…CU-08 Establishment > Floor > Sector > SpaceElement     |
| `operations`   | CU-09, CU-10, CU-14 estados, tiempo real, bitácora, dashboard |
| `reservations` | CU-11…CU-13, CU-15, CU-16, CU-18                              |
| `payments`     | CU-17 pasarela QR (hoy `PAYMENT_PROVIDER=mock`)               |

## Reglas duras

1. **`*-domain` no declara Spring como dependencia.** Importar `org.springframework.*`
   o `jakarta.persistence.*` **no compila**. Si crees que lo necesitas, tu lógica
   pertenece a `application` o a `infrastructure`.
2. **`*-application` no importa `*-infrastructure`.** Define un puerto en `domain` y
   que la infraestructura lo implemente.
3. **Los módulos no se importan entre sí.** Solo `bootstrap` los conoce a todos.
   Un ciclo entre contextos significa que los límites están mal trazados.
4. **Las versiones van en `gradle/libs.versions.toml`**, nunca escritas en un
   `build.gradle.kts`.
5. **Unleash solo se toca desde su adaptador.** El resto del código usa `FeatureFlagPort`.
6. **Migraciones:** `pnpm db:new "…"`. Nunca editar una ya mergeada.
   Toda tabla de negocio: `tenant_id NOT NULL` + índice `(tenant_id, id)` + RLS.

Todo esto lo verifica `bootstrap/src/test/java/com/mapit/architecture/ArchitectureTest.java`.

## Multi-tenant

El tenant sale del **claim `tenant` del JWT**, no de un header (falsificable).
Doble capa de aislamiento:

1. Hibernate `@TenantId` filtra automáticamente — ninguna query menciona `tenant_id`.
2. PostgreSQL RLS filtra en la BD, incluso ante SQL nativo.

Sin tenant en la sesión, las consultas devuelven **0 filas**. Falla cerrado, a propósito.

## Comandos

```bash
pnpm be:run    # bootRun          pnpm be:test   # unit + ArchUnit
pnpm be:it     # Testcontainers   pnpm be:fmt    # Spotless
pnpm db:migrate / db:info / db:new "…"
```

## Trampas conocidas

- **Jackson 3:** los imports son `tools.jackson.*`. `com.fasterxml.jackson.*` es Jackson 2,
  deprecado en Boot 4. Error nº1 al copiar snippets.
- **`RestClient`, no `RestTemplate`** (starter `spring-boot-starter-restclient`).
- **`RestTestClient`** reemplaza a `MockMvc`/`TestRestTemplate` en los tests.
- **Null-safety JSpecify:** cada paquete lleva `package-info.java` con `@NullMarked`.
- `springdoc` puede ir un paso atrás respecto a Spring Framework 7. Si falla, el contrato
  sigue siendo el yaml; el chequeo de drift inverso es lo único que se pospone.
- La primera compilación descarga medio internet: 3-5 min, una sola vez.

## Antes de dar por terminado

`pnpm be:test` en verde (incluye ArchUnit) y, si tocaste el esquema,
`docs/db/mapit.dbml` actualizado en el mismo commit.
