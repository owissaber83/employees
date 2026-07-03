#!/usr/bin/env bash
# 🔨 بناء نسخة الإنتاج المشوّشة (Minify/Obfuscate)
# المصدر يبقى في public/ — المنشور المشوّش يُولّد في dist/
# آمن: لا تُمسّ الأسماء العامة (toplevel) التي تستدعيها أزرار HTML؛ فقط المتغيّرات الداخلية.
set -e
cd "$(dirname "$0")"

echo "🔨 تجهيز نسخة الإنتاج المشوّشة..."
rm -rf dist
cp -R public dist

ok=0; skip=0
for f in dist/*.js; do
  [ -e "$f" ] || continue
  base="$(basename "$f")"
  case "$base" in
    *.min.js) echo "  ⏭️  تخطّي (مُصغّر مسبقاً): $base"; skip=$((skip+1)); continue;;
  esac
  echo "  🔒 تشويش: $base"
  tmp="${f%.js}.__min.js"     # امتداد .js كي يقبله node --check
  if [ "$base" = "app.js" ]; then
    # app.js وحدة ES (import) — نبقي toplevel كما هو لحفظ الأسماء المُعرّضة على window
    npx --yes terser "$f" --module --compress --mangle toplevel=false --format comments=false -o "$tmp"
  else
    # ملفات كلاسيكية — terser افتراضياً لا يُغيّر أسماء toplevel (الدوال العامة محفوظة)
    npx --yes terser "$f" --compress --mangle --format comments=false -o "$tmp"
  fi
  node --check "$tmp"         # تأكيد سلامة الصياغة قبل الاعتماد
  mv "$tmp" "$f"
  ok=$((ok+1))
done

echo "✅ اكتمل البناء في dist/  —  مُشوّش: $ok  ·  متخطّى: $skip"
echo "   انشر بـ:  firebase deploy --only hosting"
