-- HU-6.02: una reserva creada desde el portal público no tiene actor de staff.
-- El flujo interno sigue exigiendo un usuario autenticado en la capa de aplicación.
ALTER TABLE reservation
    ALTER COLUMN created_by DROP NOT NULL;

COMMENT ON COLUMN reservation.created_by IS
    'Actor de staff que creó la reserva; NULL cuando proviene del portal público anónimo (HU-6.02).';
