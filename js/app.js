/* ======================================================
   انباریار — سامانه انبارداری فولاد تکنیک — هسته برنامه
   ====================================================== */
const S = {
  store: null, user: null, settings: {}, warehouses: [], items: [], docs: [], stock: [], assets: [],
  whId: localStorage.getItem('wh_sel') || 'all',
  listState: {}, dirty: false,
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- انواع سند و کالا ---------- */
const DT = {
  receipt:  { fa: 'رسید انبار',          short: 'رسید',    color: '#15803d', party: 'تأمین‌کننده / فروشنده', ref: 'شماره درخواست خرید / فاکتور', sign: +1, signs: ['تحویل‌دهنده', 'انباردار', 'کنترل کیفی', 'مدیر انبار'] },
  issue:    { fa: 'حواله انبار',         short: 'حواله',   color: '#c2410c', party: 'تحویل‌گیرنده',          ref: 'شماره درخواست کالا',          sign: -1, signs: ['درخواست‌کننده', 'تحویل‌گیرنده', 'انباردار', 'مدیر انبار'] },
  transfer: { fa: 'انتقال بین انبارها', short: 'انتقال',  color: '#1d4ed8', party: 'حمل‌کننده / راننده',    ref: 'شماره بارنامه / پلاک',         sign: -1, signs: ['انباردار مبدأ', 'حمل‌کننده', 'انباردار مقصد', 'مدیر انبار'] },
  return:   { fa: 'برگشت از مصرف',      short: 'برگشتی',  color: '#0e8f7e', party: 'تحویل‌دهنده (پیمانکار / واحد)', ref: 'شماره حواله مرتبط',     sign: +1, signs: ['تحویل‌دهنده', 'انباردار', 'مدیر انبار'] },
  adjust:   { fa: 'تعدیل / انبارگردانی', short: 'تعدیل',   color: '#7c3aed', party: 'مسئول شمارش',           ref: 'شماره صورتجلسه',               sign: +1, signs: ['شمارنده', 'انباردار', 'مدیر انبار'] },
};
const DT_KEYS = ['receipt', 'issue', 'transfer', 'return', 'adjust'];
const KINDS = { civil: 'قطعات سیویل', material: 'مصالح', consumable: 'مصرفی', tool: 'ابزارآلات', asset: 'اموال' };
const KIND_COLOR = { civil: '#b45309', material: '#0369a1', consumable: '#64748b', tool: '#7c3aed', asset: '#be185d' };
const WH_KINDS = { central: 'انبار مرکزی', site: 'انبار کارگاه / پروژه', yard: 'یارد / محوطه', other: 'سایر' };
const ROLE_FA = { admin: 'مدیر انبار', auditor: 'ناظر (مشاهده همه)', user: 'کاربر انبار', none: 'بدون دسترسی' };
const MEM_FA = { keeper: 'انباردار', viewer: 'مشاهده' };
const ASSET_ST = { in_stock: { fa: 'در انبار', c: '#15803d' }, assigned: { fa: 'تحویل شخص', c: '#1d4ed8' }, repair: { fa: 'در تعمیر', c: '#c98200' }, lost: { fa: 'مفقود', c: '#c93636' }, scrapped: { fa: 'اسقاط', c: '#64748b' } };

/* ---------- دسترسی ---------- */
const can = {
  admin: () => S.user?.role === 'admin',
  seeAll: () => ['admin', 'auditor'].includes(S.user?.role),
  see: w => can.seeAll() || (S.user?.role === 'user' && (S.user.members || []).some(m => m.warehouse_id === w)),
  write: w => can.admin() || (S.user?.role === 'user' && (S.user.members || []).some(m => m.warehouse_id === w && m.role === 'keeper')),
  writeAny: () => can.admin() || (S.user?.role === 'user' && (S.user.members || []).some(m => m.role === 'keeper')),
};
const myWh = () => S.warehouses.filter(w => can.see(w.id));
const writableWh = () => S.warehouses.filter(w => w.active !== false && can.write(w.id));
const selWh = () => S.whId === 'all' ? myWh() : myWh().filter(w => w.id === S.whId);

/* ---------- آیکون‌ها ---------- */
const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  dash: I('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  all: I('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5"/><circle cx="17.5" cy="8.5" r="2.5"/><path d="M17 14c2.4.2 4 1.6 4.6 4"/>'),
  wh: I('<path d="M3 21V9l9-5 9 5v12"/><path d="M7 21v-8h10v8M7 17h10"/>'),
  box: I('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>'),
  stock: I('<rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>'),
  tag: I('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>'),
  report: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  import: I('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  log: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  print: I('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  trash: I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  copy: I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  back: I('<path d="M9 6l6 6-6 6"/>'),
  moon: I('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  menu: I('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  excel: I('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
  cal: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  logout: I('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>'),
  download: I('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  in: I('<path d="M12 4v12M6 10l6 6 6-6"/><path d="M4 20h16"/>'),
  out: I('<path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 20h16"/>'),
  swap: I('<path d="M4 8h14l-4-4M20 16H6l4 4"/>'),
  ret: I('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  adj: I('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  ban: I('<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>'),
  key: I('<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>'),
};
const DT_ICON = { receipt: ICON.in, issue: ICON.out, transfer: ICON.swap, return: ICON.ret, adjust: ICON.adj };

/* ---------- ابزارهای عمومی ---------- */
function toast(msg, kind = '') {
  let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), kind === 'err' ? 7000 : 3000);
}
function modal(title, bodyHtml, { wide = false, footer = '' } = {}) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}"><div class="modal-h">${title}<button class="icon-btn x" data-close>${ICON.x}</button></div>
    <div class="modal-b">${bodyHtml}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}</div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-close]')) close(); });
  return { el: bg, close };
}
function confirmBox(msg, okText = 'تأیید', danger = true) {
  return new Promise(res => {
    const m = modal('تأیید', `<p style="margin:0">${msg}</p>`, { footer: `<button class="btn ${danger ? 'danger solid' : 'primary'}" data-ok>${okText}</button><button class="btn" data-close>انصراف</button>` });
    m.el.querySelector('[data-ok]').onclick = () => { m.close(); res(true); };
    m.el.addEventListener('click', ev => { if (ev.target.closest('[data-close]') || ev.target === m.el) res(false); });
  });
}
function promptBox(title, label, def = '', okText = 'تأیید') {
  return new Promise(res => {
    const m = modal(title, `<div class="form-row"><label>${label}</label><input id="pIn" value="${esc(def)}" dir="auto"></div>`, { footer: `<button class="btn primary" data-ok>${okText}</button><button class="btn" data-close>انصراف</button>` });
    const i = $('#pIn', m.el); i.focus(); i.select();
    const ok = () => { const v = i.value.trim(); m.close(); res(v); };
    m.el.querySelector('[data-ok]').onclick = ok; i.onkeydown = ev => { if (ev.key === 'Enter') ok(); };
    m.el.addEventListener('click', ev => { if (ev.target.closest('[data-close]') || ev.target === m.el) res(null); });
  });
}
async function busy(btn, fn) {
  const old = btn?.innerHTML; if (btn) { btn.disabled = true; btn.innerHTML = '…در حال انجام'; }
  try { return await fn(); } catch (e) { console.error(e); toast(e.message || String(e), 'err'); } finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = old; } }
}
/* اعداد: تا ۳ رقم اعشار، جداکننده هزارگان */
const num = v => { const n = parseFloat(faToEn(String(v ?? '')).replace(/[,٬\s]/g, '').replace('٫', '.')); return isNaN(n) ? 0 : n; };
const fmtQ = n => { n = +n || 0; const r = Math.round(n * 1000) / 1000; return r.toLocaleString('en-US', { maximumFractionDigits: 3 }); };
const qCell = (n, cls = '') => `<td class="mono num ${cls} ${+n < 0 ? 'neg' : ''}">${n ? fmtQ(n) : '<span class="muted">0</span>'}</td>`;

const whOf = id => S.warehouses.find(w => w.id === id);
const whName = id => whOf(id)?.name || '—';
const itemOf = id => S.itemMap?.get(id);
const dtTag = t => `<span class="type-tag" style="background:${DT[t]?.color || '#777'}">${esc(DT[t]?.short || t)}</span>`;
const kindTag = k => `<span class="kind-tag" style="--c:${KIND_COLOR[k] || '#777'}">${esc(KINDS[k] || k || '—')}</span>`;
const docLabel = d => `${DT[d.type]?.short || d.type} ${d.doc_no}`;
const voidBadge = d => d.status === 'void' ? '<span class="badge" style="background:#c936361a;color:#c93636">باطل</span>' : '';

function rebuildIndex() {
  S.itemMap = new Map(S.items.map(i => [i.id, i]));
  S.itemByCode = new Map(S.items.map(i => [normFa(i.code), i]));
  S.stockMap = new Map(S.stock.map(s => [s.warehouse_id + '|' + s.item_id, s]));
  S.items.forEach(i => { i._s = null; });
}
const stockOf = (w, it) => +(S.stockMap.get(w + '|' + it)?.qty || 0);
const stockTotal = (it, whs = selWh()) => whs.reduce((a, w) => a + stockOf(w.id, it), 0);
const itemText = it => it._s || (it._s = normFa([it.code, it.name, it.spec, it.category, KINDS[it.kind], it.notes].join(' ')));
const matchQ = (text, q) => { const t = normFa(q); return !t || t.split(' ').every(x => text.includes(x)); };
function hilite(text, q) {
  const t = esc(text); if (!q) return t;
  const toks = normFa(q).split(' ').filter(x => x.length > 1); if (!toks.length) return t;
  try { return t.replace(new RegExp('(' + toks.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi'), '<mark>$1</mark>'); } catch (e) { return t; }
}
async function log(action, entity, label, details = '', warehouse_id = null, entity_id = null) {
  try { await S.store.addLog({ action, entity, label, details, warehouse_id, entity_id }); } catch (e) { /* ignore */ }
}

/* ---------- بارگذاری داده ---------- */
async function loadAll() {
  const [settings, warehouses, items, docs, stock, assets] = await Promise.all([
    S.store.getSettings(), S.store.listWarehouses(), S.store.listItems(), S.store.listDocs(), S.store.listStock(), S.store.listAssets()]);
  Object.assign(S, { settings, warehouses, items, docs, stock, assets });
  rebuildIndex();
  if (S.whId !== 'all' && !myWh().some(w => w.id === S.whId)) S.whId = 'all';
}
async function reloadStock() {
  const [docs, stock] = await Promise.all([S.store.listDocs(), S.store.listStock()]);
  S.docs = docs; S.stock = stock; rebuildIndex();
}

/* ============================ BOOT ============================ */
async function boot() {
  applyTheme(localStorage.getItem('wh_theme') || 'light');
  const cfg = getConfig();
  if (cfg && window.supabase) {
    S.store = new SupaStore(cfg);
    try { S.user = await S.store.init(); } catch (e) { console.error(e); S.user = null; toast('خطا در اتصال به سرور: ' + e.message, 'err'); }
    if (!S.user) return renderLogin();
  } else {
    S.store = new LocalStore(); S.user = await S.store.init();
  }
  if (S.user.role === 'none' || (S.user.role === 'user' && !(S.user.members || []).length)) return renderPending();
  await startApp();
}
let liveTmr;
async function startApp() {
  try { await loadAll(); } catch (e) { toast('خطا در دریافت اطلاعات: ' + e.message, 'err'); }
  renderShell();
  window.onhashchange = () => route();
  route();
  S.store.subscribe((what, p) => {
    clearTimeout(liveTmr);
    liveTmr = setTimeout(async () => {
      try {
        if (what === 'docs') await reloadStock();
        else if (what === 'items') { S.items = await S.store.listItems(); rebuildIndex(); }
        else if (what === 'assets') S.assets = await S.store.listAssets();
        else if (what === 'warehouses') S.warehouses = await S.store.listWarehouses();
      } catch (e) { return; }
      refreshNav();
      const r = parseHash();
      if (!S.dirty && ['dash', 'docs', 'stock', 'item', 'assets', 'reports', 'items'].includes(r.view)) route(true);
      else if (r.view === 'doc' && (p.new?.id || p.old?.id) === r.id) route(true);
    }, 400);
  });
}

/* ============================ LOGIN ============================ */
async function renderLogin(firstRun) {
  const showSetup = !(window.ANBAR_CONFIG || {}).supabaseUrl || location.hash === '#setup';
  if (firstRun === undefined) { try { firstRun = !(await S.store.hasUsers()); } catch (e) { firstRun = false; } }
  const nameI = I('<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="12" r="2.5"/><path d="M14 10h4M14 14h3"/>');
  const userI = I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>');
  const lockI = I('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="16" r="1.3"/>');
  document.body.innerHTML = `<div class="login-wrap"><div class="login">
    <div class="login-logo"><span>WMS</span></div>
    <h1>انباریار</h1>
    <div class="login-sub">سامانه انبارداری ${esc(S.settings.company || 'فولاد تکنیک')} · رسید · حواله · موجودی</div>
    ${firstRun ? '<div class="login-links" style="justify-content:center;color:var(--accent)">اولین ورود: حساب مدیر سامانه را بسازید</div>' : ''}
    <form id="lf">
      ${firstRun ? `<label class="neu-in">${nameI}<input name="full_name" placeholder="نام و نام خانوادگی" required></label>` : ''}
      <label class="neu-in">${userI}<input name="u" placeholder="نام کاربری" autocomplete="username" required dir="auto"></label>
      <label class="neu-in">${lockI}<input name="p" type="password" placeholder="رمز عبور" autocomplete="current-password" required minlength="6" dir="auto"></label>
      <button class="neu-btn">${firstRun ? 'ساخت حساب مدیر' : 'ورود'}</button>
    </form>
    ${firstRun ? '' : '<div class="login-links" style="justify-content:center">برای دریافت نام کاربری با مدیر انبار تماس بگیرید</div>'}
    ${showSetup ? `<div class="login-links" style="justify-content:center"><a href="#" id="cfgl">تنظیمات اتصال</a></div>` : ''}</div></div><div id="toasts"></div>`;
  if (showSetup) $('#cfgl').onclick = ev => { ev.preventDefault(); openConnection(); };
  $('#lf').onsubmit = async ev => {
    ev.preventDefault(); const f = ev.target;
    await busy(f.querySelector('button'), async () => {
      S.user = firstRun ? await S.store.register(f.u.value, f.p.value, f.full_name.value) : await S.store.login(f.u.value, f.p.value);
      if (S.user.role === 'none' || (S.user.role === 'user' && !(S.user.members || []).length)) return renderPending();
      await startApp();
    });
  };
}
function renderPending() {
  document.body.innerHTML = `<div class="login-wrap"><div class="card login" style="text-align:center"><div class="login-logo" style="margin:auto"><span>WMS</span></div>
    <h1>دسترسی انبار برای شما تعریف نشده</h1>
    <p class="muted">نام کاربری: <b class="mono">${esc(S.user.username)}</b><br>از مدیر انبار بخواهید برای شما نقش و انبار تعیین کند.</p>
    <button class="btn" id="lo">خروج</button></div></div>`;
  $('#lo').onclick = async () => { await S.store.logout(); location.reload(); };
}

/* ============================ SHELL ============================ */
function applyTheme(t) { document.documentElement.dataset.theme = t; localStorage.setItem('wh_theme', t); }
function renderShell() {
  const w = writableWh().length;
  document.body.innerHTML = `<div class="shell" id="shell">
    <aside class="side" id="side"></aside>
    <div class="main">
      <header class="top">
        <button class="icon-btn menu-btn" id="menuBtn">${ICON.menu}</button>
        <div class="search">${ICON.search}<input id="gsearch" type="search" placeholder="جستجوی کالا (کد، نام، مشخصات) یا شماره سند…  Ctrl+K"></div>
        <div class="spacer"></div>
        ${w ? `<div class="quick">
          <button class="btn sm qk" data-new="receipt" style="--c:${DT.receipt.color}">${ICON.in}<span>رسید</span></button>
          <button class="btn sm qk" data-new="issue" style="--c:${DT.issue.color}">${ICON.out}<span>حواله</span></button>
          <button class="btn sm qk" data-new="transfer" style="--c:${DT.transfer.color}">${ICON.swap}<span>انتقال</span></button></div>` : ''}
        <button class="icon-btn" id="themeBtn" title="تغییر پوسته">${document.documentElement.dataset.theme === 'dark' ? ICON.sun : ICON.moon}</button>
        <div class="user-chip" id="userChip"><span>${esc(S.user.full_name || S.user.username)}</span><div class="avatar">${esc((S.user.full_name || S.user.username || '?').trim()[0])}</div></div>
      </header>
      <main class="content" id="view"></main>
    </div></div><div id="toasts"></div><div id="print-area"></div>`;
  refreshNav();
  $('#menuBtn').onclick = () => $('#shell').classList.toggle('nav-open');
  $('#themeBtn').onclick = () => { applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); $('#themeBtn').innerHTML = document.documentElement.dataset.theme === 'dark' ? ICON.sun : ICON.moon; };
  $('#userChip').onclick = () => location.hash = '#/settings';
  $$('[data-new]').forEach(b => b.onclick = () => location.hash = '#/new/' + b.dataset.new);
  let tmr; $('#gsearch').oninput = ev => {
    clearTimeout(tmr); tmr = setTimeout(() => {
      const q = ev.target.value.trim();
      const d = q && S.docs.find(x => x.doc_no === faToEn(q));
      if (d && ev.inputType !== 'deleteContentBackward') { location.hash = '#/doc/' + d.id; return; }
      S.listState.stock = { ...(S.listState.stock || {}), q };
      if (parseHash().view === 'stock') renderStock(true); else location.hash = '#/stock';
    }, 250);
  };
  window.addEventListener('beforeunload', ev => { if (S.dirty) { ev.preventDefault(); ev.returnValue = ''; } });
  document.addEventListener('keydown', ev => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); $('#gsearch').focus(); }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's' && $('#docForm')) { ev.preventDefault(); $('#docForm').requestSubmit(); }
  });
}
function refreshNav() {
  const side = $('#side'); if (!side) return;
  const cur = location.hash || '#/dash';
  const vis = new Set(selWh().map(w => w.id));
  const docs = S.docs.filter(d => vis.has(d.warehouse_id) || vis.has(d.to_warehouse_id));
  const low = lowItems().length;
  const a = (href, icon, label, count, dot, hot) => `<a href="${href}" class="${cur === href || (href !== '#/dash' && cur.startsWith(href + '/')) ? 'active' : ''}">${dot ? `<span class="dot" style="background:${dot}"></span>` : icon}<span>${label}</span>${count !== undefined ? `<span class="count ${hot ? 'hot' : ''}">${count}</span>` : ''}</a>`;
  side.innerHTML = `
    <div class="brand"><div class="brand-mark">WMS</div><div><b>انباریار</b><small>${esc(S.settings.company || 'فولاد تکنیک')}</small></div></div>
    <div class="proj-select"><select id="whSel">${myWh().length > 1 ? `<option value="all">همه انبارها (${myWh().length})</option>` : ''}${myWh().map(w => `<option value="${w.id}" ${S.whId === w.id ? 'selected' : ''}>${esc(w.name)}${w.active === false ? ' (غیرفعال)' : ''}</option>`).join('')}</select></div>
    <nav class="nav">
      ${a('#/dash', ICON.dash, 'داشبورد')}
      ${a('#/stock', ICON.stock, 'موجودی انبار', low || undefined, '', true)}
      <div class="nav-label">اسناد انبار</div>
      ${a('#/docs/all', ICON.all, 'همه اسناد', docs.filter(d => d.status !== 'void').length)}
      ${DT_KEYS.map(t => a('#/docs/' + t, '', DT[t].fa, docs.filter(d => d.type === t && d.status !== 'void').length, DT[t].color)).join('')}
      <div class="nav-label">ابزار</div>
      ${a('#/items', ICON.box, 'کالاها / شناسنامه کالا', S.items.length)}
      ${a('#/assets', ICON.tag, 'اموال', S.assets.length)}
      ${a('#/reports', ICON.report, 'گزارش‌ها')}
      ${can.writeAny() ? a('#/import', ICON.import, 'ورود از اکسل') : ''}
      ${a('#/log', ICON.log, 'تاریخچه')}
      ${can.admin() ? `<div class="nav-label">مدیریت</div>
        ${a('#/warehouses', ICON.wh, 'انبارها', S.warehouses.length)}
        ${a('#/users', ICON.users, 'کاربران و دسترسی')}` : ''}
      ${a('#/settings', ICON.settings, 'تنظیمات')}
    </nav>
    <div class="side-foot">
      <span class="mode-pill ${S.store.mode}">${S.store.mode === 'online' ? '● آنلاین — اشتراکی' : '● حالت آزمایشی محلی'}</span>
      <div class="muted" style="margin-top:6px">${esc(S.user.username)} · ${ROLE_FA[S.user.role] || S.user.role}</div>
    </div>`;
  $('#whSel').onchange = ev => { S.whId = ev.target.value; localStorage.setItem('wh_sel', S.whId); refreshNav(); route(); };
  $$('#side a').forEach(x => x.addEventListener('click', () => $('#shell').classList.remove('nav-open')));
}

/* ============================ ROUTER ============================ */
function parseHash() {
  const p = (location.hash || '#/dash').slice(2).split('/');
  return { view: p[0] || 'dash', id: p[1] ? decodeURIComponent(p[1]) : null, extra: p[2] ? decodeURIComponent(p[2]) : null };
}
async function route(silent) {
  if (S.skipRoute) { S.skipRoute = false; return; }
  if (S.dirty && !silent) {
    if (!(await confirmBox('تغییرات ذخیره نشده‌اند. از فرم خارج می‌شوید؟', 'خروج بدون ذخیره'))) { S.skipRoute = true; history.back(); return; }
    S.dirty = false;
  }
  const r = parseHash();
  refreshNav();
  $$('.ac, .cal').forEach(x => x.remove());
  const v = $('#view'); if (!v) return;
  const y = window.scrollY;
  if (!silent) window.scrollTo(0, 0);
  try {
    switch (r.view) {
      case 'dash': renderDash(); break;
      case 'docs': renderDocs(r.id || 'all', silent); break;
      case 'doc': await renderDoc(r.id); break;
      case 'new': await renderForm(null, r.id, r.extra); break;
      case 'edit': await renderForm(r.id); break;
      case 'stock': renderStock(silent); break;
      case 'item': await renderItem(r.id); break;
      case 'items': renderItems(silent); break;
      case 'assets': renderAssets(silent); break;
      case 'reports': await renderReports(r.id || 'low'); break;
      case 'import': renderImport(); break;
      case 'log': await renderLog(); break;
      case 'warehouses': can.admin() ? renderWarehouses() : renderDash(); break;
      case 'users': can.admin() ? await renderUsers() : renderDash(); break;
      case 'settings': renderSettings(); break;
      default: renderDash();
    }
    if (silent) window.scrollTo(0, y);
  } catch (e) { console.error(e); v.innerHTML = `<div class="card empty"><b>خطا</b>${esc(e.message)}</div>`; }
}

/* ============================ DASHBOARD ============================ */
function lowItems(whs = selWh()) {
  return S.items.filter(i => i.active !== false && +i.min_qty > 0 && stockTotal(i.id, whs) < +i.min_qty);
}
function renderDash() {
  const whs = selWh(), vis = new Set(whs.map(w => w.id));
  const docs = S.docs.filter(d => d.status !== 'void' && (vis.has(d.warehouse_id) || vis.has(d.to_warehouse_id)));
  const today = Jalali.today(), month = today.slice(0, 7);
  const tiles = DT_KEYS.map(t => {
    const list = docs.filter(d => d.type === t);
    return `<div class="card tile" style="--c:${DT[t].color}" onclick="location.hash='#/docs/${t}'">
      <div class="t-name">${DT_ICON[t]}${DT[t].fa}</div>
      <div class="t-num">${list.filter(d => d.doc_date.startsWith(month)).length}</div>
      <div class="t-meta"><span>این ماه</span><span>امروز: <b>${list.filter(d => d.doc_date === today).length}</b></span><span>کل: <b>${list.length}</b></span></div></div>`;
  }).join('');
  const withStock = new Set(S.stock.filter(s => vis.has(s.warehouse_id) && +s.qty > 0).map(s => s.item_id));
  const low = lowItems(whs);
  const recent = [...docs].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 12);
  const whCards = whs.map(w => {
    const n = S.stock.filter(s => s.warehouse_id === w.id && +s.qty > 0).length;
    const dn = S.docs.filter(d => d.status !== 'void' && (d.warehouse_id === w.id || d.to_warehouse_id === w.id));
    const last = dn.reduce((m, d) => d.doc_date > m ? d.doc_date : m, '');
    return `<div class="card wh-card" onclick="document.getElementById('whSel').value='${w.id}';document.getElementById('whSel').dispatchEvent(new Event('change'));location.hash='#/stock'">
      <div class="wh-h">${ICON.wh}<b>${esc(w.name)}</b>${w.active === false ? '<span class="badge" style="background:#64748b1a;color:#64748b">غیرفعال</span>' : ''}${can.write(w.id) ? '<span class="mini-pill">انباردار</span>' : ''}</div>
      <div class="muted wh-s">${esc([WH_KINDS[w.kind], w.project, w.keeper_name].filter(Boolean).join(' · '))}</div>
      <div class="wh-n"><span><b class="mono">${n}</b> قلم موجود</span><span><b class="mono">${dn.length}</b> سند</span><span class="muted">آخرین: <span class="mono">${last || '—'}</span></span></div></div>`;
  }).join('');
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>داشبورد</h1><div class="sub">${S.whId === 'all' ? `همه انبارهای قابل دسترس (${whs.length})` : esc(whName(S.whId))} · ${withStock.size} قلم کالای موجود · امروز ${today}</div></div>
      <div class="actions">${writableWh().length ? DT_KEYS.map(t => `<a class="btn ${t === 'receipt' ? 'primary' : ''}" href="#/new/${t}">${DT_ICON[t]}${DT[t].short} جدید</a>`).join('') : ''}</div></div>
    <div class="tiles">${tiles}
      <div class="card tile" style="--c:#c93636" onclick="location.hash='#/reports/low'"><div class="t-name">${ICON.ban}کمتر از حداقل</div><div class="t-num" style="${low.length ? 'color:var(--danger)' : ''}">${low.length}</div><div class="t-meta"><span>قلم کالا زیر نقطه سفارش</span></div></div>
    </div>
    ${whs.length > 1 ? `<div class="wh-grid">${whCards}</div>` : ''}
    <div class="grid-2">
      <div class="card"><div class="card-h">آخرین اسناد<div class="actions"><a class="btn sm" href="#/docs/all">همه</a></div></div>
        ${recent.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>نوع</th><th>شماره</th><th>تاریخ</th><th>انبار</th><th>طرف حساب / پروژه</th><th>ثبت</th></tr></thead><tbody>
        ${recent.map(d => `<tr onclick="location.hash='#/doc/${d.id}'"><td>${dtTag(d.type)}</td><td class="mono">${esc(d.doc_no)}</td><td class="mono">${esc(d.doc_date)}</td>
          <td>${esc(whName(d.warehouse_id))}${d.to_warehouse_id ? ` ← <b>${esc(whName(d.to_warehouse_id))}</b>` : ''}</td><td class="subj">${esc([d.party, d.project].filter(Boolean).join(' · '))}</td><td class="muted" style="font-size:12px">${esc(d.created_name || '')}</td></tr>`).join('')}
        </tbody></table></div>` : `<div class="empty"><b>هنوز سندی ثبت نشده</b>${writableWh().length ? 'از دکمه «رسید جدید» یا «ورود از اکسل ← موجودی اول دوره» شروع کنید' : ''}</div>`}
      </div>
      <div class="card"><div class="card-h">کمتر از حداقل موجودی<div class="actions"><a class="btn sm" href="#/reports/low">گزارش</a></div></div>
        ${low.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>کد</th><th>کالا</th><th>موجودی</th><th>حداقل</th></tr></thead><tbody>
        ${low.slice(0, 12).map(i => `<tr onclick="location.hash='#/item/${i.id}'"><td class="mono">${esc(i.code)}</td><td class="subj">${esc(i.name)}</td>${qCell(stockTotal(i.id, whs), 'neg')}<td class="mono num">${fmtQ(i.min_qty)}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty">همه کالاها بالاتر از حداقل موجودی هستند</div>'}
      </div>
    </div>`;
}
