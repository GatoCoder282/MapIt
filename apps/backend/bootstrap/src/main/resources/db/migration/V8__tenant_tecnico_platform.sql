-- =============================================================
--  CU-01/CU-24: tenant técnico `platform`
--
--  El login exige tenantSlug (CU-23). El SUPER_ADMIN no pertenece
--  a ninguna empresa de negocio: opera SOBRE la plataforma. Para
--  que su identidad viva en la misma tabla `app_user` con las
--  mismas garantías (RLS, FK a tenant, unicidad por tenant), se
--  crea un tenant TÉCNICO, claramente marcado, que no representa
--  un negocio real.
--
--  Reglas:
--   - No es un tenant de negocio: no debe aparecer como empresa
--     operable. El frontend lo excluye de listados operativos.
--   - `vertical` es obligatoria (V4) en todos los tenants; este
--     usa un valor existente del CHECK sin significado de negocio.
--   - Idempotente: ON CONFLICT DO NOTHING.
--   - El usuario SUPER_ADMIN NO se crea aquí: las credenciales no
--     viven en migraciones. Las crea el bootstrap de la aplicación
--     desde variables de entorno (ver SuperAdminBootstrap).
-- =============================================================

INSERT INTO tenant (id, name, slug, vertical, status)
VALUES ('platform', 'MapIt — Plataforma', 'platform', 'RESTAURANT', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN tenant.slug IS
    'Identificador en URLs públicas de reserva (CU-15). El slug `platform` es técnico: no reservable por clientes.';
