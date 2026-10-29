-- Cancelar un intento no cancela su reserva ni reinterpreta expiraciones históricas.
ALTER TABLE payment DROP CONSTRAINT payment_status_check;
ALTER TABLE payment ADD CONSTRAINT payment_status_check
    CHECK (status IN ('PENDING','PENDING_MANUAL_VERIFICATION','CONFIRMED','FAILED','EXPIRED','CANCELLED','RECONCILIATION_REQUIRED'));
