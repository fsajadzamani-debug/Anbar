/* Service Worker — نسخه آفلاینِ پوسته برنامه (داده‌ها همیشه از سرور خوانده می‌شوند) */
const CACHE = 'anbaryar-v10';
const ASSETS = ['./', 'index.html', 'config.js', 'css/app.css', 'css/anbar.css', 'fonts/fonts.css', 'fonts/Vazirmatn.woff2', 'fonts/plexmono-400.woff2', 'fonts/plexmono-600.woff2',
  'lib/supabase.js', 'lib/xlsx.full.min.js', 'js/jalali.js', 'js/store.js', 'js/app.js', 'js/docs.js', 'js/stock.js', 'js/charts.js', 'js/admin.js', 'icons/icon.svg', 'manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
