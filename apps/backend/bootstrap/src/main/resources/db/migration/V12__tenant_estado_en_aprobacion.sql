-- =============================================================
--  CU-03: estado PENDING_APPROVAL ("En aprobación") del tenant
--
--  Todo tenant nuevo nace en aprobación y el SUPER_ADMIN lo pasa
--  a ACTIVE. Mientras no esté ACTIVE, sus usuarios no inician
--  sesión (el login ya exige tenant.status = 'ACTIVE').
--
--  Los tenants existentes (platform, demo y los ya registrados)
--  conservan su estado: esta migración no los toca.
-- =============================================================

ALTER TABLE tenant DROP CONSTRAINT tenant_status_valid;

ALTER TABLE tenant
    ADD CONSTRAINT tenant_status_valid
    CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED'));

ALTER TABLE tenant ALTER COLUMN status SET DEFAULT 'PENDING_APPROVAL';
