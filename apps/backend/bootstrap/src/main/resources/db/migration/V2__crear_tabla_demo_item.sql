-- crear tabla demo_item
-- Migración V2. Creada el 2026-09-01.
--
-- REGLAS (plan §12):
--   1. Toda tabla de negocio lleva  tenant_id TEXT NOT NULL REFERENCES tenant(id)
--   2. Índice compuesto (tenant_id, id)
--   3. SELECT enable_tenant_isolation('<tabla>');  ← activa RLS
--   4. NUNCA edites una migración ya mergeada: Flyway guarda su checksum
--      y el arranque fallará. Para corregir, crea una migración nueva.
--   5. Actualiza docs/db/mapit.dbml en el MISMO commit.

-- Tabla temporal para probar Angular + Spring Boot + PostgreSQL.
CREATE TABLE demo_item (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT         NOT NULL REFERENCES tenant(id),
    name        VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT demo_item_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE INDEX demo_item_tenant_id_id_idx ON demo_item (tenant_id, id);

CREATE TRIGGER demo_item_touch_updated_at
    BEFORE UPDATE ON demo_item
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

SELECT enable_tenant_isolation('demo_item');
