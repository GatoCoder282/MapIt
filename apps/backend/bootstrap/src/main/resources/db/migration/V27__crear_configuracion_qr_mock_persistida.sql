-- Configuración QR de prueba persistida (HU-6.03).
-- Separada de merchant_payment_method: este registro nunca lo consume el checkout.
CREATE TABLE mock_qr_configuration (
    id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           text         NOT NULL REFERENCES tenant(id),
    establishment_id    uuid         NOT NULL,
    country             char(2)      NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
    bank_name           varchar(120) NOT NULL CHECK (length(btrim(bank_name)) > 0),
    account_holder_name varchar(120) NOT NULL CHECK (length(btrim(account_holder_name)) > 0),
    account_reference   varchar(120) NOT NULL CHECK (length(btrim(account_reference)) > 0),
    enabled             boolean      NOT NULL DEFAULT true,
    simulation_token    uuid         NOT NULL DEFAULT gen_random_uuid(),
    created_at          timestamptz  NOT NULL,
    updated_at          timestamptz  NOT NULL,
    created_by          uuid         NOT NULL,
    updated_by          uuid         NOT NULL,
    -- El índice (tenant_id,id) lo aporta esta restricción única.
    UNIQUE (tenant_id,id),
    -- Una sola configuración de prueba por establecimiento y tenant.
    UNIQUE (tenant_id,establishment_id),
    UNIQUE (tenant_id,simulation_token),
    FOREIGN KEY (tenant_id,establishment_id) REFERENCES establishment(tenant_id,id),
    FOREIGN KEY (tenant_id,created_by) REFERENCES app_user(tenant_id,id),
    FOREIGN KEY (tenant_id,updated_by) REFERENCES app_user(tenant_id,id)
);

SELECT enable_tenant_isolation('mock_qr_configuration');

CREATE TRIGGER mock_qr_configuration_touch_updated_at
    BEFORE UPDATE ON mock_qr_configuration
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMENT ON TABLE mock_qr_configuration IS
    'Simulación de desarrollo por tenant y establecimiento. El token solo construye /simulacion/qr/{token}; no autoriza pagos ni expone datos bancarios.';
