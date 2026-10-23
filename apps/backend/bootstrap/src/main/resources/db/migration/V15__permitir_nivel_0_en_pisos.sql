-- permitir nivel 0 en pisos
-- Migración V15. Creada el 2026-10-01.
--
-- El nivel de un piso pasa a ser escalonado desde 0 (planta baja): relaja el
-- CHECK de V6 de `1..999` a `0..999`. No toca datos ni índices: un UPDATE no
-- hace falta porque los niveles existentes (>= 1) ya cumplen el nuevo rango.

ALTER TABLE floor
    DROP CONSTRAINT floor_level_check,
    ADD CONSTRAINT floor_level_check CHECK (level BETWEEN 0 AND 999);

COMMENT ON COLUMN floor.level IS 'Nivel vertical de la planta, escalonado desde 0 (0 a 999).';
