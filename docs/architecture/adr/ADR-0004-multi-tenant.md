# ADR-0004 — Aislamiento multi-tenant por columna discriminadora + Row-Level Security

- **Estado:** Aceptado
- **Fecha:** 2026-08-23
- **Deciden:** Equipo MapIt

## Contexto

`use_cases.md` sube el multi-tenant a alcance real: varias empresas conviven en la
plataforma con datos **aislados** (CU-02). La decisión condiciona la primera migración
y todas las consultas, y cambiarla más adelante obliga a reescribir ambas cosas — así
que se toma antes de escribir la primera tabla de negocio.

Restricciones: todo corre en localhost, con 5 desarrolladores, y el proyecto debe ser
demostrable ante un docente.

## Decisión

**Columna discriminadora `tenant_id`**, con dos capas de aplicación:

1. **Hibernate `@TenantId`** — el campo se marca una vez en la entidad e Hibernate añade
   el filtro automáticamente a todo `SELECT`, `UPDATE` y `DELETE`, y rellena el valor en
   cada `INSERT`. Ninguna consulta del código menciona `tenant_id`.
2. **PostgreSQL Row-Level Security** — política `tenant_isolation` sobre cada tabla de
   negocio, con la sesión fijando `SET LOCAL app.tenant_id`. Filtra en la base de datos,
   incluso ante SQL nativo que se saltara Hibernate.

El tenant se resuelve del **claim `tenant` del JWT**, no de un header `X-Tenant-Id`.
El header queda solo como fallback para las rutas públicas, donde se valida contra
`tenant.slug`.

Convención obligatoria para toda tabla de negocio:

```sql
tenant_id TEXT NOT NULL REFERENCES tenant(id)
CREATE INDEX ON tabla (tenant_id, id);
SELECT enable_tenant_isolation('tabla');
```

## Alternativas consideradas

| Opción                            | Por qué no                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Base de datos por tenant          | Aislamiento máximo, pero una BD por empresa y migraciones × N. Inviable en localhost.                                          |
| Schema por tenant                 | Flyway tendría que migrar N schemas y haría falta conexión dinámica. Complejidad real sin beneficio para el alcance académico. |
| Solo `WHERE tenant_id = ?` a mano | Depende de que 5 personas no olviden nunca la cláusula. Un olvido es una fuga de datos entre empresas.                         |
| Solo Hibernate, sin RLS           | Suficiente en teoría, pero cualquier consulta nativa o un bug de configuración salta el filtro. La RLS lo hace imposible.      |

## Consecuencias

**A favor**

- CU-02 deja de ser una promesa: es una garantía verificable con un test.
- Sin `app.tenant_id` en la sesión, las consultas devuelven **0 filas** — falla cerrado.
- Una sola BD, una sola migración, un solo pool de conexiones.
- Buen material de defensa: la doble capa es un argumento sólido.

**En contra**

- El backend debe fijar `app.tenant_id` en **cada** transacción; si se olvida, no se ven
  datos (mejor que verlos de más, pero desconcierta al depurar — está en `TROUBLESHOOTING.md`).
- Las tablas globales (`tenant`, catálogos) son la excepción y hay que recordarlo.
- Un tenant enorme no se puede aislar físicamente. Fuera del alcance del semestre.

## Verificación

`V1__baseline.sql` provee `current_tenant_id()` y `enable_tenant_isolation()`.
Todo CU que cree tablas debe incluir un test: _un usuario del tenant A no ve datos del B_.
