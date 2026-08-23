# {{CODIGO}} — Plan técnico

> Se escribe **después** de que `spec.md` esté aprobada, y **antes** de tocar código.

## 1. Enfoque

<En 3-5 frases: cómo se va a construir. Si hay dos caminos razonables, di cuál
eliges y por qué el otro no.>

## 2. Patrones de diseño aplicados

> **Sección obligatoria.** Un plan sin esta tabla completa no pasa review.
> Las columnas "por qué aquí" y "alternativa descartada" existen para que cada
> patrón se justifique o se caiga: meter patrones para lucirlos hace daño.
> Catálogo de referencia: `docs/architecture/design-patterns.md`.

| Patrón | Dónde | Por qué aquí | Alternativa descartada |
| ------ | ----- | ------------ | ---------------------- |
|        |       |              |                        |

## 3. Cambios en el contrato API

- [ ] ¿Hay endpoints nuevos o modificados? → editar `packages/api-contract/openapi.yaml` **primero**
- [ ] `pnpm api:gen` tras cada cambio del contrato

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
|        |      |             |

## 4. Backend

**Módulo(s):** `<platform / identity / spaces / operations / reservations / payments>`

| Capa               | Qué se añade                                                      |
| ------------------ | ----------------------------------------------------------------- |
| `*-domain`         | <entidades, value objects, puertos — recuerda: sin Spring ni JPA> |
| `*-application`    | <casos de uso>                                                    |
| `*-infrastructure` | <adaptadores: JPA, REST, STOMP>                                   |

## 5. Base de datos

- [ ] Migración necesaria → `pnpm db:new "<descripción>"`
- [ ] `tenant_id NOT NULL` + índice `(tenant_id, id)` + `enable_tenant_isolation()`
- [ ] `docs/db/mapit.dbml` actualizado en el **mismo** commit

## 6. Frontend

**App:** `<console / public-web>` · **Feature:** `<carpeta>`

| Parte                | Qué se añade                      |
| -------------------- | --------------------------------- |
| `model/` (ViewModel) | <signal store: estado y comandos> |
| `ui/`                | <componentes; solo presentación>  |
| `data/`              | <llamadas al api-client>          |

## 7. Feature toggle

- [ ] ¿Va detrás de una flag? → `pnpm new:flag <dominio>.<feature>`
- Clave: `<...>` · Tipo: `<release / kill-switch / experiment / permission>`
- Si es **release**: fecha de retiro `<AAAA-MM-DD>` e issue de limpieza `#<n>`

## 8. Testing

| Nivel              | Qué se prueba                                            |
| ------------------ | -------------------------------------------------------- |
| Unit (dominio)     | <reglas de negocio, sin contexto Spring>                 |
| Integración        | <con Testcontainers, si toca la BD>                      |
| Aislamiento tenant | <obligatorio si hay tablas nuevas>                       |
| Frontend           | <ViewModel con Vitest>                                   |
| E2E                | <solo si el caso de uso es un flujo de usuario completo> |

## 9. Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
|        |            |
