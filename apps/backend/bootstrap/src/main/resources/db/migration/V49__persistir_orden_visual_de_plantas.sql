-- El orden de presentación es independiente del nivel físico.
ALTER TABLE floor
    ADD COLUMN display_order integer CHECK (display_order >= 0);
