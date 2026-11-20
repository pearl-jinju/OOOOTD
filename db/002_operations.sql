CREATE TABLE IF NOT EXISTS ooootd_admins (
 user_id text PRIMARY KEY,
 granted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ooootd_api_minutes (
 minute timestamptz NOT NULL,
 route text NOT NULL,
 method text NOT NULL,
 status integer NOT NULL,
 requests bigint NOT NULL DEFAULT 1,
 elapsed_ms bigint NOT NULL,
 max_ms integer NOT NULL,
 PRIMARY KEY (minute, route, method, status)
);
