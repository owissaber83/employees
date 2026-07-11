/* بنيان — Service Worker: تثبيت التطبيق والعمل دون اتصال (App Shell caching).
   استراتيجية: cache-first للأصول من نفس النطاق · تجاوز طلبات Firebase/Google (لها تزامنها الخاص). */
const CACHE = 'bunyan-cache-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // طلبات خارجية (Firebase RTDB/Auth، Google، gstatic): تمرّ مباشرة للشبكة بلا تخزين
  if (url.origin !== self.location.origin) return;

  // تنقّل الصفحة: شبكة أولاً مع تحديث نسخة الـ shell، والرجوع للمخزّن عند انقطاع الاتصال
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // بقية أصول النطاق: من المخزّن أولاً، ثم الشبكة (وتُخزَّن للاستخدام لاحقاً دون اتصال)
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(r => {
      if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => cached))
  );
});
