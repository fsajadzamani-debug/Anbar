/* Service Worker — نسخه آفلاینِ پوسته برنامه (داده‌ها همیشه از سرور خوانده می‌شوند) */
const CACHE = 'anbaryar-v14';
const ASSETS = ['./', 'index.html', 'config.js', 'css/app.css', 'css/anbar.css', 'fonts/fonts.css', 'fonts/Vazirmatn.woff2', 'fonts/plexmono-400.woff2', 'fonts/plexmono-600.woff2',
  'lib/supabase.js', 'lib/xlsx.full.min.js', 'js/jalali.js', 'js/store.js', 'js/app.js', 'js/docs.js', 'js/stock.js', 'js/charts.js', 'js/chat.js', 'js/push.js', 'css/theme.css', 'js/admin.js', 'icons/icon.svg', 'manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});

/* ---------- اعلان پیام‌های چت (حتی وقتی سایت بسته است) ---------- */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'انباریار', body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    // اگر برنامه همین الان باز و جلوی چشم است، خودش پیام را نشان می‌دهد
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some(w => w.visibilityState === 'visible' && w.focused)) return;
    await self.registration.showNotification(d.title || 'انباریار — پیام جدید', {
      body: d.body || '', dir: 'rtl', lang: 'fa', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
      tag: 'chat-' + (d.room || ''), renotify: true, data: { room: d.room || 'general' },
    });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL('./#/chat/' + encodeURIComponent(e.notification.data?.room || 'general'), self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) { if (w.url.startsWith(self.registration.scope)) { await w.focus(); return w.navigate(url); } }
    return self.clients.openWindow(url);
  })());
});
