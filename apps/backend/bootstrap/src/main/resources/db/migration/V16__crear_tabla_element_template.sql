-- HU-4.02 (MAP-202, MAP-203): plantillas de configuración de SpaceElement.
-- Migración V16. Creada el 2026-10-04.
--
-- REGLAS (plan §12):
--   1. Toda tabla de negocio lleva  tenant_id TEXT NOT NULL REFERENCES tenant(id)
--   2. Índice compuesto (tenant_id, id)
--   3. SELECT enable_tenant_isolation('<tabla>');  ← activa RLS
--   4. NUNCA edites una migración ya mergeada: Flyway guarda su checksum
--      y el arranque fallará. Para corregir, crea una migración nueva.
--   5. Actualiza docs/db/mapit.dbml en el MISMO commit.
--
-- Decisión de diseño (ver docs del dominio):
--   Una plantilla almacena SOLO los campos que constituyen una configuración reusable:
--   name (identificador humano) y type (SpaceElementType).
--   No almacena sectorId, x, y, state ni id de instancia — esos son datos de posición
--   e instancia, no de configuración.

CREATE TABLE element_template (
    id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        TEXT             NOT NULL REFERENCES tenant(id),
    name             TEXT             NOT NULL,
    type             TEXT             NOT NULL,

    -- Auditoría. Las columnas *_by son UUID SIN clave foránea a propósito (hasta CU-23/CU-24).
    created_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),
    created_by       UUID,
    updated_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_by       UUID,

    -- Baja lógica (coherente con space_element, sector, floor)
    deleted_at       TIMESTAMPTZ,
    deleted_by       UUID,

    CONSTRAINT element_template_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
    CONSTRAINT element_template_deleted_by_exige_deleted_at
        CHECK (deleted_by IS NULL OR deleted_at IS NOT NULL)
);

COMMENT ON TABLE  element_template IS 'Plantillas de configuración de SpaceElement (CU-07/HU-4.02).';
COMMENT ON COLUMN element_template.name IS 'Nombre descriptivo de la plantilla visible por el usuario (ej. "Mesa redonda 6 pax").';
COMMENT ON COLUMN element_template.type IS 'Tipo de SpaceElement que define la plantilla (TABLE, BAR, SECTOR_ZONE, STAGE, SEAT, ROOM, DECOR). Validado en dominio.';
COMMENT ON COLUMN element_template.deleted_at IS 'Baja lógica: si no es NULL, la fila está dada de baja y no aparece en consultas activas.';

-- Regla 2: índice compuesto obligatorio
CREATE INDEX element_template_tenant_id_id_idx ON element_template (tenant_id, id);

-- Consulta principal: plantillas vivas de un tenant, ordenadas por nombre
CREATE INDEX element_template_tenant_alive_idx
    ON element_template (tenant_id, name ASC)
    WHERE deleted_at IS NULL;

-- Unicidad de nombre dentro del tenant (sobre filas vivas): se verifica en capa de aplicación
-- para dar 409 claro, pero también en BD como segunda red de seguridad.
CREATE UNIQUE INDEX element_template_tenant_name_unique_idx
    ON element_template (tenant_id, lower(name))
    WHERE deleted_at IS NULL;

-- Trigger de actualización (mismo patrón que space_element, sector, floor)
CREATE TRIGGER element_template_touch_updated_at
    BEFORE UPDATE ON element_template
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Regla 3: Activa Row-Level Security (RLS) por tenant
SELECT enable_tenant_isolation('element_template');
