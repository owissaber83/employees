#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════
# 💾 نسخة احتياطية يومية آلية لقاعدة بيانات GBR (تعمل بلا Cloud Functions / Spark)
# ──────────────────────────────────────────────────────────────────────────
# تُصدّر كامل قاعدة البيانات إلى ملف JSON مضغوط ومؤرّخ، خارج iCloud، وتحتفظ بـ30 يوماً.
# تستخدم صلاحيات firebase CLI (المالك) فتتجاوز قواعد الأمان لقراءة الجذر — للنسخ فقط.
#
# ⚙️  الإعداد لمرّة واحدة:
#     1) تأكّد أنك مُسجّل دخول:   firebase login
#     2) اجعله قابلاً للتنفيذ:     chmod +x scripts/backup.sh
#     3) جدوِله يومياً 3 فجراً:    crontab -e   ثم أضف السطر:
#        0 3 * * * /Users/redasaber/Library/Mobile\ Documents/com~apple~CloudDocs/app/scripts/backup.sh >> "$HOME/gbr-backups/backup.log" 2>&1
#
#   (يمكن تغيير مجلد النسخ عبر متغيّر البيئة GBR_BACKUP_DIR)
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT="emplyeeapp-1dc64"
BACKUP_DIR="${GBR_BACKUP_DIR:-$HOME/gbr-backups}"   # خارج iCloud عمداً
KEEP_DAYS="${GBR_BACKUP_KEEP_DAYS:-30}"
STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="$BACKUP_DIR/gbr-backup-$STAMP.json"

mkdir -p "$BACKUP_DIR"

# firebase CLI قد يكون في مسار nvm — أضف مواقع شائعة إلى PATH ليعمل ضمن cron
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin"

if ! command -v firebase >/dev/null 2>&1; then
  echo "[$(date)] ❌ firebase CLI غير موجود في PATH — عدّل PATH في السكربت." >&2
  exit 1
fi

echo "[$(date)] بدء النسخ الاحتياطي → $OUT"
firebase database:get / --project "$PROJECT" > "$OUT"

# تحقّق أن الناتج ليس فارغاً/تالفاً قبل الاعتماد عليه
if [ ! -s "$OUT" ] || [ "$(head -c 4 "$OUT")" = "null" ]; then
  echo "[$(date)] ⚠️ الناتج فارغ أو null — لم تُحذَف القديمة احتياطاً." >&2
  rm -f "$OUT"
  exit 2
fi

gzip -f "$OUT"
SIZE="$(du -h "$OUT.gz" | cut -f1)"
echo "[$(date)] ✅ اكتملت: $OUT.gz ($SIZE)"

# تنظيف النسخ الأقدم من KEEP_DAYS يوماً (بعد نجاح النسخة الجديدة فقط)
find "$BACKUP_DIR" -name 'gbr-backup-*.json.gz' -type f -mtime "+$KEEP_DAYS" -delete
echo "[$(date)] 🧹 نُظّفت النسخ الأقدم من $KEEP_DAYS يوماً."
