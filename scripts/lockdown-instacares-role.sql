-- ============================================================
-- SECURITY FIX: Lock down legacy 'instacares' database role
-- and add audit log tamper protection
-- ============================================================

-- 1. Prevent login via the instacares owner role
-- (The app uses instacares_app, migrations use instacares_migrate)
ALTER ROLE instacares NOLOGIN;

-- 2. Add DELETE trigger on audit_logs to prevent deletion
-- (UPDATE trigger 'prevent_audit_update' already exists)
CREATE OR REPLACE FUNCTION prevent_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries cannot be deleted. This action has been logged.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_audit_delete ON audit_logs;
CREATE TRIGGER prevent_audit_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_delete();

-- 3. Revoke TRUNCATE on audit_logs from all non-superuser roles
REVOKE TRUNCATE ON audit_logs FROM instacares;
REVOKE TRUNCATE ON audit_logs FROM instacares_app;
REVOKE TRUNCATE ON audit_logs FROM instacares_migrate;
REVOKE TRUNCATE ON audit_logs FROM instacares_backup;

-- 4. Revoke DELETE on audit_logs from app and backup roles
-- (The trigger blocks it anyway, but defense in depth)
REVOKE DELETE ON audit_logs FROM instacares_app;
REVOKE DELETE ON audit_logs FROM instacares_backup;
REVOKE DELETE ON audit_logs FROM instacares_migrate;

-- 5. Verify the changes
SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = 'instacares';

-- Show triggers on audit_logs
SELECT tgname, tgtype FROM pg_trigger WHERE tgrelid = 'audit_logs'::regclass AND NOT tgisinternal;
