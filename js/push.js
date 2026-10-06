/* ======================================================
   انباریار — اعلان پیام‌های چت روی گوشی/کامپیوتر (Web Push)
   ====================================================== */
const PUSH = {
  supported: () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol === 'https:',
  async reg() { return navigator.serviceWorker.getRegistration() || navigator.serviceWorker.register('sw.js'); },
  async current() { if (!PUSH.supported()) return null; const r = await PUSH.reg(); return r ? r.pushManager.getSubscription() : null; },
  async state() {   // 'on' | 'off' | 'denied' | 'unsupported'
    if (!PUSH.supported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    return (await PUSH.current()) && Notification.permission === 'granted' ? 'on' : 'off';
  },
  async enable() {
    if (!PUSH.supported()) throw new Error(/iPhone|iPad/.test(navigator.userAgent) ? 'در آیفون اول سایت را با «Add to Home Screen» نصب کنید، بعد از داخل برنامه اعلان را فعال کنید' : 'این مرورگر از اعلان پشتیبانی نمی‌کند');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('اجازه اعلان داده نشد؛ از تنظیمات مرورگر برای این سایت Notifications را Allow کنید');
    const key = await S.store.pushPublicKey();
    const reg = await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(key) });
    await S.store.savePushSub(sub);
    try { localStorage.setItem('wh_push_user', S.user.id); } catch (e) { /* ignore */ }
  },
  async disable() { const sub = await PUSH.current(); if (sub) { await S.store.deletePushSub(sub.endpoint); await sub.unsubscribe(); } },
  // اگر قبلاً روشن شده، اشتراک را برای کاربر فعلی تازه کن (مثلاً کاربر دیگری روی همین دستگاه وارد شده)
  async refresh() {
    try { const sub = await PUSH.current(); if (sub && Notification.permission === 'granted') await S.store.savePushSub(sub); } catch (e) { /* ignore */ }
  },
};
function b64uToBytes(s) { const p = '='.repeat((4 - s.length % 4) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function pushButton(el) {   // دکمه روشن/خاموش اعلان
  if (!el) return;
  const st = await PUSH.state();
  const lab = { on: 'اعلان روشن است', off: 'روشن کردن اعلان', denied: 'اعلان مسدود است', unsupported: 'اعلان پشتیبانی نمی‌شود' }[st];
  el.innerHTML = `${ICON.bell}<span>${lab}</span>`; el.className = 'btn sm ' + (st === 'on' ? 'on-push' : st === 'off' ? 'primary' : '');
  el.onclick = () => busy(el, async () => {
    if (st === 'on') { if (await confirmBox('اعلان پیام‌ها روی این دستگاه خاموش شود؟', 'خاموش کن', false)) { await PUSH.disable(); toast('اعلان خاموش شد'); } }
    else if (st === 'denied') toast('اعلان در تنظیمات مرورگر برای این سایت مسدود شده؛ آن را Allow کنید و صفحه را رفرش کنید', 'err');
    else { await PUSH.enable(); toast('اعلان پیام‌ها روی این دستگاه روشن شد', 'ok'); }
    pushButton(el);
  });
}

/* خروج: اعلان این دستگاه برای این کاربر خاموش می‌شود تا به نفر بعدی که وارد می‌شود پیام او نرسد */
async function signOut() {
  try { await Promise.race([PUSH.disable(), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* ignore */ }
  await S.store.logout(); location.hash = ''; location.reload();
}
