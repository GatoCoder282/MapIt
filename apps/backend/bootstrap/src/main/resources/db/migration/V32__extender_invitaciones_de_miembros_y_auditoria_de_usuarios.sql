-- MAP-238 / HU-1.04: ampliar CU-25 sin alterar invitaciones históricas.
ALTER TABLE invitation_tokens DROP CONSTRAINT invitation_tokens_purpose_check;
ALTER TABLE invitation_tokens ADD CONSTRAINT invitation_tokens_purpose_check
    CHECK (purpose IN ('ADMIN_ONBOARDING', 'MEMBER'));

ALTER TABLE invitation_tokens
    ADD COLUMN target_role text,
    ADD COLUMN invited_by uuid,
    ADD COLUMN revoked_at timestamptz,
    ADD COLUMN dispatch_status text,
    ADD COLUMN dispatch_attempted_at timestamptz;

ALTER TABLE invitation_tokens
    ADD CONSTRAINT invitation_tokens_target_valid CHECK (
        (purpose = 'ADMIN_ONBOARDING' AND target_role IS NULL AND invited_by IS NULL)
        OR (purpose = 'MEMBER' AND target_role IS NOT NULL
            AND target_role IN ('MANAGER', 'STAFF') AND invited_by IS NOT NULL)
    ),
    ADD CONSTRAINT invitation_tokens_member_ttl CHECK (
        purpose <> 'MEMBER' OR (expires_at > created_at AND expires_at <= created_at + interval '24 hours')
    ),
    ADD CONSTRAINT invitation_tokens_member_dispatch CHECK (
        (purpose = 'ADMIN_ONBOARDING' AND dispatch_status IS NULL AND dispatch_attempted_at IS NULL)
        OR (purpose = 'MEMBER' AND dispatch_status IS NOT NULL AND dispatch_status IN
            ('SEND_REQUESTED', 'SMTP_ACCEPTED', 'SMTP_FAILED', 'UNKNOWN'))
    ),
    ADD CONSTRAINT invitation_tokens_single_outcome CHECK (
        (consumed_at IS NULL OR revoked_at IS NULL)
        AND (consumed_at IS NULL OR user_id IS NOT NULL)
        AND (purpose <> 'MEMBER' OR (consumed_at IS NOT NULL) = (user_id IS NOT NULL))
    ),
    ADD CONSTRAINT invitation_tokens_inviter_tenant_fk
        FOREIGN KEY (tenant_id, invited_by) REFERENCES app_user (tenant_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT invitation_tokens_user_tenant_fk
        FOREIGN KEY (tenant_id, user_id) REFERENCES app_user (tenant_id, id) ON DELETE RESTRICT;

-- La FK simple de V10 es redundante tras la FK compuesta. No borra ni modifica filas.
ALTER TABLE invitation_tokens DROP CONSTRAINT invitation_tokens_user_id_fkey;

-- No incluir now() en el predicado: una invitación caducada debe revocarse
-- transaccionalmente antes de insertar el reemplazo.
CREATE UNIQUE INDEX invitation_tokens_member_pending_unique
    ON invitation_tokens (tenant_id, email, purpose)
    WHERE purpose = 'MEMBER' AND consumed_at IS NULL AND revoked_at IS NULL;
-- Una credencial consumida o revocada no puede volver a estar pendiente.
-- La rotación se hace revocando la fila e insertando otra, nunca reescribiendo el hash.
CREATE FUNCTION guard_invitation_token_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
       OR OLD.email IS DISTINCT FROM NEW.email
       OR OLD.purpose IS DISTINCT FROM NEW.purpose
       OR OLD.token_hash IS DISTINCT FROM NEW.token_hash
       OR OLD.target_role IS DISTINCT FROM NEW.target_role
       OR OLD.invited_by IS DISTINCT FROM NEW.invited_by
       OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
       OR OLD.consumed_at IS NOT NULL AND OLD.consumed_at IS DISTINCT FROM NEW.consumed_at
       OR OLD.revoked_at IS NOT NULL AND OLD.revoked_at IS DISTINCT FROM NEW.revoked_at
       OR OLD.user_id IS NOT NULL AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
        RAISE EXCEPTION 'la identidad y el resultado de la invitación son inmutables';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER invitation_tokens_guard_transition
    BEFORE UPDATE ON invitation_tokens
    FOR EACH ROW EXECUTE FUNCTION guard_invitation_token_transition();

COMMENT ON TABLE invitation_tokens IS
    'CU-25/HU-1.04: onboarding ADMIN o miembro; token hash único, revocación y consumo irreversible, RLS forzada.';
COMMENT ON COLUMN invitation_tokens.dispatch_status IS
    'Estado del último intento SMTP, no confirma entrega al buzón; NULL para onboarding histórico.';
COMMENT ON COLUMN invitation_tokens.dispatch_attempted_at IS
    'Último intento de despacho observado; NULL si no se conoce. No almacena enlaces.';

-- Se conservan las FK, RLS, índices y el trigger append-only de V20.
ALTER TABLE audit_log DROP CONSTRAINT audit_log_resource_event_match;
ALTER TABLE audit_log DROP CONSTRAINT audit_log_resource_type_valid;
ALTER TABLE audit_log DROP CONSTRAINT audit_log_event_type_valid;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_resource_type_valid CHECK (
    resource_type IN ('RESERVATION', 'SPACE_ELEMENT', 'USER_INVITATION', 'USER')
);
ALTER TABLE audit_log ADD CONSTRAINT audit_log_event_type_valid CHECK (
    event_type IN ('RESERVATION_CREATED', 'RESERVATION_STATUS_CHANGED',
        'SPACE_ELEMENT_STATE_CHANGED', 'USER_INVITATION_ISSUED',
        'USER_INVITATION_ACCEPTED', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED')
);
ALTER TABLE audit_log ADD CONSTRAINT audit_log_resource_event_match CHECK (
    (resource_type = 'RESERVATION' AND event_type IN
        ('RESERVATION_CREATED', 'RESERVATION_STATUS_CHANGED'))
    OR (resource_type = 'SPACE_ELEMENT' AND event_type = 'SPACE_ELEMENT_STATE_CHANGED')
    OR (resource_type = 'USER_INVITATION' AND event_type = 'USER_INVITATION_ISSUED')
    OR (resource_type = 'USER' AND event_type IN
        ('USER_INVITATION_ACCEPTED', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED'))
);
COMMENT ON TABLE audit_log IS
    'HU-5.03/HU-1.04. Bitácora append-only de reservas, espacios, invitaciones y usuarios; RLS forzada.';
