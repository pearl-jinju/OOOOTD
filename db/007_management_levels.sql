ALTER TABLE ooootd_admins
 ADD COLUMN IF NOT EXISTS access_role text NOT NULL DEFAULT 'admin'
 CHECK (access_role IN ('admin','manager'));

ALTER TABLE ooootd_member_role_changes
 DROP CONSTRAINT IF EXISTS ooootd_member_role_changes_role_check,
 ADD CONSTRAINT ooootd_member_role_changes_role_check
 CHECK (role IN ('admin','manager','member'));
