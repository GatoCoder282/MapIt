-- MAP-287: campos opcionales del perfil propio. Rollback: desactivar la funcionalidad;
-- conservar columnas/datos y las políticas RLS existentes de app_user.
ALTER TABLE app_user
    ADD COLUMN contact_phone VARCHAR(32),
    ADD COLUMN preferred_language VARCHAR(5),
    ADD CONSTRAINT app_user_contact_phone_valid CHECK (
        contact_phone IS NULL OR (
            char_length(contact_phone) BETWEEN 1 AND 32
            AND contact_phone ~ '^[+0-9() ./-]*[0-9][+0-9() ./-]*$'
        )
    ),
    ADD CONSTRAINT app_user_preferred_language_valid CHECK (
        preferred_language IS NULL OR preferred_language IN ('es', 'en', 'ja-JP')
    );

COMMENT ON COLUMN app_user.contact_phone IS
    'Contacto informativo opcional; no es identidad verificada ni mecanismo de recuperación.';
COMMENT ON COLUMN app_user.preferred_language IS
    'Preferencia opcional de cuenta: es, en o ja-JP. NULL conserva el fallback local.';
