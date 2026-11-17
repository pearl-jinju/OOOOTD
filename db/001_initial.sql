CREATE TABLE IF NOT EXISTS catalog_items (
 id bigint PRIMARY KEY, data jsonb NOT NULL,
 active boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (data->>'gender' IN ('men','women')),
 CHECK (data->>'category' IN ('outer','top','bottom','shoes'))
);
CREATE TABLE IF NOT EXISTS user_closet (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id text NOT NULL,
 item jsonb NOT NULL, image_key text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (item->>'gender' IN ('men','women')),
 CHECK (item->>'category' IN ('outer','top','bottom','shoes'))
);
ALTER TABLE user_closet ALTER COLUMN image_key DROP NOT NULL;
CREATE INDEX IF NOT EXISTS user_closet_owner ON user_closet(user_id, id);
CREATE TABLE IF NOT EXISTS agent_runs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, kind text NOT NULL,
 status text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ooootd_app') THEN
  CREATE ROLE ooootd_app NOLOGIN NOBYPASSRLS;
 END IF;
END $$;
GRANT ooootd_app TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO ooootd_app;
GRANT SELECT ON catalog_items TO ooootd_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON user_closet TO ooootd_app;
GRANT USAGE,SELECT ON SEQUENCE user_closet_id_seq TO ooootd_app;
ALTER TABLE user_closet ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_closet FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_closet' AND policyname='own_clothes') THEN
 CREATE POLICY own_clothes ON user_closet TO ooootd_app
 USING (user_id = current_setting('app.user_id',true))
 WITH CHECK (user_id = current_setting('app.user_id',true));
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS device_sessions (
 token_hash text PRIMARY KEY, user_id text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '365 days'
);
CREATE TABLE IF NOT EXISTS user_profiles (
 user_id text PRIMARY KEY, sizes jsonb NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE ON user_profiles TO ooootd_app;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='own_profile') THEN
 CREATE POLICY own_profile ON user_profiles TO ooootd_app
 USING (user_id=current_setting('app.user_id',true))
 WITH CHECK (user_id=current_setting('app.user_id',true));
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS closet_catalog_once ON user_closet(user_id,(item->>'sourceCatalogId')) WHERE item ? 'sourceCatalogId';

CREATE TABLE IF NOT EXISTS device_claims (
 claim_hash text PRIMARY KEY, user_id text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
 used boolean NOT NULL DEFAULT false
);
