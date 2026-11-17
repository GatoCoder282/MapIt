-- CA-05 etapa 1. Solicitudes de plataforma; ningún rescate se ejecuta en esta versión.
CREATE TABLE admin_recovery_authorization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'platform' REFERENCES tenant(id),
    target_tenant_id TEXT NOT NULL REFERENCES tenant(id),
    target_slug TEXT NOT NULL,
    target_user_id UUID NOT NULL,
    operator_id UUID NOT NULL,
    approver_id UUID,
    ticket TEXT NOT NULL,
    reason TEXT NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    approved_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT admin_recovery_platform_only CHECK (tenant_id = 'platform'),
    CONSTRAINT admin_recovery_target_not_platform CHECK (target_tenant_id <> 'platform'),
    CONSTRAINT admin_recovery_distinct_people CHECK (approver_id IS NULL OR approver_id <> operator_id),
    CONSTRAINT admin_recovery_window CHECK (expires_at > valid_from),
    CONSTRAINT admin_recovery_text CHECK (length(btrim(ticket)) BETWEEN 1 AND 120 AND length(btrim(reason)) BETWEEN 1 AND 500),
    CONSTRAINT admin_recovery_status CHECK (status IN ('PENDING', 'APPROVED', 'REVOKED', 'CONSUMED')),
    CONSTRAINT admin_recovery_state CHECK (
        (status = 'PENDING' AND approver_id IS NULL AND approved_at IS NULL AND revoked_at IS NULL AND consumed_at IS NULL)
        OR (status = 'APPROVED' AND approver_id IS NOT NULL AND approved_at IS NOT NULL AND revoked_at IS NULL AND consumed_at IS NULL)
        OR (status = 'REVOKED' AND consumed_at IS NULL AND revoked_at IS NOT NULL)
        OR (status = 'CONSUMED' AND approver_id IS NOT NULL AND approved_at IS NOT NULL AND consumed_at IS NOT NULL AND revoked_at IS NULL)
    ),
    CONSTRAINT admin_recovery_target_fk FOREIGN KEY (target_tenant_id, target_user_id)
        REFERENCES app_user (tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT admin_recovery_operator_fk FOREIGN KEY (tenant_id, operator_id)
        REFERENCES app_user (tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT admin_recovery_approver_fk FOREIGN KEY (tenant_id, approver_id)
        REFERENCES app_user (tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX admin_recovery_authorization_tenant_id_id_idx ON admin_recovery_authorization (tenant_id, id);
CREATE INDEX admin_recovery_authorization_target_idx ON admin_recovery_authorization (target_tenant_id, target_user_id, status);
SELECT enable_tenant_isolation('admin_recovery_authorization');

-- Alcance y firmantes inmutables; una solicitud cerrada no se reutiliza.
CREATE FUNCTION guard_admin_recovery_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.id, NEW.tenant_id, NEW.target_tenant_id, NEW.target_slug, NEW.target_user_id,
        NEW.operator_id, NEW.ticket, NEW.reason, NEW.valid_from, NEW.expires_at)
        IS DISTINCT FROM
        (OLD.id, OLD.tenant_id, OLD.target_tenant_id, OLD.target_slug, OLD.target_user_id,
        OLD.operator_id, OLD.ticket, OLD.reason, OLD.valid_from, OLD.expires_at) THEN
        RAISE EXCEPTION 'El alcance de recuperación es inmutable';
    END IF;
    IF OLD.status = 'REVOKED' OR OLD.status = 'CONSUMED' THEN
        RAISE EXCEPTION 'La autorización está cerrada';
    END IF;
    IF OLD.status = 'PENDING' AND NEW.status NOT IN ('APPROVED', 'REVOKED') THEN
        RAISE EXCEPTION 'Transición de autorización inválida';
    END IF;
    IF OLD.status = 'APPROVED' AND NEW.status NOT IN ('CONSUMED', 'REVOKED') THEN
        RAISE EXCEPTION 'Transición de autorización inválida';
    END IF;
    IF OLD.status = 'APPROVED' AND
        (NEW.approver_id, NEW.approved_at) IS DISTINCT FROM (OLD.approver_id, OLD.approved_at) THEN
        RAISE EXCEPTION 'La aprobación es inmutable';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER admin_recovery_authorization_guard
    BEFORE UPDATE ON admin_recovery_authorization
    FOR EACH ROW EXECUTE FUNCTION guard_admin_recovery_authorization();
REVOKE DELETE ON admin_recovery_authorization FROM mapit_app;
