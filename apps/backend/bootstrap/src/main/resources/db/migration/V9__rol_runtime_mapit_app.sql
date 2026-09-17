-- =============================================================
--  MAP-175: rol de runtime mapit_app
--
--  Hasta aquí la aplicación conectaba con `mapit`, el superusuario
--  dueño del esquema: la RLS quedaba inerte en runtime (el owner
--  bypasea las políticas). Desde esta migración se separan:
--
--    mapit      → migraciones y DDL (Flyway). Sigue siendo owner.
--    mapit_app  → runtime de la aplicación.
--                 LOGIN, NOSUPERUSER, NOBYPASSRLS, sin DDL.
--
--  La contraseña NUNCA se versiona: llega del entorno vía placeholder
--  de Flyway (spring.flyway.placeholders.mapitAppDbPassword). Si falta,
--  la migración falla en voz alta — abrir la app sin RLS real no es
--  una opción silenciosa.
-- =============================================================

DO $$
DECLARE
    app_password TEXT := '${mapitAppDbPassword}';
BEGIN
    IF NULLIF(BTRIM(app_password), '') IS NULL THEN
        RAISE EXCEPTION
            'MAPIT_APP_DB_PASSWORD no configurada: no se puede crear el rol de runtime mapit_app sin contraseña';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mapit_app') THEN
        CREATE ROLE mapit_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;

    -- Idempotente y útil para rotación: la contraseña siempre se alinea al entorno.
    EXECUTE format('ALTER ROLE mapit_app WITH PASSWORD %L', app_password);
END
$$;

-- Privilegios mínimos: CRUD sobre las tablas de negocio. Nada de DDL.
GRANT USAGE ON SCHEMA public TO mapit_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mapit_app;

-- La bitácora de migraciones no es dato de la app: se exceptúa.
REVOKE ALL ON flyway_schema_history FROM mapit_app;

-- Las tablas creadas en el futuro llegan con los mismos privilegios
-- (los emite el rol que ejecuta las migraciones: mapit, el owner).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mapit_app;
