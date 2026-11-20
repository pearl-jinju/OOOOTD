CREATE TABLE IF NOT EXISTS ooootd_member_logins (
 session_id text PRIMARY KEY,
 user_id text NOT NULL,
 created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS ooootd_member_logins_recent
 ON ooootd_member_logins (created_at DESC);
