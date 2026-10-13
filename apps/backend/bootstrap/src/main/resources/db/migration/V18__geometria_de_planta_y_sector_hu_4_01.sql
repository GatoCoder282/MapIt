-- geometria de planta y sector (HU-4.01)
-- Migración V18. Creada el 2026-10-12.
--
-- HU-4.01 (editor de plantas): la planta gana un lienzo rectangular
-- (canvas_width/canvas_height) y el sector gana colocación dentro del lienzo
-- (x, y, rotation) más dimensiones intrínsecas (width/height), origen real de
-- las coordenadas de sus elementos (antes una constante del frontend).
-- RN-4: sector.floor_id sigue NOT NULL (1:1); "colocar" NO crea copia.
-- Las tablas floor/sector ya llevan tenant_id + (tenant_id, id) + RLS: heredado.

ALTER TABLE floor
    ADD COLUMN canvas_width  DOUBLE PRECISION NOT NULL DEFAULT 1200.0,
    ADD COLUMN canvas_height DOUBLE PRECISION NOT NULL DEFAULT 800.0,
    ADD CONSTRAINT floor_canvas_positive CHECK (canvas_width > 0 AND canvas_height > 0);

ALTER TABLE sector
    ADD COLUMN x        DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    ADD COLUMN y        DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    ADD COLUMN rotation DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    ADD COLUMN width    DOUBLE PRECISION NOT NULL DEFAULT 800.0,
    ADD COLUMN height   DOUBLE PRECISION NOT NULL DEFAULT 600.0,
    ADD CONSTRAINT sector_placement_non_negative CHECK (x >= 0 AND y >= 0),
    ADD CONSTRAINT sector_dimensions_minimum     CHECK (width >= 20 AND height >= 20);

-- Sectores vivos existentes: colocación determinista en grilla (2 columnas,
-- margen 40, gap 40) para que ninguna planta existente quede visualmente vacía
-- tras la migración (plan E1; RN-10 se aplica a partir del primer guardado).
UPDATE sector s
SET x = 40.0 + mod(f.rn - 1, 2) * (s.width + 40.0),
    y = 40.0 + floor((f.rn - 1) / 2.0) * (s.height + 40.0)
FROM (
    SELECT id,
           row_number() OVER (PARTITION BY floor_id ORDER BY created_at, id) AS rn
    FROM sector
    WHERE deleted_at IS NULL
) AS f
WHERE s.id = f.id;

COMMENT ON COLUMN floor.canvas_width  IS 'HU-4.01: ancho del lienzo rectangular de la planta.';
COMMENT ON COLUMN floor.canvas_height IS 'HU-4.01: alto del lienzo rectangular de la planta.';
COMMENT ON COLUMN sector.x            IS 'HU-4.01: colocación horizontal dentro del lienzo de la planta (saveFloorLayout).';
COMMENT ON COLUMN sector.y            IS 'HU-4.01: colocación vertical dentro del lienzo de la planta (saveFloorLayout).';
COMMENT ON COLUMN sector.rotation     IS 'HU-4.01: rotación del sector en grados dentro de la planta.';
COMMENT ON COLUMN sector.width        IS 'HU-4.01: dimensión intrínseca; origen de coordenadas de sus elementos (saveSectorLayout).';
COMMENT ON COLUMN sector.height       IS 'HU-4.01: dimensión intrínseca; origen de coordenadas de sus elementos (saveSectorLayout).';
