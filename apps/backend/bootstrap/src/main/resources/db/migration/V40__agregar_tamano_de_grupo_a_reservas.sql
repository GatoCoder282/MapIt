ALTER TABLE reservation
    ADD COLUMN party_size integer CHECK (party_size > 0);
