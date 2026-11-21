-- CA-05: revocación por cuenta y evento de recuperación con actor de platform.
ALTER TABLE app_user ADD COLUMN staff_tokens_valid_after TIMESTAMPTZ;
COMMENT ON COLUMN app_user.staff_tokens_valid_after IS
    'JWT staff con iat anterior o igual a este instante no autorizan; NULL conserva el comportamiento previo.';

ALTER TABLE audit_log DROP CONSTRAINT audit_log_resource_event_match;
ALTER TABLE audit_log DROP CONSTRAINT audit_log_event_type_valid;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_event_type_valid CHECK (
    event_type IN ('RESERVATION_CREATED', 'RESERVATION_STATUS_CHANGED',
        'SPACE_ELEMENT_STATE_CHANGED', 'USER_INVITATION_ISSUED',
        'USER_INVITATION_ACCEPTED', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED',
        'USER_RECOVERED')
);
ALTER TABLE audit_log ADD CONSTRAINT audit_log_resource_event_match CHECK (
    (resource_type = 'RESERVATION' AND event_type IN
        ('RESERVATION_CREATED', 'RESERVATION_STATUS_CHANGED'))
    OR (resource_type = 'SPACE_ELEMENT' AND event_type = 'SPACE_ELEMENT_STATE_CHANGED')
    OR (resource_type = 'USER_INVITATION' AND event_type = 'USER_INVITATION_ISSUED')
    OR (resource_type = 'USER' AND event_type IN
        ('USER_INVITATION_ACCEPTED', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED',
         'USER_RECOVERED'))
);
