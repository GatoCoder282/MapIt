ALTER TABLE sector
    ADD COLUMN appearance jsonb NOT NULL DEFAULT '{"elements":{}}'::jsonb
    CHECK (jsonb_typeof(appearance) = 'object');
