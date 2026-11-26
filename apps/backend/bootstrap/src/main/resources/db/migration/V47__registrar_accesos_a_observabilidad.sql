-- HU-7.08 (MAP-309): registro de quién consultó los agregados de la plataforma.
--
-- Es append-only para el rol de runtime: solo SELECT e INSERT. Vive en el tenant técnico
-- `platform`, con RLS, y no guarda el contenido consultado.
CREATE TABLE platform_access_log (
    id                UUID        NOT NULL DEFAULT gen_random_uuid(),
    tenant_id         TEXT        NOT NULL REFERENCES tenant(id) CHECK (tenant_id = 'platform'),
    actor_id          UUID        NOT NULL,
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    view              TEXT        NOT NULL CHECK (view IN ('OVERVIEW', 'TENANT_LIST', 'TENANT_DETAIL')),
    subject_tenant_id TEXT        REFERENCES tenant(id),
    PRIMARY KEY (tenant_id, id)
);

CREATE INDEX platform_access_log_history_idx ON platform_access_log (tenant_id, occurred_at);
SELECT enable_tenant_isolation('platform_access_log');

REVOKE ALL ON platform_access_log FROM mapit_app;
GRANT SELECT, INSERT ON platform_access_log TO mapit_app;
