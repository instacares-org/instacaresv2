#!/bin/bash
# ==============================================================
# Encrypted Database Backup with Retention Policy
# ==============================================================
#
# Creates AES-256-CBC encrypted pg_dump backups.
# Usage:
#   ./scripts/backup-encrypted.sh
#
# Environment (reads from .env.production, .env, or PM2 process env):
#   DATABASE_URL        - PostgreSQL connection string
#   FIELD_ENCRYPTION_KEY - Used to derive the backup encryption key
#
# Backup location: /var/www/instacaresv2/backups/db/
# Retention: 30 days (configurable below)
# ==============================================================

set -euo pipefail

# ---- Configuration ----
APP_DIR="/var/www/instacaresv2"
BACKUP_DIR="${APP_DIR}/backups/db"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="instacares_prod_${TIMESTAMP}.sql.gz.enc"
CHECKSUM_FILE="instacares_prod_${TIMESTAMP}.sha256"
LOG_FILE="${BACKUP_DIR}/backup.log"

# ---- Load environment ----
# Try .env files first, then fill gaps from PM2 process environment
if [ -f "${APP_DIR}/.env.production" ]; then
  set -a
  source "${APP_DIR}/.env.production"
  set +a
elif [ -f "${APP_DIR}/.env" ]; then
  set -a
  source "${APP_DIR}/.env"
  set +a
fi

# Fill any missing vars from PM2 (secrets live in PM2, not .env)
if command -v pm2 &>/dev/null; then
  if [ -z "${DATABASE_URL:-}" ]; then
    PM2_DB_URL=$(pm2 env 1 2>/dev/null | grep '^DATABASE_URL:' | sed 's/^DATABASE_URL: *//')
    [ -n "${PM2_DB_URL}" ] && export DATABASE_URL="${PM2_DB_URL}"
  fi
  if [ -z "${FIELD_ENCRYPTION_KEY:-}" ]; then
    PM2_ENC_KEY=$(pm2 env 1 2>/dev/null | grep '^FIELD_ENCRYPTION_KEY:' | sed 's/^FIELD_ENCRYPTION_KEY: *//')
    [ -n "${PM2_ENC_KEY}" ] && export FIELD_ENCRYPTION_KEY="${PM2_ENC_KEY}"
  fi
fi

# Validate required env vars
# Use backup-specific user (read-only) if available, else fall back to DATABASE_URL
BACKUP_URL="${DATABASE_URL_BACKUP:-${DATABASE_URL:-}}"
if [ -z "${BACKUP_URL}" ]; then
  echo "[ERROR] DATABASE_URL_BACKUP or DATABASE_URL not set" >&2
  exit 1
fi

if [ -z "${FIELD_ENCRYPTION_KEY:-}" ]; then
  echo "[ERROR] FIELD_ENCRYPTION_KEY not set — needed for backup encryption" >&2
  exit 1
fi

# ---- Parse connection URL ----
# Format: postgresql://user:password@host:port/dbname
DB_NAME=$(echo "$BACKUP_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

# ---- Setup ----
mkdir -p "${BACKUP_DIR}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log "=== Starting encrypted backup ==="
log "Database: ${DB_NAME}"

# ---- Create encrypted backup ----
# Use sudo -u postgres for peer auth (avoids RLS restrictions)
# pg_dump → gzip → openssl AES-256-CBC encryption
sudo -u postgres pg_dump \
  -d "${DB_NAME}" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  -F plain \
  2>>"${LOG_FILE}" \
| gzip -9 \
| openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -pass "env:FIELD_ENCRYPTION_KEY" \
    -out "${BACKUP_DIR}/${BACKUP_FILE}"

if [ ! -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
  log "[ERROR] Backup file was not created"
  exit 1
fi

# ---- Generate checksum for integrity verification ----
sha256sum "${BACKUP_DIR}/${BACKUP_FILE}" > "${BACKUP_DIR}/${CHECKSUM_FILE}"

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
log "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"
log "Checksum: ${CHECKSUM_FILE}"

# ---- Retention policy: delete backups older than N days ----
DELETED_COUNT=0
while IFS= read -r -d '' old_file; do
  rm -f "$old_file"
  DELETED_COUNT=$((DELETED_COUNT + 1))
  log "Deleted old backup: $(basename "$old_file")"
done < <(find "${BACKUP_DIR}" -name "instacares_prod_*.sql.gz.enc" -mtime +${RETENTION_DAYS} -print0 2>/dev/null)

# Also clean up old checksums
find "${BACKUP_DIR}" -name "instacares_prod_*.sha256" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

if [ ${DELETED_COUNT} -gt 0 ]; then
  log "Retention: deleted ${DELETED_COUNT} backups older than ${RETENTION_DAYS} days"
fi

# ---- Summary ----
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "*.sql.gz.enc" | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
log "Total backups: ${TOTAL_BACKUPS} (${TOTAL_SIZE})"
log "=== Backup complete ==="

# ---- Restore instructions (logged for reference) ----
# To restore:
#   openssl enc -aes-256-cbc -d -salt -pbkdf2 -iter 100000 \
#     -pass "pass:YOUR_FIELD_ENCRYPTION_KEY" \
#     -in backup.sql.gz.enc | gunzip | psql -h localhost -U instacares -d instacares_prod
