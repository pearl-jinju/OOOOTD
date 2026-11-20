CREATE TABLE IF NOT EXISTS ooootd_closet_activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 closet_owner_id text NOT NULL,
 member_id text,
 garment_id bigint NOT NULL,
 garment_name text NOT NULL,
 category text NOT NULL,
 action text NOT NULL CHECK (action IN ('added','removed')),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ooootd_closet_activity_recent ON ooootd_closet_activity (created_at DESC);
ALTER TABLE ooootd_closet_activity ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON ooootd_closet_activity TO ooootd_app;
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='public'
   AND tablename='ooootd_closet_activity' AND policyname='closet_owner_activity'
 ) THEN
  CREATE POLICY closet_owner_activity ON ooootd_closet_activity FOR INSERT TO ooootd_app
   WITH CHECK (closet_owner_id=current_setting('app.user_id',true));
 END IF;
END
$$;
