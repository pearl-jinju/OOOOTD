CREATE TABLE IF NOT EXISTS ooootd_site_activity (
 event_id uuid PRIMARY KEY,
 event_type text NOT NULL CHECK (event_type IN ('visit','search')),
 user_id text,
 search_term text CHECK (char_length(search_term) BETWEEN 1 AND 120),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((event_type = 'search') = (search_term IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ooootd_site_activity_recent
 ON ooootd_site_activity (event_type, created_at DESC);
