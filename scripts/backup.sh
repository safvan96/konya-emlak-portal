#!/bin/bash
# PostgreSQL Backup Script
# Cron: 0 3 * * * /root/konya-emlak-portal/scripts/backup.sh

set -e

BACKUP_DIR="$HOME/backups/emlak-portal"
DB_NAME="konya_emlak"
DB_USER="postgres"
RETENTION_DAYS=30
DATE=$(date +%Y-%m-%d_%H-%M)

# Dizin yoksa oluştur
mkdir -p "$BACKUP_DIR"

# Backup al
echo "[$DATE] Backup başlatılıyor..."
pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/backup_${DATE}.sql.gz"

# Boyut bilgisi
SIZE=$(du -h "$BACKUP_DIR/backup_${DATE}.sql.gz" | cut -f1)
echo "[$DATE] Backup tamamlandı: $SIZE"

# Eski backupları sil
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[$DATE] $RETENTION_DAYS günden eski backuplar silindi."

# Backup listesi
echo "Mevcut backuplar:"
ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null || echo "Backup bulunamadı"
