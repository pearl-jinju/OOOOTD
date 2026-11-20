CREATE TABLE IF NOT EXISTS ooootd_member_role_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id text NOT NULL,
 member_id text NOT NULL,
 role text NOT NULL CHECK (role IN ('admin','member')),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ooootd_member_role_changes_recent
 ON ooootd_member_role_changes (created_at DESC);
