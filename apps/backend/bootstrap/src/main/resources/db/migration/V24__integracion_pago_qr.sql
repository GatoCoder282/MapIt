-- MAP-229/HU-6.03 integración: política monetaria por establecimiento, snapshot de cotización y comprobante.
CREATE TABLE reservation_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL REFERENCES tenant(id),
    reservation_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    confirmed_payment_id uuid,
    checked_in_at timestamptz,
    checked_in_by uuid,
    UNIQUE (tenant_id,id),
    UNIQUE (tenant_id,reservation_id),
    FOREIGN KEY (tenant_id,reservation_id) REFERENCES reservation(tenant_id,id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id,confirmed_payment_id) REFERENCES payment(tenant_id,id)
);
SELECT enable_tenant_isolation('reservation_access');
ALTER TABLE payment ADD COLUMN request_id uuid;
CREATE UNIQUE INDEX payment_request_idx ON payment(tenant_id,reservation_id,request_id) WHERE request_id IS NOT NULL;
CREATE TABLE payment_policy (
    id uuid PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenant(id),
    establishment_id uuid NOT NULL,
    enabled boolean NOT NULL,
    currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    deposit_amount numeric(24,6) NOT NULL CHECK (deposit_amount > 0),
    total_amount numeric(24,6) CHECK (total_amount IS NULL OR total_amount >= deposit_amount),
    payment_window_minutes int NOT NULL CHECK (payment_window_minutes BETWEEN 5 AND 120),
    updated_at timestamptz NOT NULL,
    updated_by uuid NOT NULL,
    UNIQUE (tenant_id,id),
    UNIQUE (tenant_id,establishment_id),
    FOREIGN KEY (tenant_id,establishment_id) REFERENCES establishment(tenant_id,id),
    FOREIGN KEY (tenant_id,updated_by) REFERENCES app_user(tenant_id,id)
);
SELECT enable_tenant_isolation('payment_policy');

CREATE TABLE reservation_payment_quote (
    id uuid PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenant(id),
    establishment_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    deposit_amount numeric(24,6) NOT NULL CHECK (deposit_amount > 0),
    deposit_currency char(3) NOT NULL CHECK (deposit_currency ~ '^[A-Z]{3}$'),
    total_amount numeric(24,6),
    total_currency char(3),
    payment_window_minutes int NOT NULL CHECK (payment_window_minutes BETWEEN 5 AND 120),
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    UNIQUE (tenant_id,id),
    UNIQUE (tenant_id,reservation_id),
    FOREIGN KEY (tenant_id,reservation_id,establishment_id) REFERENCES reservation(tenant_id,id,establishment_id)
);
SELECT enable_tenant_isolation('reservation_payment_quote');

CREATE TABLE payment_receipt (
    id uuid PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenant(id),
    establishment_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    UNIQUE (tenant_id,id),
    UNIQUE (tenant_id,token_hash),
    FOREIGN KEY (tenant_id,payment_id) REFERENCES payment(tenant_id,id),
    FOREIGN KEY (tenant_id,reservation_id,establishment_id) REFERENCES reservation(tenant_id,id,establishment_id)
);
SELECT enable_tenant_isolation('payment_receipt');
REVOKE UPDATE,DELETE ON payment_receipt FROM mapit_app;
