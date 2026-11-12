-- CA-05: token de recuperación vinculado por FK al alcance inmutable de V33.
-- Se persiste solo SHA-256; el token en claro vive únicamente en la entrega SMTP.
CREATE TABLE admin_recovery_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenant(id) CHECK (tenant_id = 'platform'),
    authorization_id UUID NOT NULL UNIQUE REFERENCES admin_recovery_authorization(id),
    token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT admin_recovery_token_window CHECK (expires_at > created_at)
);

CREATE INDEX admin_recovery_token_scope_idx ON admin_recovery_token (tenant_id, id);
SELECT enable_tenant_isolation('admin_recovery_token');
CREATE TRIGGER admin_recovery_token_touch_updated_at
    BEFORE UPDATE ON admin_recovery_token
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
REVOKE DELETE ON admin_recovery_token FROM mapit_app;
