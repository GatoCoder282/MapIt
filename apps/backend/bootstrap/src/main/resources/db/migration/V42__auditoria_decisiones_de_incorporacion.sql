-- auditoria decisiones de incorporacion
-- Migración V42. Creada el 2026-11-21.
--
-- REGLAS (plan §12):
--   1. Toda tabla de negocio lleva  tenant_id TEXT NOT NULL REFERENCES tenant(id)
--   2. Índice compuesto (tenant_id, id)
--   3. SELECT enable_tenant_isolation('<tabla>');  ← activa RLS
--   4. NUNCA edites una migración ya mergeada: Flyway guarda su checksum
--      y el arranque fallará. Para corregir, crea una migración nueva.
--   5. Actualiza docs/db/mapit.dbml en el MISMO commit.

-- CREATE TABLE ejemplo (
--     id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
--     tenant_id  TEXT        NOT NULL REFERENCES tenant(id),
--     nombre     TEXT        NOT NULL,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );
--
-- CREATE INDEX ON ejemplo (tenant_id, id);
-- SELECT enable_tenant_isolation('ejemplo');
-- CREATE TRIGGER ejemplo_touch_updated_at
--     BEFORE UPDATE ON ejemplo
--     FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
-- MAP-265: la bitácora inmutable admite decisiones de solicitudes en platform.
ALTER TABLE audit_log DROP CONSTRAINT audit_log_resource_type_valid;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_resource_type_valid
    CHECK (resource_type IN (
        'RESERVATION', 'SPACE_ELEMENT', 'USER_INVITATION', 'USER', 'BUSINESS_APPLICATION'));

ALTER TABLE audit_log DROP CONSTRAINT audit_log_event_type_valid;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_event_type_valid
    CHECK (event_type IN ('RESERVATION_CREATED', 'RESERVATION_STATUS_CHANGED',
        'SPACE_ELEMENT_STATE_CHANGED', 'USER_INVITATION_ISSUED',
        'USER_INVITATION_ACCEPTED', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED',
        'USER_RECOVERED', 'BUSINESS_APPLICATION_APPROVED',
        'BUSINESS_APPLICATION_REJECTED'));

ALTER TABLE audit_log DROP CONSTRAINT audit_log_resource_event_match;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_resource_event_match CHECK (
    (resource_type = 'RESERVATION' AND event_type IN
        ('RESERVATION_CREATED', 'RESERVATION_STATUS_CHANGED'))
    OR (resource_type = 'SPACE_ELEMENT' AND event_type = 'SPACE_ELEMENT_STATE_CHANGED')
    OR (resource_type = 'USER_INVITATION' AND event_type = 'USER_INVITATION_ISSUED')
    OR (resource_type = 'USER' AND event_type IN
        ('USER_INVITATION_ACCEPTED', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED',
         'USER_RECOVERED'))
    OR (resource_type = 'BUSINESS_APPLICATION' AND event_type IN
        ('BUSINESS_APPLICATION_APPROVED', 'BUSINESS_APPLICATION_REJECTED'))
);
