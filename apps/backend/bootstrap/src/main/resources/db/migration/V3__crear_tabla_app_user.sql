-- MAP-46: credenciales de staff, aisladas por empresa. Sin usuarios predeterminados.
CREATE TABLE app_user (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     TEXT        NOT NULL REFERENCES tenant(id),
    email         TEXT        NOT NULL,
    password_hash TEXT        NOT NULL,
    full_name     TEXT        NOT NULL,
    role          TEXT        NOT NULL,
    active        BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT app_user_email_normalized CHECK (
        email = lower(btrim(email)) AND length(email) BETWEEN 1 AND 254
    ),
    CONSTRAINT app_user_role_valid CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF')),
    CONSTRAINT app_user_tenant_email_unique UNIQUE (tenant_id, email)
);

CREATE INDEX app_user_tenant_id_idx ON app_user (tenant_id, id);
SELECT enable_tenant_isolation('app_user');

COMMENT ON TABLE app_user IS 'Staff de cada empresa. MAP-46 / CU-23. RLS forzada por tenant.';
COMMENT ON COLUMN app_user.password_hash IS 'Hash BCrypt; nunca almacenar contraseñas en texto plano.';
COMMENT ON COLUMN app_user.email IS 'Correo en minúsculas y sin espacios externos; único por tenant.';
