-- =============================================================
--  MapIt — migración baseline
--
--  Establece SOLO los cimientos multi-tenant. Las tablas de negocio
--  (establishment, floor, sector, space_element, person, reservation,
--  event) llegan en migraciones posteriores, una por caso de uso.
--
--  REGLA DEL PROYECTO (plan §12):
--  toda tabla de negocio nace con:
--     tenant_id TEXT NOT NULL REFERENCES tenant(id)
--     + índice compuesto (tenant_id, id)
--     + RLS habilitada con la política estándar
--  Usa `pnpm db:new` para crear la siguiente migración con esa plantilla.
-- =============================================================

-- UUID v7 no está en core todavía; pgcrypto nos da gen_random_uuid() (v4).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Tabla de tenants (global, SIN tenant_id) ─────────────────
CREATE TABLE tenant (
    id            TEXT        PRIMARY KEY,
    name          TEXT        NOT NULL,
    slug          TEXT        NOT NULL UNIQUE,
    status        TEXT        NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tenant_status_valid CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    CONSTRAINT tenant_slug_format  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);

COMMENT ON TABLE  tenant IS 'Empresas de la plataforma (CU-01, CU-03). Tabla global: no lleva tenant_id.';
COMMENT ON COLUMN tenant.slug IS 'Identificador en URLs públicas de reserva (CU-15).';

-- ── Infraestructura de aislamiento multi-tenant (CU-02) ──────
--
-- Doble capa deliberada:
--   1. Hibernate @TenantId filtra automáticamente en la capa de la app.
--   2. Row-Level Security filtra en la BD, incluso ante SQL nativo
--      que se saltara Hibernate.
-- La segunda es la que convierte CU-02 de promesa en garantía.

-- Devuelve el tenant de la sesión actual, o NULL si no se ha fijado.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.tenant_id', true), '');
$$;

COMMENT ON FUNCTION current_tenant_id() IS
    'Tenant de la sesión. Lo fija el backend con SET LOCAL app.tenant_id en cada transacción.';

-- Aplica la política estándar de aislamiento a una tabla.
-- Se invoca desde cada migración que crea una tabla de negocio.
CREATE OR REPLACE FUNCTION enable_tenant_isolation(target_table TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', target_table);
    EXECUTE format($pol$
        CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_tenant_id())
        WITH CHECK (tenant_id = current_tenant_id())
    $pol$, target_table);
END;
$$;

COMMENT ON FUNCTION enable_tenant_isolation(TEXT) IS
    'Aplica RLS de aislamiento por tenant. Llamar en toda migración que cree una tabla de negocio.';

-- ── Trigger de updated_at (reutilizable) ─────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER tenant_touch_updated_at
    BEFORE UPDATE ON tenant
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── Tenant de demostración ───────────────────────────────────
-- Permite que el entorno arranque con algo utilizable.
-- Los datos de las 4 verticales llegan con `pnpm db:seed`.
INSERT INTO tenant (id, name, slug, status)
VALUES ('demo', 'Empresa Demo MapIt', 'demo', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;
