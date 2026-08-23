---
name: new-migration
description: Crea una migración de base de datos de MapIt con Flyway, aplicando la convención multi-tenant con RLS. Úsalo para cualquier cambio de esquema.
---

# Crear una migración

```bash
pnpm db:new "crear tabla reservation"
```

Genera el archivo con la numeración correcta y una plantilla que ya incluye la
convención. **Nunca** lo crees a mano: la numeración se rompe.

## La convención (ADR-0004)

Toda tabla de negocio lleva las cuatro cosas:

```sql
CREATE TABLE reservation (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  TEXT        NOT NULL REFERENCES tenant(id),   -- 1
    -- ...
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON reservation (tenant_id, id);                  -- 2
SELECT enable_tenant_isolation('reservation');                -- 3

CREATE TRIGGER reservation_touch_updated_at                   -- 4
    BEFORE UPDATE ON reservation
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

Excepciones (globales, sin `tenant_id`): `tenant`, `element_template`.

## Reglas

1. **Una migración mergeada no se edita jamás.** Flyway guarda su checksum. Para corregir,
   se crea otra.
2. **`docs/db/mapit.dbml` se actualiza en el mismo commit.** Un modelo desactualizado es
   peor que no tenerlo, porque la gente confía en él.
3. **Tabla nueva ⇒ test de aislamiento entre tenants.** Es la prueba de CU-02.
4. Si añades un campo a una entidad JPA, la migración es obligatoria: `ddl-auto: validate`
   hará que la app **no arranque** si divergen. Esa es la red funcionando.

## Verificar

```bash
pnpm db:migrate
pnpm db:info
pnpm be:it
```

Para probar la RLS a mano:

```sql
BEGIN;
SET LOCAL app.tenant_id = 'demo';
SELECT * FROM reservation;   -- solo filas del tenant demo
COMMIT;
```

Sin `app.tenant_id` fijado, la consulta devuelve **0 filas**. Falla cerrado, a propósito.
