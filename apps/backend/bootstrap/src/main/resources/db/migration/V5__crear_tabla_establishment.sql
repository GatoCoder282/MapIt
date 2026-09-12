-- crear tabla establishment
-- Migración V3. Creada el 2026-09-09. CU-04 — Gestión de Establecimientos (HU-2.01).
--
-- REGLAS (plan §12):
--   1. Toda tabla de negocio lleva  tenant_id TEXT NOT NULL REFERENCES tenant(id)
--   2. Índice compuesto (tenant_id, id)
--   3. SELECT enable_tenant_isolation('<tabla>');  ← activa RLS
--   4. NUNCA edites una migración ya mergeada: Flyway guarda su checksum
--      y el arranque fallará. Para corregir, crea una migración nueva.
--   5. Actualiza docs/db/mapit.dbml en el MISMO commit.

CREATE TABLE establishment (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  TEXT         NOT NULL REFERENCES tenant(id),
    name       VARCHAR(120) NOT NULL,
    type       TEXT         NOT NULL,
    slug       VARCHAR(63)  NOT NULL,
    timezone   VARCHAR(64)  NOT NULL DEFAULT 'America/La_Paz',

    -- Auditoría. Las columnas *_by son UUID SIN clave foránea a propósito:
    -- la tabla app_user todavía no existe (llega en CU-23/CU-24). La migración
    -- que la cree debe añadir las tres FK. Hasta entonces se persisten nulas.
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by UUID,

    -- Baja lógica (RN-5): la fila se conserva. floor y sector (CU-05) apuntarán
    -- a esta tabla, así que un borrado físico dejaría huérfanos.
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT establishment_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT establishment_type_valid
        CHECK (type IN ('RESTAURANT', 'NIGHTCLUB', 'EVENT_HALL', 'HOTEL')),
    CONSTRAINT establishment_slug_format
        CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
    -- No puede haber autor de la baja sin fecha de baja. Al revés SÍ se permite:
    -- hoy toda baja tiene deleted_by nulo porque aún no hay usuarios (CU-23/CU-24).
    CONSTRAINT establishment_deleted_by_exige_deleted_at
        CHECK (deleted_by IS NULL OR deleted_at IS NOT NULL)
);

COMMENT ON TABLE  establishment IS
    'Establecimientos de un tenant (CU-04). El type selecciona qué plantillas de elemento aplican (CU-07).';
COMMENT ON COLUMN establishment.slug IS
    'Identificador en URLs públicas de reserva (CU-15). Único entre las filas vivas del tenant.';
COMMENT ON COLUMN establishment.deleted_at IS
    'Baja lógica: si no es NULL, la fila está dada de baja y no debe aparecer en consultas.';
COMMENT ON COLUMN establishment.created_by IS
    'FK futura a app_user(id); se añade en CU-23/CU-24.';

CREATE INDEX establishment_tenant_id_id_idx ON establishment (tenant_id, id);

-- Índice único PARCIAL: la unicidad del slug solo aplica a las filas vivas.
-- Uno total impediría reutilizar el slug de un establecimiento dado de baja,
-- que es justo lo que exige el criterio de aceptación CA-7.
CREATE UNIQUE INDEX establishment_tenant_slug_vivo_uidx
    ON establishment (tenant_id, slug)
    WHERE deleted_at IS NULL;

-- Acelera el listado, que siempre filtra por tenant y por filas vivas.
CREATE INDEX establishment_tenant_vivos_idx
    ON establishment (tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TRIGGER establishment_touch_updated_at
    BEFORE UPDATE ON establishment
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

SELECT enable_tenant_isolation('establishment');
