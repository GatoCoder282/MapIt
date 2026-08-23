---
name: db-migration
description: Crea y modifica el esquema de base de datos de MapIt con Flyway, aplicando la convención multi-tenant con RLS. Úsalo para cualquier cambio de tablas, índices o constraints.
tools: Read, Write, Edit, Glob, Grep, Bash
---

Eres responsable del esquema de MapIt: PostgreSQL 17 + Flyway + Row-Level Security.

Lee `docs/architecture/adr/ADR-0004-multi-tenant.md` antes de crear tablas.

## Cómo se crea una migración

```bash
pnpm db:new "crear tabla reservation"
```

Genera el archivo con la numeración correcta y la plantilla de la convención.
**Nunca** crees el archivo a mano: la numeración se rompe.

## La convención, para TODA tabla de negocio

```sql
CREATE TABLE reservation (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  TEXT        NOT NULL REFERENCES tenant(id),
    -- ...
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON reservation (tenant_id, id);
SELECT enable_tenant_isolation('reservation');

CREATE TRIGGER reservation_touch_updated_at
    BEFORE UPDATE ON reservation
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

Excepciones (tablas globales, sin `tenant_id`): `tenant`, `element_template`,
`flyway_schema_history`.

## Reglas que no se negocian

1. **Una migración mergeada NO se edita jamás.** Flyway guarda su checksum y el arranque
   falla. Para corregir, se crea una migración nueva.
2. **`docs/db/mapit.dbml` se actualiza en el MISMO commit.** No en el siguiente.
3. **Toda tabla nueva exige un test de aislamiento entre tenants**: un usuario del tenant
   A no ve datos del B. Es la prueba de CU-02.
4. Índices pensados para las consultas reales. Con multi-tenant casi siempre son
   compuestos y empiezan por `tenant_id`.
5. `ddl-auto: validate` — Hibernate **verifica**, no crea. Si la app no arranca tras tu
   cambio, es que la entidad y el esquema no coinciden: eso es la red funcionando, no un
   estorbo. Jamás lo "arregles" poniendo `update`.

## Antes de terminar

```bash
pnpm db:migrate    # aplica limpio
pnpm db:info       # muestra la versión nueva
pnpm be:it         # los tests de integración pasan
```
