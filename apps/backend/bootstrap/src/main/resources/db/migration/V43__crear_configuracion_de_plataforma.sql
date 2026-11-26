-- HU-7.07 (MAP-300): parámetros globales editables por el Super Admin.
--
-- `platform_setting` es GLOBAL, como `tenant`: no guarda datos de negocio ni de una empresa, y
-- el historial de clientes la lee dentro de la transacción de un tenant, donde una política RLS
-- devolvería 0 filas sin avisar. La allowlist y los rangos se repiten aquí como CHECK.
CREATE TABLE platform_setting (
    setting_key TEXT        PRIMARY KEY,
    int_value   INTEGER     NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID        NOT NULL,
    CONSTRAINT platform_setting_allowed CHECK (
        (setting_key = 'customer-history.link-ttl-minutes' AND int_value BETWEEN 5 AND 60)
        OR (setting_key = 'customer-history.session-ttl-minutes' AND int_value BETWEEN 10 AND 120))
);

-- La bitácora inmutable admite los cambios de configuración en el tenant `platform`.
ALTER TABLE audit_log DROP CONSTRAINT audit_log_resource_type_valid;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_resource_type_valid
    CHECK (resource_type IN (
        'RESERVATION', 'SPACE_ELEMENT', 'USER_INVITATION', 'USER', 'BUSINESS_APPLICATION',
        'PLATFORM_SETTING'));

ALTER TABLE audit_log DROP CONSTRAINT audit_log_event_type_valid;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_event_type_valid
    CHECK (event_type IN ('RESERVATION_CREATED', 'RESERVATION_STATUS_CHANGED',
        'SPACE_ELEMENT_STATE_CHANGED', 'USER_INVITATION_ISSUED',
        'USER_INVITATION_ACCEPTED', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED',
        'USER_RECOVERED', 'BUSINESS_APPLICATION_APPROVED',
        'BUSINESS_APPLICATION_REJECTED', 'PLATFORM_SETTING_CHANGED'));

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
    OR (resource_type = 'PLATFORM_SETTING' AND event_type = 'PLATFORM_SETTING_CHANGED')
);
