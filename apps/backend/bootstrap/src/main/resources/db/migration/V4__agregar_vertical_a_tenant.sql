-- La tabla tenant ya fue creada en V1__baseline.sql.
-- Esta migración añade la vertical requerida por el registro de HU-1.01.

ALTER TABLE tenant
    ADD COLUMN vertical TEXT NOT NULL DEFAULT 'RESTAURANT';

ALTER TABLE tenant
    ADD CONSTRAINT tenant_vertical_valid
        CHECK (vertical IN ('RESTAURANT', 'NIGHTCLUB', 'EVENT_HALL', 'HOTEL'));

ALTER TABLE tenant
    ALTER COLUMN vertical DROP DEFAULT;

COMMENT ON COLUMN tenant.vertical IS
    'Vertical inicial del tenant: RESTAURANT, NIGHTCLUB, EVENT_HALL o HOTEL.';
