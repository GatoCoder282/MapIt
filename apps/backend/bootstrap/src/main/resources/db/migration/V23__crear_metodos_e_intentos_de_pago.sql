-- MAP-229: componentes de pago independientes; no confirma ni activa reservas.
ALTER TABLE reservation ADD CONSTRAINT reservation_tenant_id_id_establishment_unique
    UNIQUE (tenant_id, id, establishment_id);

CREATE TABLE merchant_payment_method (
    id uuid PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenant(id),
    establishment_id uuid,
    display_name varchar(120) NOT NULL CHECK (length(btrim(display_name)) > 0),
    country char(2) NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
    currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    provider text NOT NULL CHECK (provider IN ('STATIC_BANK_QR','MOCK_GATEWAY','INTEGRATED_GATEWAY')),
    bank_name varchar(120) NOT NULL CHECK (length(btrim(bank_name)) > 0),
    account_reference varchar(120) NOT NULL CHECK (length(btrim(account_reference)) > 0),
    static_qr_image text CHECK (length(static_qr_image) <= 350000),
    enabled boolean NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    created_by uuid NOT NULL,
    updated_by uuid NOT NULL,
    UNIQUE (tenant_id,id),
    FOREIGN KEY (tenant_id,establishment_id) REFERENCES establishment(tenant_id,id),
    FOREIGN KEY (tenant_id,created_by) REFERENCES app_user(tenant_id,id),
    FOREIGN KEY (tenant_id,updated_by) REFERENCES app_user(tenant_id,id),
    CHECK (provider <> 'STATIC_BANK_QR' OR static_qr_image IS NOT NULL),
    CHECK (provider <> 'INTEGRATED_GATEWAY' OR NOT enabled)
);
CREATE INDEX merchant_payment_method_scope_idx ON merchant_payment_method(tenant_id,establishment_id);
SELECT enable_tenant_isolation('merchant_payment_method');

CREATE TABLE payment (
    id uuid PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenant(id),
    establishment_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    method_id uuid NOT NULL,
    provider text NOT NULL CHECK (provider IN ('STATIC_BANK_QR','MOCK_GATEWAY','INTEGRATED_GATEWAY')),
    merchant_reference varchar(120) NOT NULL,
    external_reference varchar(120) NOT NULL,
    amount numeric(24,6) NOT NULL CHECK (amount > 0),
    currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    status text NOT NULL CHECK (status IN ('PENDING','PENDING_MANUAL_VERIFICATION','CONFIRMED','FAILED','EXPIRED','RECONCILIATION_REQUIRED')),
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    verified_at timestamptz,
    verified_by uuid,
    verification_source text,
    UNIQUE (tenant_id,id),
    UNIQUE (tenant_id,provider,external_reference),
    FOREIGN KEY (tenant_id,reservation_id,establishment_id)
        REFERENCES reservation(tenant_id,id,establishment_id),
    FOREIGN KEY (tenant_id,method_id) REFERENCES merchant_payment_method(tenant_id,id),
    FOREIGN KEY (tenant_id,verified_by) REFERENCES app_user(tenant_id,id),
    CHECK (expires_at > created_at)
);
CREATE INDEX payment_reservation_idx ON payment(tenant_id,reservation_id,id);
SELECT enable_tenant_isolation('payment');

CREATE TABLE payment_webhook_event (
    id uuid PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenant(id),
    payment_id uuid NOT NULL,
    provider text NOT NULL,
    event_id varchar(120) NOT NULL,
    outcome text NOT NULL,
    received_at timestamptz NOT NULL,
    UNIQUE (tenant_id,id),
    UNIQUE (tenant_id,provider,event_id),
    FOREIGN KEY (tenant_id,payment_id) REFERENCES payment(tenant_id,id)
);
SELECT enable_tenant_isolation('payment_webhook_event');

CREATE TABLE payment_verification (
    id uuid PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenant(id),
    payment_id uuid NOT NULL,
    actor_id uuid,
    source text NOT NULL,
    reference varchar(120) NOT NULL,
    created_at timestamptz NOT NULL,
    UNIQUE (tenant_id,id),
    FOREIGN KEY (tenant_id,payment_id) REFERENCES payment(tenant_id,id),
    FOREIGN KEY (tenant_id,actor_id) REFERENCES app_user(tenant_id,id)
);
SELECT enable_tenant_isolation('payment_verification');

-- Historial append-only también para el rol runtime: no solo una convención del API.
REVOKE UPDATE,DELETE ON payment_webhook_event,payment_verification FROM mapit_app;

