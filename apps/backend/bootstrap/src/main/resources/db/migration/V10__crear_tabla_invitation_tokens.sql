-- =============================================================
--  CU-25 / MAP-182: invitaciones del primer ADMIN por tenant.
--
--  Registro de tenant → invitación con token opaco de un solo uso,
--  caducidad de 24 h y email del administrador. Jamás una contraseña
--  temporal, jamás un JWT: solo el hash SHA-256 del token.
--
--  Reglas:
--   - tenant_id NOT NULL + índice (tenant_id, id) + RLS forzada
--     (convención global de tablas de negocio).
--   - token_hash único: el lookup por hash es el único camino.
--   - email NO es único global: un mismo correo puede administrar
--     varios tenants (regla del contrato y del negocio).
--   - user_id queda al consumirse: traza de quién activó.
-- =============================================================

CREATE TABLE invitation_tokens (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    TEXT        NOT NULL REFERENCES tenant(id),
    email        TEXT        NOT NULL,
    purpose      TEXT        NOT NULL DEFAULT 'ADMIN_ONBOARDING'
                 CHECK (purpose = 'ADMIN_ONBOARDING'),
    token_hash   TEXT        NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    -- NULL mientras esté pendiente; se informa al consumirse (un solo uso).
    consumed_at  TIMESTAMPTZ,
    user_id      UUID        REFERENCES app_user(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT invitation_email_normalized CHECK (
        email = lower(btrim(email)) AND length(email) BETWEEN 1 AND 254
    )
);

COMMENT ON TABLE  invitation_tokens IS 'CU-25: invitación del primer ADMIN por tenant. Solo hash del token, un solo uso, expira en 24 h.';
COMMENT ON COLUMN invitation_tokens.token_hash IS 'SHA-256 del token del enlace. El token en claro viaja solo por email/URL.';
COMMENT ON COLUMN invitation_tokens.user_id IS 'app_user ADMIN creado al activar; NULL mientras la invitación esté pendiente.';

CREATE UNIQUE INDEX invitation_tokens_token_hash_unique ON invitation_tokens (token_hash);
CREATE INDEX invitation_tokens_tenant_id_idx ON invitation_tokens (tenant_id, id);

SELECT enable_tenant_isolation('invitation_tokens');

CREATE TRIGGER invitation_tokens_touch_updated_at
    BEFORE UPDATE ON invitation_tokens
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
