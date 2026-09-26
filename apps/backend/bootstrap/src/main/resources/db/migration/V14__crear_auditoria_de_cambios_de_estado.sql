-- MAP-125 / HU-3.01: trazabilidad inmutable de cada cambio de estado operativo.
CREATE TABLE space_element_state_change (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         TEXT        NOT NULL REFERENCES tenant(id),
    sector_id         UUID        NOT NULL REFERENCES sector(id) ON DELETE RESTRICT,
    space_element_id  UUID        NOT NULL REFERENCES space_element(id) ON DELETE RESTRICT,
    previous_state    TEXT        NOT NULL,
    new_state         TEXT        NOT NULL,
    changed_by        UUID        NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
    changed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT space_element_state_change_previous_valid CHECK (
        previous_state IN ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'OUT_OF_SERVICE')
    ),
    CONSTRAINT space_element_state_change_new_valid CHECK (
        new_state IN ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'OUT_OF_SERVICE')
    ),
    CONSTRAINT space_element_state_change_distinct CHECK (previous_state <> new_state)
);

CREATE INDEX space_element_state_change_tenant_id_id_idx
    ON space_element_state_change (tenant_id, id);

CREATE INDEX space_element_state_change_history_idx
    ON space_element_state_change (tenant_id, space_element_id, changed_at DESC, id DESC);

SELECT enable_tenant_isolation('space_element_state_change');

COMMENT ON TABLE space_element_state_change IS
    'Auditoría inmutable de cambios de estado de SpaceElement (MAP-125 / HU-3.01).';
COMMENT ON COLUMN space_element_state_change.changed_by IS
    'Usuario autenticado que realizó el cambio; nunca se acepta desde el cliente.';
