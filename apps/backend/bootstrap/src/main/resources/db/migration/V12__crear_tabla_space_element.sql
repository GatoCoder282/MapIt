-- HU-2.03 (MAP-111, MAP-115): elementos espaciales dentro de un sector.
-- Migración V12. Creada el 2026-09-23.
--
-- REGLAS (plan §12):
--   1. Toda tabla de negocio lleva  tenant_id TEXT NOT NULL REFERENCES tenant(id)
--   2. Índice compuesto (tenant_id, id)
--   3. SELECT enable_tenant_isolation('<tabla>');  ← activa RLS
--   4. NUNCA edites una migración ya mergeada: Flyway guarda su checksum
--      y el arranque fallará. Para corregir, crea una migración nueva.
--   5. Actualiza docs/db/mapit.dbml en el MISMO commit.

CREATE TABLE space_element (
    id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        TEXT             NOT NULL REFERENCES tenant(id),
    sector_id        UUID             NOT NULL REFERENCES sector(id) ON DELETE RESTRICT,
    type             TEXT             NOT NULL,
    state            TEXT             NOT NULL,
    x                DOUBLE PRECISION NOT NULL,
    y                DOUBLE PRECISION NOT NULL,

    -- Auditoría. Las columnas *_by son UUID SIN clave foránea a propósito (hasta CU-23/CU-24).
    created_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),
    created_by       UUID,
    updated_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_by       UUID,

    -- Baja lógica
    deleted_at       TIMESTAMPTZ,
    deleted_by       UUID,

    CONSTRAINT space_element_coords_non_negative CHECK (x >= 0 AND y >= 0),
    CONSTRAINT space_element_deleted_by_exige_deleted_at
        CHECK (deleted_by IS NULL OR deleted_at IS NOT NULL)
);

COMMENT ON TABLE  space_element IS 'Elementos espaciales dentro de un sector (CU-08/HU-2.03).';
COMMENT ON COLUMN space_element.sector_id IS 'FK al sector al que pertenece el elemento. ON DELETE RESTRICT impide orfandad.';
COMMENT ON COLUMN space_element.type IS 'Tipo de elemento (TABLE, BAR, SECTOR_ZONE, STAGE, SEAT, ROOM, DECOR). Validado en dominio (SpaceElementTypePolicy).';
COMMENT ON COLUMN space_element.state IS 'Estado operativo actual del elemento (AVAILABLE, OCCUPIED, RESERVED, CLEANING, OUT_OF_SERVICE). Compartido con shared-kernel SpaceElementState.';
COMMENT ON COLUMN space_element.x IS 'Coordenada horizontal relativa al sector (origen en la esquina superior izquierda).';
COMMENT ON COLUMN space_element.y IS 'Coordenada vertical relativa al sector.';
COMMENT ON COLUMN space_element.deleted_at IS 'Baja lógica: si no es NULL, la fila está dada de baja y no aparece en consultas.';

-- Regla 2: índice compuesto obligatorio
CREATE INDEX space_element_tenant_id_id_idx ON space_element (tenant_id, id);

-- Lista los elementos vivos de un sector del tenant (patrón de consulta principal de la HU)
CREATE INDEX space_element_tenant_sector_vivos_idx
    ON space_element (tenant_id, sector_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- Trigger de actualización
CREATE TRIGGER space_element_touch_updated_at
    BEFORE UPDATE ON space_element
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Regla 3: Activa Row-Level Security (RLS) por tenant
SELECT enable_tenant_isolation('space_element');
