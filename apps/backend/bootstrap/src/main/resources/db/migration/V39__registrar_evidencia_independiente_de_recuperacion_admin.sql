-- La cuenta personal del aprobador recibe este rol por administración de BD;
-- mapit_app y el SUPER_ADMIN HTTP no son miembros. No se versionan contraseñas.
CREATE ROLE mapit_recovery_approver NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

CREATE TABLE admin_recovery_approval_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'platform' REFERENCES tenant(id),
    reference TEXT NOT NULL UNIQUE,
    target_tenant_id TEXT NOT NULL REFERENCES tenant(id),
    target_slug TEXT NOT NULL,
    target_user_id UUID NOT NULL,
    ticket TEXT NOT NULL,
    reason TEXT NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approver_login TEXT NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT recovery_evidence_platform_only CHECK (tenant_id = 'platform'),
    CONSTRAINT recovery_evidence_target_not_platform CHECK (target_tenant_id <> 'platform'),
    CONSTRAINT recovery_evidence_window CHECK (expires_at > valid_from),
    CONSTRAINT recovery_evidence_text CHECK (
        length(btrim(reference)) BETWEEN 1 AND 240
        AND length(btrim(ticket)) BETWEEN 1 AND 120
        AND position(ticket IN reference) > 0
        AND length(btrim(reason)) BETWEEN 1 AND 500
        AND length(btrim(approver_login)) BETWEEN 1 AND 120),
    CONSTRAINT recovery_evidence_target_fk FOREIGN KEY (target_tenant_id, target_user_id)
        REFERENCES app_user (tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX admin_recovery_approval_evidence_tenant_id_id_idx
    ON admin_recovery_approval_evidence (tenant_id, id);
SELECT enable_tenant_isolation('admin_recovery_approval_evidence');

CREATE FUNCTION guard_admin_recovery_approval_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.approver_login := session_user;
        NEW.approved_at := clock_timestamp();
        NEW.created_at := NEW.approved_at;
        IF session_user IN ('mapit_app', 'mapit') THEN
            RAISE EXCEPTION 'La aprobación requiere una identidad independiente';
        END IF;
        RETURN NEW;
    END IF;
    -- Serializa la revocación con la lectura de inicio y consumo del enlace.
    PERFORM pg_advisory_xact_lock(hashtextextended(OLD.reference, 0));
    IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
        OR (to_jsonb(NEW) - 'revoked_at') IS DISTINCT FROM (to_jsonb(OLD) - 'revoked_at') THEN
        RAISE EXCEPTION 'La aprobación es inmutable; solo puede revocarse una vez';
    END IF;
    NEW.revoked_at := clock_timestamp();
    RETURN NEW;
END;
$$;
CREATE TRIGGER admin_recovery_approval_evidence_guard
    BEFORE INSERT OR UPDATE ON admin_recovery_approval_evidence
    FOR EACH ROW EXECUTE FUNCTION guard_admin_recovery_approval_evidence();

-- V9 concedió CRUD por defecto a mapit_app: retirarlo expresamente.
REVOKE ALL ON admin_recovery_approval_evidence FROM PUBLIC, mapit_app;
GRANT SELECT ON admin_recovery_approval_evidence TO mapit_app;
GRANT USAGE ON SCHEMA public TO mapit_recovery_approver;
GRANT SELECT ON admin_recovery_approval_evidence TO mapit_recovery_approver;
GRANT INSERT (tenant_id, reference, target_tenant_id, target_slug, target_user_id,
    ticket, reason, valid_from, expires_at)
    ON admin_recovery_approval_evidence TO mapit_recovery_approver;
GRANT UPDATE (revoked_at) ON admin_recovery_approval_evidence TO mapit_recovery_approver;

-- Una evidencia documental solo inicia una autorización, incluso con dos requests concurrentes.
CREATE UNIQUE INDEX admin_recovery_document_reference_once
    ON admin_recovery_authorization (tenant_id, approval_reference)
    WHERE approval_reference IS NOT NULL;
