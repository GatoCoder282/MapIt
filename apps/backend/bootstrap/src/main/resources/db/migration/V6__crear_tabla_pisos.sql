-- Migración V4. Creada el 2026-09-11. CU-05 — Configuración de Plantas y Sectores (HU-2.02).
--
-- REGLAS (plan §12):
--   1. Toda tabla de negocio lleva   tenant_id TEXT NOT NULL REFERENCES tenant(id)
--   2. Índice compuesto (tenant_id, id)
--   3. SELECT enable_tenant_isolation('<tabla>');  ← activa RLS
--   4. NUNCA edites una migración ya mergeada: Flyway guarda su checksum
--      y el arranque fallará. Para corregir, crea una migración nueva.
--   5. Actualiza docs/db/mapit.dbml en el MISMO commit.

CREATE TABLE floor (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        TEXT         NOT NULL REFERENCES tenant(id),
    establishment_id UUID         NOT NULL REFERENCES establishment(id) ON DELETE RESTRICT,
    name             VARCHAR(100) NOT NULL,
    level            INTEGER      NOT NULL CHECK (level BETWEEN 1 AND 999),
    slug             TEXT         CHECK (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),

    -- Auditoría. Las columnas *_by son UUID SIN clave foránea a propósito:
    -- la tabla app_user todavía no existe (llega en CU-23/CU-24). La migración
    -- que la cree debe añadir las tres FK. Hasta entonces se persisten nulas.
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by       UUID,
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by       UUID,

    -- Baja lógica (RN-5): la fila se conserva. sector (CU-05) apuntará
    -- a esta tabla, así que un borrado físico dejaría huérfanos.
    deleted_at       TIMESTAMPTZ,
    deleted_by       UUID,

    CONSTRAINT floor_name_not_blank CHECK (length(btrim(name)) > 0),
    -- No puede haber autor de la baja sin fecha de baja.
    CONSTRAINT floor_deleted_by_exige_deleted_at
        CHECK (deleted_by IS NULL OR deleted_at IS NOT NULL)
);

COMMENT ON TABLE  floor IS 'Plantas o niveles de un establecimiento (CU-05/HU-2.02). Servirá de contenedor para los sectores.';
COMMENT ON COLUMN floor.establishment_id IS 'FK al establecimiento al que pertenece la planta.';
COMMENT ON COLUMN floor.level IS 'Nivel vertical físico de la planta (1 a 999).';
COMMENT ON COLUMN floor.slug IS 'Identificador URL amigable. Es NULL cuando la planta está dada de baja.';
COMMENT ON COLUMN floor.deleted_at IS 'Baja lógica: si no es NULL, la fila está dada de baja y no debe aparecer en consultas.';
COMMENT ON COLUMN floor.created_by IS 'FK futura a app_user(id); se añade en CU-23/CU-24.';

-- Regla 2: Índice compuesto obligatorio
CREATE INDEX floor_tenant_id_id_idx ON floor (tenant_id, id);

-- Índice único PARCIAL para el slug (solo filas vivas que no hayan liberado su slug)
CREATE UNIQUE INDEX floor_establishment_slug_uidx
    ON floor (establishment_id, slug)
    WHERE deleted_at IS NULL AND slug IS NOT NULL;

-- Índice único PARCIAL para el nivel (no se puede repetir nivel en filas vivas del mismo establecimiento)
CREATE UNIQUE INDEX floor_establishment_level_uidx
    ON floor (establishment_id, level)
    WHERE deleted_at IS NULL;

-- Acelera el listado de plantas de un establecimiento filtrando solo las filas vivas.
CREATE INDEX floor_tenant_establishment_vivos_idx
    ON floor (tenant_id, establishment_id, level ASC, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TRIGGER floor_touch_updated_at
    BEFORE UPDATE ON floor
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Regla 3: Activa Row-Level Security (RLS) por tenant
SELECT enable_tenant_isolation('floor');
