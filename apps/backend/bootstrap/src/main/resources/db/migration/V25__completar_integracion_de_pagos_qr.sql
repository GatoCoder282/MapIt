-- V22: evolucionar la V21 aplicada sin cambiar su checksum ni borrar sus datos.
ALTER TABLE reservation_access ADD COLUMN establishment_id uuid,
    ADD COLUMN revoked_at timestamptz;
UPDATE reservation_access access SET establishment_id = reservation.establishment_id
FROM reservation
WHERE reservation.tenant_id = access.tenant_id AND reservation.id = access.reservation_id;
ALTER TABLE reservation_access ALTER COLUMN establishment_id SET NOT NULL,
    ADD CONSTRAINT reservation_access_token_length CHECK (length(token_hash) = 64),
    ADD CONSTRAINT reservation_access_expiry CHECK (expires_at > created_at),
    ADD UNIQUE (tenant_id,token_hash),
    ADD FOREIGN KEY (tenant_id,reservation_id,establishment_id)
        REFERENCES reservation(tenant_id,id,establishment_id) ON DELETE CASCADE;
ALTER TABLE reservation_access ALTER COLUMN token_hash TYPE char(64);

ALTER TABLE reservation ADD COLUMN confirmed_payment_id uuid,
    ADD COLUMN checked_in_at timestamptz, ADD COLUMN checked_in_by uuid;
UPDATE reservation SET confirmed_payment_id = access.confirmed_payment_id,
    checked_in_at = access.checked_in_at, checked_in_by = access.checked_in_by
FROM reservation_access access
WHERE reservation.tenant_id = access.tenant_id AND reservation.id = access.reservation_id;
ALTER TABLE reservation
    ADD FOREIGN KEY (tenant_id,confirmed_payment_id) REFERENCES payment(tenant_id,id),
    ADD FOREIGN KEY (tenant_id,checked_in_by) REFERENCES app_user(tenant_id,id);
COMMENT ON COLUMN reservation_access.confirmed_payment_id IS 'Legado V21; fuente operativa en reservation desde V22.';
COMMENT ON COLUMN reservation_access.checked_in_at IS 'Legado V21; fuente operativa en reservation desde V22.';
COMMENT ON COLUMN reservation_access.checked_in_by IS 'Legado V21; fuente operativa en reservation desde V22.';

CREATE TABLE reservation_event (
    id uuid PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenant(id),
    establishment_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    event_type text NOT NULL CHECK (event_type IN ('CONFIRMED','CHECKED_IN')),
    previous_state text NOT NULL,
    new_state text NOT NULL,
    actor_id uuid,
    payment_id uuid,
    source text NOT NULL CHECK (source IN ('PAYMENT','STAFF')),
    occurred_at timestamptz NOT NULL,
    UNIQUE (tenant_id,id),
    FOREIGN KEY (tenant_id,reservation_id,establishment_id) REFERENCES reservation(tenant_id,id,establishment_id),
    FOREIGN KEY (tenant_id,actor_id) REFERENCES app_user(tenant_id,id),
    FOREIGN KEY (tenant_id,payment_id) REFERENCES payment(tenant_id,id)
);
SELECT enable_tenant_isolation('reservation_event');
REVOKE UPDATE,DELETE ON reservation_event FROM mapit_app;

UPDATE payment SET request_id = gen_random_uuid() WHERE request_id IS NULL;
ALTER TABLE payment ALTER COLUMN request_id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN request_id SET NOT NULL;
DROP INDEX payment_request_idx;
CREATE UNIQUE INDEX payment_request_idx ON payment(tenant_id,reservation_id,request_id);
CREATE UNIQUE INDEX payment_confirmed_reservation_idx ON payment(tenant_id,reservation_id) WHERE status='CONFIRMED';
ALTER TABLE reservation_payment_quote
    ADD CONSTRAINT reservation_payment_quote_expiry CHECK (expires_at > created_at),
    ADD CONSTRAINT reservation_payment_quote_total CHECK (
        (total_amount IS NULL AND total_currency IS NULL) OR
        (total_amount >= deposit_amount AND total_currency = deposit_currency));
ALTER TABLE payment_receipt ADD CONSTRAINT payment_receipt_token_length CHECK (length(token_hash) = 64);
ALTER TABLE payment_receipt ALTER COLUMN token_hash TYPE char(64);
ALTER TABLE realtime_event_outbox ADD COLUMN reservation_id uuid;
