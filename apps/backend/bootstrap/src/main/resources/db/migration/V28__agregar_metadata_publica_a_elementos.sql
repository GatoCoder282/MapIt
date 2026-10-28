ALTER TABLE space_element
    ADD COLUMN label varchar(120),
    ADD COLUMN capacity integer,
    ADD CONSTRAINT space_element_label_valid CHECK (label IS NULL OR (label = btrim(label) AND length(label) > 0)),
    ADD CONSTRAINT space_element_capacity_positive CHECK (capacity IS NULL OR capacity > 0);
