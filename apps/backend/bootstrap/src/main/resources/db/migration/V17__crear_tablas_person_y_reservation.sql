-- MAP-209 / HU-5.01: persistencia multi-tenant de clientes y reservas internas.
-- Migración V15. Creada el 2026-10-03.

-- Las claves compuestas permiten que las FK incluyan tenant_id. El id ya es globalmente
-- único por su PK; estas restricciones añaden la garantía estructural de que ninguna
-- asociación pueda cruzar tenants.
DROP INDEX app_user_tenant_id_idx;
DROP INDEX establishment_tenant_id_id_idx;
DROP INDEX space_element_tenant_id_id_idx;

ALTER TABLE app_user
    ADD CONSTRAINT app_user_tenant_id_id_unique UNIQUE (tenant_id, id);

ALTER TABLE establishment
    ADD CONSTRAINT establishment_tenant_id_id_unique UNIQUE (tenant_id, id);

ALTER TABLE space_element
    ADD CONSTRAINT space_element_tenant_id_id_unique UNIQUE (tenant_id, id);

CREATE TABLE person (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT         NOT NULL REFERENCES tenant(id),
    full_name   VARCHAR(120) NOT NULL,
    email       VARCHAR(254),
    phone       VARCHAR(32),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  UUID,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by  UUID,
    deleted_at  TIMESTAMPTZ,
    deleted_by  UUID,

    CONSTRAINT person_tenant_id_id_unique UNIQUE (tenant_id, id),
    CONSTRAINT person_name_not_blank CHECK (length(btrim(full_name)) > 0),
    CONSTRAINT person_email_normalized CHECK (
        email IS NULL OR (
            email = lower(btrim(email))
            AND length(email) BETWEEN 3 AND 254
        )
    ),
    CONSTRAINT person_phone_not_blank CHECK (phone IS NULL OR length(btrim(phone)) > 0),
    CONSTRAINT person_created_by_tenant_fk
        FOREIGN KEY (tenant_id, created_by)
        REFERENCES app_user (tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT person_updated_by_tenant_fk
        FOREIGN KEY (tenant_id, updated_by)
        REFERENCES app_user (tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT person_deleted_by_tenant_fk
        FOREIGN KEY (tenant_id, deleted_by)
        REFERENCES app_user (tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT person_deleted_by_requires_deleted_at
        CHECK (deleted_by IS NULL OR deleted_at IS NOT NULL)
);

CREATE UNIQUE INDEX person_tenant_email_live_uidx
    ON person (tenant_id, email)
    WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX person_tenant_name_live_idx
    ON person (tenant_id, lower(full_name), id)
    WHERE deleted_at IS NULL;

CREATE TRIGGER person_touch_updated_at
    BEFORE UPDATE ON person
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

SELECT enable_tenant_isolation('person');

COMMENT ON TABLE person IS
    'Clientes de cada tenant usados por reservas internas y públicas (CU-11 / MAP-210).';
COMMENT ON COLUMN person.email IS
    'Correo normalizado en minúsculas; único por tenant entre personas activas cuando existe.';

CREATE TABLE reservation (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         TEXT        NOT NULL REFERENCES tenant(id),
    establishment_id  UUID        NOT NULL,
    person_id         UUID        NOT NULL,
    starts_at         TIMESTAMPTZ NOT NULL,
    ends_at           TIMESTAMPTZ NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'CREATED',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID        NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by        UUID,

    CONSTRAINT reservation_tenant_id_id_unique UNIQUE (tenant_id, id),
    CONSTRAINT reservation_valid_interval CHECK (starts_at < ends_at),
    CONSTRAINT reservation_status_valid CHECK (
        status IN ('CREATED', 'CONFIRMED', 'ACTIVE', 'RELEASED', 'CANCELLED')
    ),
    CONSTRAINT reservation_establishment_tenant_fk
        FOREIGN KEY (tenant_id, establishment_id)
        REFERENCES establishment (tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT reservation_person_tenant_fk
        FOREIGN KEY (tenant_id, person_id)
        REFERENCES person (tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT reservation_created_by_tenant_fk
        FOREIGN KEY (tenant_id, created_by)
        REFERENCES app_user (tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT reservation_updated_by_tenant_fk
        FOREIGN KEY (tenant_id, updated_by)
        REFERENCES app_user (tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX reservation_tenant_establishment_starts_idx
    ON reservation (tenant_id, establishment_id, starts_at, id);

CREATE INDEX reservation_tenant_person_starts_idx
    ON reservation (tenant_id, person_id, starts_at DESC, id);

CREATE TRIGGER reservation_touch_updated_at
    BEFORE UPDATE ON reservation
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

SELECT enable_tenant_isolation('reservation');

COMMENT ON TABLE reservation IS
    'Reservas de uno o más elementos para una persona (CU-12 / HU-5.01).';
COMMENT ON COLUMN reservation.starts_at IS
    'Inicio inclusivo del intervalo semiabierto [starts_at, ends_at).';
COMMENT ON COLUMN reservation.ends_at IS
    'Fin exclusivo del intervalo semiabierto [starts_at, ends_at).';

CREATE TABLE reservation_space_element (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         TEXT NOT NULL REFERENCES tenant(id),
    reservation_id    UUID NOT NULL,
    space_element_id  UUID NOT NULL,

    CONSTRAINT reservation_space_element_tenant_id_id_unique UNIQUE (tenant_id, id),
    CONSTRAINT reservation_space_element_pair_unique
        UNIQUE (tenant_id, reservation_id, space_element_id),
    CONSTRAINT reservation_space_element_reservation_tenant_fk
        FOREIGN KEY (tenant_id, reservation_id)
        REFERENCES reservation (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT reservation_space_element_element_tenant_fk
        FOREIGN KEY (tenant_id, space_element_id)
        REFERENCES space_element (tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX reservation_space_element_resource_idx
    ON reservation_space_element (tenant_id, space_element_id, reservation_id);

SELECT enable_tenant_isolation('reservation_space_element');

COMMENT ON TABLE reservation_space_element IS
    'Asociación multi-tenant entre una reserva y sus elementos espaciales (MAP-209).';
