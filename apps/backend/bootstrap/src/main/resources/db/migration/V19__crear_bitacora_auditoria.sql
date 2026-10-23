-- V19 / MAP-222 / HU-5.03: bitácora transversal, inmutable y aislada por tenant.
CREATE TABLE audit_log (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     TEXT        NOT NULL REFERENCES tenant(id),
    actor_id      UUID        NOT NULL,
    occurred_at   TIMESTAMPTZ NOT NULL,
    resource_type TEXT        NOT NULL,
    resource_id   UUID        NOT NULL,
    event_type    TEXT        NOT NULL,
    details       JSONB       NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT audit_log_resource_type_valid CHECK (
        resource_type IN ('RESERVATION', 'SPACE_ELEMENT')
    ),
    CONSTRAINT audit_log_event_type_valid CHECK (
        event_type IN (
            'RESERVATION_CREATED',
            'RESERVATION_STATUS_CHANGED',
            'SPACE_ELEMENT_STATE_CHANGED'
        )
    ),
    CONSTRAINT audit_log_resource_event_match CHECK (
        (resource_type = 'RESERVATION'
            AND event_type IN ('RESERVATION_CREATED', 'RESERVATION_STATUS_CHANGED'))
        OR
        (resource_type = 'SPACE_ELEMENT'
            AND event_type = 'SPACE_ELEMENT_STATE_CHANGED')
    ),
    CONSTRAINT audit_log_details_object CHECK (jsonb_typeof(details) = 'object')
);

-- Permite que la identidad del actor se compruebe también contra su tenant.
CREATE UNIQUE INDEX IF NOT EXISTS app_user_tenant_id_id_unique
    ON app_user (tenant_id, id);

ALTER TABLE audit_log
    ADD CONSTRAINT audit_log_actor_tenant_fk
    FOREIGN KEY (tenant_id, actor_id)
    REFERENCES app_user (tenant_id, id)
    ON DELETE RESTRICT;

CREATE INDEX audit_log_tenant_id_id_idx
    ON audit_log (tenant_id, id);

CREATE INDEX audit_log_history_idx
    ON audit_log (tenant_id, occurred_at DESC, id DESC);

CREATE INDEX audit_log_resource_history_idx
    ON audit_log (tenant_id, resource_type, resource_id, occurred_at DESC, id DESC);

CREATE INDEX audit_log_event_history_idx
    ON audit_log (tenant_id, event_type, occurred_at DESC, id DESC);

SELECT enable_tenant_isolation('audit_log');

-- Preserva la historia de HU-3.01. La tabla anterior se retirará en MAP-223,
-- después de cambiar su escritor para que ninguna versión intermedia quede rota.
INSERT INTO audit_log (
    id, tenant_id, actor_id, occurred_at, resource_type, resource_id, event_type, details
)
SELECT
    id,
    tenant_id,
    changed_by,
    changed_at,
    'SPACE_ELEMENT',
    space_element_id,
    'SPACE_ELEMENT_STATE_CHANGED',
    jsonb_build_object(
        'previousState', previous_state,
        'newState', new_state,
        'sectorId', sector_id::text
    )
FROM space_element_state_change
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION reject_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_log es append-only: UPDATE y DELETE no están permitidos';
END;
$$;

CREATE TRIGGER audit_log_reject_update_delete
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();

-- V9 concede CRUD por defecto a tablas futuras. Esta bitácora necesita solo append + lectura.
REVOKE UPDATE, DELETE ON audit_log FROM mapit_app;

COMMENT ON TABLE audit_log IS
    'HU-5.03. Bitácora append-only de eventos de Reservation y SpaceElement, con RLS forzada.';
COMMENT ON COLUMN audit_log.actor_id IS
    'Usuario autenticado del mismo tenant; nunca se acepta desde el cliente.';
COMMENT ON COLUMN audit_log.details IS
    'Datos mínimos permitidos por tipo de evento; nunca secretos ni cuerpos HTTP completos.';
