-- Notas privadas del personal; conserva las reservas existentes y su aislamiento RLS.
ALTER TABLE reservation ADD COLUMN notes VARCHAR(1000);
