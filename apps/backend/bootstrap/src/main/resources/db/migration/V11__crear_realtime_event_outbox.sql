-- =============================================================
-- MAP-103 / HUT-01: outbox durable para eventos STOMP.
--
-- El evento se inserta dentro de la transacción que cambia el estado de negocio.
-- El dispatcher lo publica después y marca published_at. Si el proceso cae entre
-- ambas operaciones, el mismo event_id se puede entregar otra vez: la semántica
-- pública es at-least-once y los consumidores deduplican por eventId.
-- =============================================================

CREATE TABLE realtime_event_outbox (
    event_id          UUID        PRIMARY KEY,
    tenant_id         TEXT        NOT NULL REFERENCES tenant(id),
    event_type        TEXT        NOT NULL,
    schema_version    INTEGER     NOT NULL CHECK (schema_version > 0),
    occurred_at       TIMESTAMPTZ NOT NULL,
    establishment_id  UUID        NOT NULL,
    sector_id         UUID,
    aggregate_version BIGINT      NOT NULL CHECK (aggregate_version > 0),
    payload           JSONB       NOT NULL,
    attempts          INTEGER     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    available_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at        TIMESTAMPTZ,
    last_error        TEXT,
    published_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE realtime_event_outbox IS
    'MAP-103/HUT-01: eventos de tiempo real pendientes o publicados; RLS por tenant.';
COMMENT ON COLUMN realtime_event_outbox.payload IS
    'Envelope STOMP sin tenant_id; el tenant se conserva en la columna aislada.';
COMMENT ON COLUMN realtime_event_outbox.published_at IS
    'NULL mientras no se haya entregado al broker; no se borra al publicar para permitir retención y replay futuro.';

CREATE INDEX realtime_event_outbox_tenant_id_id_idx
    ON realtime_event_outbox (tenant_id, event_id);

CREATE INDEX realtime_event_outbox_pending_idx
    ON realtime_event_outbox (tenant_id, available_at, occurred_at, event_id)
    WHERE published_at IS NULL;

CREATE INDEX realtime_event_outbox_retention_idx
    ON realtime_event_outbox (published_at)
    WHERE published_at IS NOT NULL;

CREATE TRIGGER realtime_event_outbox_touch_updated_at
    BEFORE UPDATE ON realtime_event_outbox
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

SELECT enable_tenant_isolation('realtime_event_outbox');
