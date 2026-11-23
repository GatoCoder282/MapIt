-- MAP-261 / HU-1.05: solicitudes públicas previas al alta de un tenant.
-- Todas viven en el tenant técnico platform; la solicitud nunca crea acceso.
CREATE TABLE business_application (
    id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               TEXT         NOT NULL REFERENCES tenant(id) CHECK (tenant_id = 'platform'),
    business_name           VARCHAR(120) NOT NULL,
    vertical                TEXT         NOT NULL,
    location                VARCHAR(200) NOT NULL,
    contact_name            VARCHAR(120) NOT NULL,
    contact_email           VARCHAR(254) NOT NULL,
    contact_phone           VARCHAR(32),
    status                  TEXT         NOT NULL DEFAULT 'PENDING',
    verification_token_hash TEXT,
    verification_expires_at TIMESTAMPTZ,
    contact_verified_at     TIMESTAMPTZ,
    decided_by              UUID,
    decided_at              TIMESTAMPTZ,
    rejection_reason        VARCHAR(500),
    approved_tenant_id      TEXT         REFERENCES tenant(id),
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT business_application_name_valid CHECK (length(btrim(business_name)) BETWEEN 2 AND 120),
    CONSTRAINT business_application_location_valid CHECK (length(btrim(location)) BETWEEN 2 AND 200),
    CONSTRAINT business_application_contact_valid CHECK (length(btrim(contact_name)) BETWEEN 2 AND 120),
    CONSTRAINT business_application_email_valid CHECK (
        contact_email = lower(btrim(contact_email))
        AND length(contact_email) BETWEEN 3 AND 254
        AND contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
    CONSTRAINT business_application_phone_valid CHECK (
        contact_phone IS NULL OR length(btrim(contact_phone)) BETWEEN 6 AND 32
    ),
    CONSTRAINT business_application_vertical_valid CHECK (
        vertical IN ('RESTAURANT', 'NIGHTCLUB', 'EVENT_HALL', 'HOTEL')
    ),
    CONSTRAINT business_application_status_valid CHECK (
        status IN ('PENDING', 'APPROVED', 'REJECTED')
    ),
    CONSTRAINT business_application_verification_pair CHECK (
        (verification_token_hash IS NULL) = (verification_expires_at IS NULL)
        AND (verification_token_hash IS NULL OR verification_token_hash ~ '^[0-9a-f]{64}$')
        AND (verification_expires_at IS NULL OR verification_expires_at > created_at)
        AND (contact_verified_at IS NULL OR contact_verified_at >= created_at)
        AND (contact_verified_at IS NULL OR verification_token_hash IS NULL)
        AND (status <> 'PENDING' OR contact_verified_at IS NOT NULL OR verification_token_hash IS NOT NULL)
        AND (status = 'PENDING' OR verification_token_hash IS NULL)
    ),
    CONSTRAINT business_application_decision_valid CHECK (
        (status = 'PENDING'
            AND decided_by IS NULL AND decided_at IS NULL
            AND rejection_reason IS NULL AND approved_tenant_id IS NULL)
        OR (status = 'APPROVED'
            AND contact_verified_at IS NOT NULL
            AND decided_by IS NOT NULL AND decided_at IS NOT NULL
            AND rejection_reason IS NULL AND approved_tenant_id IS NOT NULL
            AND approved_tenant_id <> 'platform')
        OR (status = 'REJECTED'
            AND decided_by IS NOT NULL AND decided_at IS NOT NULL
            AND rejection_reason IS NOT NULL
            AND length(btrim(rejection_reason)) BETWEEN 1 AND 500
            AND approved_tenant_id IS NULL)
    ),
    CONSTRAINT business_application_decision_time_valid CHECK (
        decided_at IS NULL OR decided_at >= created_at
    ),
    CONSTRAINT business_application_actor_fk FOREIGN KEY (tenant_id, decided_by)
        REFERENCES app_user (tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX business_application_tenant_id_id_idx
    ON business_application (tenant_id, id);
CREATE INDEX business_application_inbox_idx
    ON business_application (tenant_id, status, created_at DESC, id DESC);
CREATE UNIQUE INDEX business_application_pending_contact_name_uidx
    ON business_application (tenant_id, lower(contact_email), lower(btrim(business_name)))
    WHERE status = 'PENDING';
CREATE UNIQUE INDEX business_application_verification_hash_uidx
    ON business_application (verification_token_hash)
    WHERE verification_token_hash IS NOT NULL;

SELECT enable_tenant_isolation('business_application');
CREATE TRIGGER business_application_touch_updated_at
    BEFORE UPDATE ON business_application
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMENT ON TABLE business_application IS
    'HU-1.05: solicitud previa al tenant, aislada bajo platform y revisada por SUPER_ADMIN.';
COMMENT ON COLUMN business_application.verification_token_hash IS
    'Solo SHA-256 del token de verificación; el token en claro nunca se persiste.';
