-- MAP-256: límites compartidos de acceso previos al JWT.
CREATE TABLE auth_attempt_limit (
    tenant_id   TEXT        NOT NULL REFERENCES tenant(id) CHECK (tenant_id = 'platform'),
    id          TEXT        NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    attempts    INTEGER     NOT NULL CHECK (attempts > 0),
    PRIMARY KEY (tenant_id, id)
);

CREATE INDEX auth_attempt_limit_expiry_idx ON auth_attempt_limit (tenant_id, expires_at);
SELECT enable_tenant_isolation('auth_attempt_limit');

REVOKE ALL ON auth_attempt_limit FROM mapit_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_attempt_limit TO mapit_app;
