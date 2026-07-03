#!/bin/bash
# يرفع رقم الإصدار (?v=) لكل سكربتات public/*.js المرجعية داخل index.html
# الاستخدام: ./bump-version.sh   (شغّله قبل أي firebase deploy)

set -e
cd "$(dirname "$0")"

NEW_V="$(date +%Y%m%d)-$(date +%H%M)"
HTML="public/index.html"

if [ ! -f "$HTML" ]; then
  echo "❌ لم يتم العثور على $HTML"
  exit 1
fi

# يستبدل أي ?v=... موجود بعد اسم أي ملف js محلي (app.js, accounting.js, ...) بالقيمة الجديدة
sed -i '' -E "s/(src=\"[a-zA-Z0-9_-]+\.js)\?v=[a-zA-Z0-9.-]+\"/\1?v=${NEW_V}\"/g" "$HTML"

echo "✅ تم تحديث جميع أرقام الإصدار إلى: ${NEW_V}"
grep -oE '[a-zA-Z0-9_-]+\.js\?v=[a-zA-Z0-9.-]+' "$HTML"
