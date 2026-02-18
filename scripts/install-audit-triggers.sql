-- ============================================================
-- Database-Level Audit Triggers for Sensitive Tables
-- ============================================================
-- Tracks UPDATE and DELETE on: users, children, payments,
-- caregiver_verifications, check_in_outs, platform_settings, bookings
-- ============================================================

-- 1. Create the data change log table
CREATE TABLE IF NOT EXISTS data_change_log (
  id            BIGSERIAL PRIMARY KEY,
  table_name    TEXT NOT NULL,
  operation     TEXT NOT NULL,
  record_id     TEXT NOT NULL,
  changed_by    TEXT,
  old_data      JSONB,
  new_data      JSONB,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dcl_table_name ON data_change_log(table_name);
CREATE INDEX IF NOT EXISTS idx_dcl_record_id ON data_change_log(record_id);
CREATE INDEX IF NOT EXISTS idx_dcl_changed_at ON data_change_log(changed_at);

-- Grant app user INSERT+SELECT but no UPDATE/DELETE on change log
GRANT INSERT, SELECT ON data_change_log TO instacares_app;
GRANT USAGE, SELECT ON SEQUENCE data_change_log_id_seq TO instacares_app;
GRANT ALL ON data_change_log TO instacares_migrate;
GRANT SELECT ON data_change_log TO instacares_backup;

-- 2. Create the generic audit trigger function
CREATE OR REPLACE FUNCTION audit_data_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO data_change_log (table_name, operation, record_id, changed_by, old_data, new_data)
    VALUES (TG_TABLE_NAME, 'DELETE', OLD.id, current_user, to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO data_change_log (table_name, operation, record_id, changed_by, old_data, new_data)
    VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id, current_user, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach triggers to sensitive tables

DROP TRIGGER IF EXISTS audit_users_changes ON users;
CREATE TRIGGER audit_users_changes
  AFTER UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_data_change();

DROP TRIGGER IF EXISTS audit_children_changes ON children;
CREATE TRIGGER audit_children_changes
  AFTER UPDATE OR DELETE ON children
  FOR EACH ROW EXECUTE FUNCTION audit_data_change();

DROP TRIGGER IF EXISTS audit_payments_changes ON payments;
CREATE TRIGGER audit_payments_changes
  AFTER UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_data_change();

DROP TRIGGER IF EXISTS audit_verifications_changes ON caregiver_verifications;
CREATE TRIGGER audit_verifications_changes
  AFTER UPDATE OR DELETE ON caregiver_verifications
  FOR EACH ROW EXECUTE FUNCTION audit_data_change();

DROP TRIGGER IF EXISTS audit_checkinout_changes ON check_in_outs;
CREATE TRIGGER audit_checkinout_changes
  AFTER UPDATE OR DELETE ON check_in_outs
  FOR EACH ROW EXECUTE FUNCTION audit_data_change();

DROP TRIGGER IF EXISTS audit_settings_changes ON platform_settings;
CREATE TRIGGER audit_settings_changes
  AFTER UPDATE OR DELETE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION audit_data_change();

DROP TRIGGER IF EXISTS audit_bookings_changes ON bookings;
CREATE TRIGGER audit_bookings_changes
  AFTER UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION audit_data_change();

-- 4. Retention function for change logs
CREATE OR REPLACE FUNCTION purge_old_data_change_logs(retention_days INT DEFAULT 90)
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM data_change_log WHERE changed_at < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Verify
SELECT 'Audit triggers installed on 7 tables' AS result;
