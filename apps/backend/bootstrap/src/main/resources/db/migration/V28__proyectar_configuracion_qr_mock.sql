-- HU-6.03: enlaza la configuración QR MOCK con su método local de checkout.
-- Los métodos anteriores no se asocian por coincidencia textual.
ALTER TABLE mock_qr_configuration
    ADD CONSTRAINT mock_qr_configuration_tenant_establishment_id_unique
        UNIQUE (tenant_id, establishment_id, id);

ALTER TABLE merchant_payment_method
    ADD COLUMN mock_qr_configuration_id uuid,
    ADD COLUMN superseded_at timestamptz,
    ADD CONSTRAINT merchant_payment_method_mock_qr_local_check
        CHECK (mock_qr_configuration_id IS NULL OR
            (provider = 'MOCK_GATEWAY' AND establishment_id IS NOT NULL)),
    ADD CONSTRAINT merchant_payment_method_mock_qr_superseded_check
        CHECK (superseded_at IS NULL OR mock_qr_configuration_id IS NOT NULL),
    ADD CONSTRAINT merchant_payment_method_mock_qr_configuration_fk
        FOREIGN KEY (tenant_id, establishment_id, mock_qr_configuration_id)
        REFERENCES mock_qr_configuration (tenant_id, establishment_id, id);

CREATE UNIQUE INDEX merchant_payment_method_mock_qr_current_uidx
    ON merchant_payment_method (tenant_id, mock_qr_configuration_id)
    WHERE mock_qr_configuration_id IS NOT NULL AND superseded_at IS NULL;

-- Solo se proyectan configuraciones con policy existente; sus importes, enabled y ventana
-- permanecen propiedad de payment_policy. Los legacy no se enlazan.
DO $$
DECLARE
    target_tenant text;
BEGIN
    FOR target_tenant IN SELECT id FROM tenant ORDER BY id LOOP
        PERFORM set_config('app.tenant_id', target_tenant, true);
        INSERT INTO merchant_payment_method (
            id, tenant_id, establishment_id, display_name, country, currency, provider,
            bank_name, account_reference, static_qr_image, enabled, created_at, updated_at,
            created_by, updated_by, account_holder_name, mock_qr_configuration_id
        )
        SELECT gen_random_uuid(), config.tenant_id, config.establishment_id, 'QR de prueba',
               config.country, policy.currency, 'MOCK_GATEWAY', config.bank_name,
               config.account_reference, NULL, config.enabled, config.created_at, config.updated_at,
               config.created_by, config.updated_by, config.account_holder_name, config.id
        FROM mock_qr_configuration config
        JOIN payment_policy policy
          ON policy.tenant_id = config.tenant_id
         AND policy.establishment_id = config.establishment_id
        WHERE config.tenant_id = target_tenant;
    END LOOP;
END
$$;
