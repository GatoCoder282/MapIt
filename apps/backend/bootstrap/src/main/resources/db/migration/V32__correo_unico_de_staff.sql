-- MAP-256: una cuenta de Console pertenece a una única empresa.
ALTER TABLE app_user ADD CONSTRAINT app_user_email_unique UNIQUE (email);

COMMENT ON COLUMN app_user.email IS 'Correo normalizado y único en todas las empresas.';

CREATE POLICY app_user_login_by_email ON app_user
    FOR SELECT
    USING (current_tenant_id() IS NULL
        AND email = nullif(current_setting('app.login_email', true), ''));
