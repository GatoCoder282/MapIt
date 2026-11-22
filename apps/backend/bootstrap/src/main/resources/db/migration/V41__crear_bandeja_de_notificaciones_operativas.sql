-- MAP-292: V40 pertenece a MAP-285. Desplegar en orden V39 -> V40 -> V41.
-- Sin dependencia de columnas de perfil ni modificación de outOfOrder/migraciones previas.
CREATE TABLE notification_delivery_key (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL REFERENCES tenant(id),
 recipient_user_id uuid NOT NULL,
 source_event_id uuid NOT NULL,
 event_type text NOT NULL CHECK (event_type IN ('RESERVATION_CREATED','RESERVATION_CHECKED_IN')),
 event_fingerprint varchar(64) NOT NULL CHECK (event_fingerprint ~ '^[0-9a-f]{64}$'),
 notification_id uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id,id),
 UNIQUE (tenant_id,recipient_user_id,source_event_id,event_type),
 FOREIGN KEY (tenant_id,recipient_user_id) REFERENCES app_user(tenant_id,id)
);
SELECT enable_tenant_isolation('notification_delivery_key');
CREATE TRIGGER notification_delivery_key_touch_updated_at BEFORE UPDATE ON notification_delivery_key
 FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TABLE notification (
 id uuid PRIMARY KEY,
 tenant_id text NOT NULL REFERENCES tenant(id),
 delivery_key_id uuid NOT NULL,
 recipient_user_id uuid NOT NULL,
 source_event_id uuid NOT NULL,
 event_type text NOT NULL CHECK (event_type IN ('RESERVATION_CREATED','RESERVATION_CHECKED_IN')),
 category text NOT NULL,
 establishment_id uuid NOT NULL,
 reservation_id uuid NOT NULL,
 occurred_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 expires_at timestamptz NOT NULL,
 UNIQUE (tenant_id,id),
 UNIQUE (tenant_id,delivery_key_id),
 UNIQUE (tenant_id,recipient_user_id,source_event_id,event_type),
 FOREIGN KEY (tenant_id,delivery_key_id) REFERENCES notification_delivery_key(tenant_id,id),
 FOREIGN KEY (tenant_id,recipient_user_id) REFERENCES app_user(tenant_id,id),
 FOREIGN KEY (tenant_id,establishment_id) REFERENCES establishment(tenant_id,id),
 FOREIGN KEY (tenant_id,reservation_id,establishment_id) REFERENCES reservation(tenant_id,id,establishment_id),
 CHECK ((event_type='RESERVATION_CREATED' AND category='RESERVATIONS') OR (event_type='RESERVATION_CHECKED_IN' AND category='OPERATIONS')),
 CHECK (created_at >= occurred_at),
 CHECK (read_at IS NULL OR read_at >= created_at),
 CHECK (expires_at > created_at)
);
CREATE INDEX notification_inbox_idx ON notification(tenant_id,recipient_user_id,created_at DESC,id DESC);
CREATE INDEX notification_unread_idx ON notification(tenant_id,recipient_user_id,created_at DESC,id DESC) WHERE read_at IS NULL;
CREATE INDEX notification_expiry_idx ON notification(tenant_id,expires_at,id);
SELECT enable_tenant_isolation('notification');
CREATE TRIGGER notification_touch_updated_at BEFORE UPDATE ON notification
 FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
COMMENT ON TABLE notification IS 'Bandeja propia; SQL valida destinatario y permisos además de RLS. Caducidad independiente del flag.';
COMMENT ON TABLE notification_delivery_key IS 'UUIDs y huella sin payload/PII. Clave durable que sobrevive a la purga de notification.';
