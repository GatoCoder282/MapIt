-- Migración V5. Creada el 2026-09-12. CU-05 — Configuración de Plantas y Sectores.
--
-- REGLAS (plan §12):
--   1. Toda tabla de negocio lleva   tenant_id TEXT NOT NULL REFERENCES tenant(id)
--   2. Índice compuesto (tenant_id, id)
--   3. SELECT enable_tenant_isolation('<tabla>');  ← activa RLS

CREATE TABLE sector (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        TEXT         NOT NULL REFERENCES tenant(id),
    floor_id         UUID         NOT NULL REFERENCES floor(id) ON DELETE RESTRICT,
    name             VARCHAR(100) NOT NULL,
    slug             TEXT         CHECK (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
    max_capacity     INTEGER      NOT NULL CHECK (max_capacity > 0),

    -- Auditoría. Las columnas *_by son UUID SIN clave foránea a propósito (hasta CU-23/CU-24).
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by       UUID,
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by       UUID,

    -- Baja lógica (RN-5)
    deleted_at       TIMESTAMPTZ,
    deleted_by       UUID,

    CONSTRAINT sector_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT sector_deleted_by_exige_deleted_at
        CHECK (deleted_by IS NULL OR deleted_at IS NOT NULL)
);

COMMENT ON TABLE  sector IS 'Sectores dentro de una planta (CU-05).';
COMMENT ON COLUMN sector.floor_id IS 'FK a la planta a la que pertenece el sector.';
COMMENT ON COLUMN sector.slug IS 'Identificador URL amigable. Es NULL cuando el sector está dado de baja.';
COMMENT ON COLUMN sector.max_capacity IS 'Capacidad máxima de personas o recursos en el sector.';
COMMENT ON COLUMN sector.deleted_at IS 'Baja lógica: si no es NULL, la fila está dada de baja y no debe aparecer en consultas.';

-- Regla 2: Índice compuesto obligatorio
CREATE INDEX sector_tenant_id_id_idx ON sector (tenant_id, id);

-- Índice único PARCIAL para el slug (solo filas vivas en la misma planta)
CREATE UNIQUE INDEX sector_floor_slug_uidx
    ON sector (floor_id, slug)
    WHERE deleted_at IS NULL AND slug IS NOT NULL;

-- Acelera el listado de sectores de una planta filtrando solo las filas vivas
CREATE INDEX sector_tenant_floor_vivos_idx
    ON sector (tenant_id, floor_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- Trigger de actualización
CREATE TRIGGER sector_touch_updated_at
    BEFORE UPDATE ON sector
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Regla 3: Activa Row-Level Security (RLS) por tenant
SELECT enable_tenant_isolation('sector');
