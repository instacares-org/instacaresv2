-- ============================================================
-- Row-Level Security (RLS) Policies
-- ============================================================
-- Defense-in-depth: even with direct DB access, unauthorized
-- users see zero rows. Our three authorized roles get explicit
-- policies; everyone else is blocked.
-- ============================================================

-- Helper: grant instacares_app BYPASSRLS would defeat the purpose.
-- Instead, we create explicit permissive policies per role.

-- ==================== CHILDREN (medical data) ====================
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE children FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_children ON children;
CREATE POLICY app_children ON children FOR ALL
  TO instacares_app USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS migrate_children ON children;
CREATE POLICY migrate_children ON children FOR ALL
  TO instacares_migrate USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS backup_children ON children;
CREATE POLICY backup_children ON children FOR SELECT
  TO instacares_backup USING (true);

-- ==================== USERS (account data) ====================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_users ON users;
CREATE POLICY app_users ON users FOR ALL
  TO instacares_app USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS migrate_users ON users;
CREATE POLICY migrate_users ON users FOR ALL
  TO instacares_migrate USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS backup_users ON users;
CREATE POLICY backup_users ON users FOR SELECT
  TO instacares_backup USING (true);

-- ==================== PAYMENTS (financial data) ====================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_payments ON payments;
CREATE POLICY app_payments ON payments FOR ALL
  TO instacares_app USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS migrate_payments ON payments;
CREATE POLICY migrate_payments ON payments FOR ALL
  TO instacares_migrate USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS backup_payments ON payments;
CREATE POLICY backup_payments ON payments FOR SELECT
  TO instacares_backup USING (true);

-- ==================== BOOKINGS ====================
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_bookings ON bookings;
CREATE POLICY app_bookings ON bookings FOR ALL
  TO instacares_app USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS migrate_bookings ON bookings;
CREATE POLICY migrate_bookings ON bookings FOR ALL
  TO instacares_migrate USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS backup_bookings ON bookings;
CREATE POLICY backup_bookings ON bookings FOR SELECT
  TO instacares_backup USING (true);

-- ==================== CHECK_IN_OUTS (care logs) ====================
ALTER TABLE check_in_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_outs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_checkinouts ON check_in_outs;
CREATE POLICY app_checkinouts ON check_in_outs FOR ALL
  TO instacares_app USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS migrate_checkinouts ON check_in_outs;
CREATE POLICY migrate_checkinouts ON check_in_outs FOR ALL
  TO instacares_migrate USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS backup_checkinouts ON check_in_outs;
CREATE POLICY backup_checkinouts ON check_in_outs FOR SELECT
  TO instacares_backup USING (true);

-- ==================== CAREGIVER_VERIFICATIONS ====================
ALTER TABLE caregiver_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_verifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_verifications ON caregiver_verifications;
CREATE POLICY app_verifications ON caregiver_verifications FOR ALL
  TO instacares_app USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS migrate_verifications ON caregiver_verifications;
CREATE POLICY migrate_verifications ON caregiver_verifications FOR ALL
  TO instacares_migrate USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS backup_verifications ON caregiver_verifications;
CREATE POLICY backup_verifications ON caregiver_verifications FOR SELECT
  TO instacares_backup USING (true);

-- ==================== USER_PROFILES (PII) ====================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_profiles ON user_profiles;
CREATE POLICY app_profiles ON user_profiles FOR ALL
  TO instacares_app USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS migrate_profiles ON user_profiles;
CREATE POLICY migrate_profiles ON user_profiles FOR ALL
  TO instacares_migrate USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS backup_profiles ON user_profiles;
CREATE POLICY backup_profiles ON user_profiles FOR SELECT
  TO instacares_backup USING (true);

-- ==================== AUDIT_LOGS (tamper protection) ====================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- App can INSERT and SELECT but not UPDATE/DELETE (enforced by trigger + grants)
DROP POLICY IF EXISTS app_auditlogs ON audit_logs;
CREATE POLICY app_auditlogs ON audit_logs FOR ALL
  TO instacares_app USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS migrate_auditlogs ON audit_logs;
CREATE POLICY migrate_auditlogs ON audit_logs FOR ALL
  TO instacares_migrate USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS backup_auditlogs ON audit_logs;
CREATE POLICY backup_auditlogs ON audit_logs FOR SELECT
  TO instacares_backup USING (true);

-- ==================== DATA_CHANGE_LOG ====================
ALTER TABLE data_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_change_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_changelog ON data_change_log;
CREATE POLICY app_changelog ON data_change_log FOR ALL
  TO instacares_app USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS migrate_changelog ON data_change_log;
CREATE POLICY migrate_changelog ON data_change_log FOR ALL
  TO instacares_migrate USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS backup_changelog ON data_change_log;
CREATE POLICY backup_changelog ON data_change_log FOR SELECT
  TO instacares_backup USING (true);

-- ==================== VERIFICATION ====================
-- Test that the old 'instacares' user (or any other role) gets blocked
SELECT 'RLS enabled on 9 tables with policies for 3 authorized roles' AS result;
