-- Solo categorías optativas existentes. No existe preferencia para alertas críticas.
CREATE TABLE notification_preference (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL REFERENCES tenant(id),
 user_id uuid NOT NULL,
 category text NOT NULL CHECK(category IN ('RESERVATIONS','OPERATIONS')),
 enabled boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),
 UNIQUE(tenant_id,user_id,category),
 FOREIGN KEY(tenant_id,user_id) REFERENCES app_user(tenant_id,id)
);
SELECT enable_tenant_isolation('notification_preference');
CREATE TRIGGER notification_preference_touch_updated_at BEFORE UPDATE ON notification_preference FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
