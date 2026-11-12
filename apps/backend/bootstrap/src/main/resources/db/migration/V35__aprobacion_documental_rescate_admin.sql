-- CA-05: V33 admite una referencia documental verificada manualmente por plataforma.
-- Las aprobaciones existentes con approver_id conservan su significado y sus FK.
ALTER TABLE admin_recovery_authorization
    ADD COLUMN approval_reference TEXT,
    ADD COLUMN approval_responsible TEXT;

ALTER TABLE admin_recovery_authorization DROP CONSTRAINT admin_recovery_state;
ALTER TABLE admin_recovery_authorization ADD CONSTRAINT admin_recovery_state CHECK (
    (status = 'PENDING' AND approver_id IS NULL AND approved_at IS NULL
        AND approval_reference IS NULL AND approval_responsible IS NULL
        AND revoked_at IS NULL AND consumed_at IS NULL)
    OR (status = 'APPROVED' AND approved_at IS NOT NULL
        AND revoked_at IS NULL AND consumed_at IS NULL
        AND ((approver_id IS NOT NULL AND approval_reference IS NULL AND approval_responsible IS NULL)
          OR (approver_id IS NULL AND approval_reference IS NOT NULL
              AND approval_responsible IS NOT NULL
              AND length(btrim(approval_reference)) BETWEEN 1 AND 240
              AND length(btrim(approval_responsible)) BETWEEN 1 AND 120)))
    OR (status = 'REVOKED' AND consumed_at IS NULL AND revoked_at IS NOT NULL)
    OR (status = 'CONSUMED' AND approved_at IS NOT NULL AND consumed_at IS NOT NULL
        AND revoked_at IS NULL
        AND ((approver_id IS NOT NULL AND approval_reference IS NULL AND approval_responsible IS NULL)
          OR (approver_id IS NULL AND approval_reference IS NOT NULL
              AND approval_responsible IS NOT NULL
              AND length(btrim(approval_reference)) BETWEEN 1 AND 240
              AND length(btrim(approval_responsible)) BETWEEN 1 AND 120)))
);

-- V33 ya protege el alcance. También se inmoviliza la evidencia al aprobar.
CREATE OR REPLACE FUNCTION guard_admin_recovery_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.id, NEW.tenant_id, NEW.target_tenant_id, NEW.target_slug, NEW.target_user_id,
        NEW.operator_id, NEW.ticket, NEW.reason, NEW.valid_from, NEW.expires_at)
        IS DISTINCT FROM
        (OLD.id, OLD.tenant_id, OLD.target_tenant_id, OLD.target_slug, OLD.target_user_id,
        OLD.operator_id, OLD.ticket, OLD.reason, OLD.valid_from, OLD.expires_at) THEN
        RAISE EXCEPTION 'El alcance de recuperación es inmutable';
    END IF;
    IF OLD.status IN ('REVOKED', 'CONSUMED') THEN
        RAISE EXCEPTION 'La autorización está cerrada';
    END IF;
    IF OLD.status = 'PENDING' AND NEW.status NOT IN ('APPROVED', 'REVOKED') THEN
        RAISE EXCEPTION 'Transición de autorización inválida';
    END IF;
    IF OLD.status = 'APPROVED' AND NEW.status NOT IN ('CONSUMED', 'REVOKED') THEN
        RAISE EXCEPTION 'Transición de autorización inválida';
    END IF;
    IF OLD.status = 'APPROVED' AND
        (NEW.approver_id, NEW.approved_at, NEW.approval_reference, NEW.approval_responsible)
        IS DISTINCT FROM
        (OLD.approver_id, OLD.approved_at, OLD.approval_reference, OLD.approval_responsible) THEN
        RAISE EXCEPTION 'La aprobación es inmutable';
    END IF;
    RETURN NEW;
END;
$$;
