ALTER TABLE ooootd_site_activity
    ADD COLUMN IF NOT EXISTS occurred_at timestamptz;
