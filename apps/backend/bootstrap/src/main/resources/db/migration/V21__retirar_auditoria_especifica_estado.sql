-- V21 / MAP-223 / HU-5.03: audit_log pasa a ser la única fuente de auditoría operativa.

-- Preserva cualquier cambio escrito por una versión anterior de la aplicación
-- después de aplicar V20 y antes de desplegar MAP-223.
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

DROP TABLE space_element_state_change;
