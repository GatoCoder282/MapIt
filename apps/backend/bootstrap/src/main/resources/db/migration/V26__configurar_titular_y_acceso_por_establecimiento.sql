-- configurar titular y acceso por establecimiento
-- Migración V23. Creada el 2026-10-25.
--
-- REGLAS (plan §12):
--   1. Toda tabla de negocio lleva  tenant_id TEXT NOT NULL REFERENCES tenant(id)
--   2. Índice compuesto (tenant_id, id)
--   3. SELECT enable_tenant_isolation('<tabla>');  ← activa RLS
--   4. NUNCA edites una migración ya mergeada: Flyway guarda su checksum
--      y el arranque fallará. Para corregir, crea una migración nueva.
--   5. Actualiza docs/db/mapit.dbml en el MISMO commit.

ALTER TABLE merchant_payment_method ADD COLUMN account_holder_name varchar(120);
ALTER TABLE merchant_payment_method ADD CONSTRAINT merchant_payment_method_holder_not_blank
    CHECK (account_holder_name IS NULL OR length(btrim(account_holder_name)) > 0);
COMMENT ON COLUMN merchant_payment_method.account_holder_name IS
    'Titular público de la cuenta; NULL para legado sin información confirmada. Nunca una credencial.';

CREATE TABLE establishment_staff_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL REFERENCES tenant(id),
    establishment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    can_check_in boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL,
    updated_by uuid NOT NULL,
    UNIQUE (tenant_id,id),
    UNIQUE (tenant_id,establishment_id,user_id),
    FOREIGN KEY (tenant_id,establishment_id) REFERENCES establishment(tenant_id,id),
    FOREIGN KEY (tenant_id,user_id) REFERENCES app_user(tenant_id,id),
    FOREIGN KEY (tenant_id,updated_by) REFERENCES app_user(tenant_id,id)
);
SELECT enable_tenant_isolation('establishment_staff_access');
COMMENT ON TABLE establishment_staff_access IS
    'Concesión explícita STAFF por establecimiento; ADMIN conserva autorización empresarial del rol. Sin concesión STAFF falla cerrado.';
