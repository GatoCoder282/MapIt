-- agregar address a establishment
-- Migración V13. Creada el 2026-09-25.
--
-- REGLAS (plan §12):
--   1. Toda tabla de negocio lleva  tenant_id TEXT NOT NULL REFERENCES tenant(id)
--   2. Índice compuesto (tenant_id, id)
--   3. SELECT enable_tenant_isolation('<tabla>');  ← activa RLS
--   4. NUNCA edites una migración ya mergeada: Flyway guarda su checksum
--      y el arranque fallará. Para corregir, crea una migración nueva.
--   5. Actualiza docs/db/mapit.dbml en el MISMO commit.

-- CREA tabla: no aplica — es ALTER sobre `establishment` (ya tiene tenant_id, índice y RLS).

ALTER TABLE establishment
    ADD COLUMN address TEXT NULL;

COMMENT ON COLUMN establishment.address IS 'Dirección física del local (opcional). Visible en la app pública cuando exista (CU-15).';
