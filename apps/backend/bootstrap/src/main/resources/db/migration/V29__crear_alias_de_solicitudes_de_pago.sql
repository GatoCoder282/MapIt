-- crear alias de solicitudes de pago
-- Migración V26. Creada el 2026-10-27.
--
-- REGLAS (plan §12):
--   1. Toda tabla de negocio lleva  tenant_id TEXT NOT NULL REFERENCES tenant(id)
--   2. Índice compuesto (tenant_id, id)
--   3. SELECT enable_tenant_isolation('<tabla>');  ← activa RLS
--   4. NUNCA edites una migración ya mergeada: Flyway guarda su checksum
--      y el arranque fallará. Para corregir, crea una migración nueva.
--   5. Actualiza docs/db/mapit.dbml en el MISMO commit.

DROP INDEX payment_reservation_idx;
ALTER TABLE payment
    ADD CONSTRAINT payment_tenant_reservation_payment_id_unique
        UNIQUE (tenant_id, reservation_id, id);

CREATE TABLE payment_request_alias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL REFERENCES tenant(id),
    reservation_id uuid NOT NULL,
    request_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, reservation_id, request_id),
    FOREIGN KEY (tenant_id, reservation_id, payment_id)
        REFERENCES payment (tenant_id, reservation_id, id)
);
CREATE INDEX payment_request_alias_payment_idx
    ON payment_request_alias (tenant_id, reservation_id, payment_id);
SELECT enable_tenant_isolation('payment_request_alias');
REVOKE UPDATE, DELETE ON payment_request_alias FROM mapit_app;

DO $$
DECLARE
    target_tenant text;
BEGIN
    FOR target_tenant IN SELECT id FROM tenant ORDER BY id LOOP
        PERFORM set_config('app.tenant_id', target_tenant, true);
        INSERT INTO payment_request_alias(tenant_id, reservation_id, request_id, payment_id, created_at)
        SELECT payment.tenant_id, payment.reservation_id, payment.request_id, payment.id, payment.created_at
        FROM payment
        WHERE payment.tenant_id = target_tenant
        ON CONFLICT (tenant_id, reservation_id, request_id) DO NOTHING;
    END LOOP;
END
$$;
