-- V40 pertenece a MAP-285: desplegar V40–V42 antes de V43/V44. Sin dependencia de columnas de perfil.
CREATE TABLE notification_event_outbox (
 id uuid PRIMARY KEY,
 tenant_id text NOT NULL REFERENCES tenant(id),
 event_type text NOT NULL CHECK(event_type IN ('RESERVATION_CREATED','RESERVATION_CHECKED_IN')),
 establishment_id uuid NOT NULL,
 reservation_id uuid NOT NULL,
 occurred_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,reservation_id,establishment_id) REFERENCES reservation(tenant_id,id,establishment_id)
);
CREATE INDEX notification_event_pending_idx ON notification_event_outbox(tenant_id,created_at,id) WHERE processed_at IS NULL;
SELECT enable_tenant_isolation('notification_event_outbox');
CREATE TRIGGER notification_event_touch_updated_at BEFORE UPDATE ON notification_event_outbox FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TABLE notification_event_candidate (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL REFERENCES tenant(id),
 event_id uuid NOT NULL,
 user_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),
 UNIQUE(tenant_id,event_id,user_id),
 FOREIGN KEY(tenant_id,event_id) REFERENCES notification_event_outbox(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES app_user(tenant_id,id)
);
SELECT enable_tenant_isolation('notification_event_candidate');
CREATE TRIGGER notification_candidate_touch_updated_at BEFORE UPDATE ON notification_event_candidate FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
ALTER TABLE notification ADD COLUMN signal_version bigint NOT NULL DEFAULT 1,
 ADD COLUMN delivered_version bigint NOT NULL DEFAULT 0,
 ADD CONSTRAINT notification_signal_versions CHECK(delivered_version>=0 AND signal_version>=delivered_version);
CREATE INDEX notification_signal_pending_idx ON notification(tenant_id,id) WHERE signal_version>delivered_version;
CREATE FUNCTION notification_read_signal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.read_at IS DISTINCT FROM OLD.read_at THEN NEW.signal_version := OLD.signal_version + 1; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notification_read_signal BEFORE UPDATE ON notification FOR EACH ROW EXECUTE FUNCTION notification_read_signal();
