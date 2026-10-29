-- HU-6.04: secretos de enlace y lectura almacenados exclusivamente como SHA-256.
CREATE TABLE customer_history_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenant(id),
    person_id UUID NOT NULL,
    link_hash TEXT NOT NULL,
    link_expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    session_hash TEXT,
    session_expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT customer_history_access_person_tenant_fk
        FOREIGN KEY (tenant_id, person_id) REFERENCES person (tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT customer_history_access_session_requires_consumption
        CHECK (session_hash IS NULL OR (consumed_at IS NOT NULL AND session_expires_at IS NOT NULL))
);

CREATE INDEX customer_history_access_tenant_id_id_idx ON customer_history_access (tenant_id, id);
CREATE UNIQUE INDEX customer_history_access_link_hash_idx ON customer_history_access (tenant_id, link_hash);
CREATE UNIQUE INDEX customer_history_access_session_hash_idx ON customer_history_access (tenant_id, session_hash)
    WHERE session_hash IS NOT NULL;
CREATE INDEX customer_history_access_cooldown_idx
    ON customer_history_access (tenant_id, person_id, created_at DESC);
SELECT enable_tenant_isolation('customer_history_access');
