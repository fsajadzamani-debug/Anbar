/* لایه داده انباریار — دو حالت:
   1) Supabase (آنلاین، اشتراکی بین همه کاربران)
   2) محلی (آزمایشی، فقط روی همین مرورگر) وقتی تنظیمات اتصال وارد نشده */

const EMAIL_DOMAIN = '@anbaryar.app';         // ورود با نام کاربری؛ ایمیل واقعی ارسال نمی‌شود
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
const SIGN = { receipt: 1, return: 1, issue: -1, transfer: -1, adjust: 1 };

function getConfig() {
  try {
    const p = new URLSearchParams(location.search).get('cfg');
    if (p) {
      const c = JSON.parse(decodeURIComponent(escape(atob(p))));
      if (c.url && c.key) { localStorage.setItem('wh_cfg', JSON.stringify(c)); history.replaceState(null, '', location.pathname); }
    }
  } catch (e) { /* ignore */ }
  try { const c = JSON.parse(localStorage.getItem('wh_cfg') || 'null'); if (c && c.url && c.key) return c; } catch (e) { /* ignore */ }
  const c = window.ANBAR_CONFIG || {};
  return c.supabaseUrl && c.supabaseKey ? { url: c.supabaseUrl, key: c.supabaseKey } : null;
}
function inviteLink(cfg) {
  const b = btoa(unescape(encodeURIComponent(JSON.stringify({ url: cfg.url, key: cfg.key }))));
  return location.origin + location.pathname + '?cfg=' + b;
}
const errFa = m => {
  m = String(m || '');
  if (/row-level security/i.test(m)) return 'شما اجازه این کار را ندارید';
  if (/foreign key.*wh_lines|wh_lines.*foreign key|wh_lines_item_id_fkey/i.test(m) || /still referenced/i.test(m)) return 'این مورد در اسناد استفاده شده و قابل حذف نیست؛ می‌توانید آن را غیرفعال کنید';
  if (/duplicate key.*code/i.test(m)) return 'این کد قبلاً ثبت شده است';
  if (/duplicate key.*tag_no/i.test(m)) return 'این شماره اموال قبلاً ثبت شده است';
  if (/wh_(save_doc|role|stock|profiles|has_users)|relation .*wh_|schema cache/i.test(m)) return 'جدول‌های انبار در Supabase ساخته نشده‌اند — فایل supabase/schema.sql را اجرا کنید';
  return m;
};

/* ===================== Supabase ===================== */
class SupaStore {
  constructor(cfg) {
    this.mode = 'online';
    this.cfg = cfg;
    // ورود فقط برای همین پنجره/تب نگه داشته می‌شود؛ با بستن برنامه دوباره صفحه ورود می‌آید
    try { localStorage.removeItem('wh-auth'); } catch (e) { /* ignore */ }
    let store; try { sessionStorage.getItem('x'); store = sessionStorage; } catch (e) { store = undefined; }
    this.sb = supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: !!store, storage: store, storageKey: 'wh-auth' } });
    this.user = null;
  }
  _check({ data, error }) { if (error) throw new Error(errFa(error.message)); return data; }
  async init() {
    const { data } = await this.sb.auth.getSession();
    if (data.session) await this._loadProfile(data.session.user);
    return this.user;
  }
  async _loadProfile(authUser) {
    const { data, error } = await this.sb.from('wh_profiles').select('*').eq('id', authUser.id).maybeSingle();
    if (error) throw new Error(errFa(error.message));
    const p = data || { id: authUser.id, username: authUser.email.split('@')[0] };
    const r = await this.sb.rpc('wh_role');
    if (r.error) throw new Error(errFa(r.error.message));
    const mem = this._check(await this.sb.from('wh_members').select('*').eq('user_id', p.id));
    this.user = { ...p, role: r.data, members: mem };
    return this.user;
  }
  async login(username, password) {
    const email = username.trim().toLowerCase() + EMAIL_DOMAIN;
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message.includes('Invalid') ? 'نام کاربری یا رمز عبور اشتباه است' : error.message);
    return this._loadProfile(data.user);
  }
  async hasUsers() { const r = await this.sb.rpc('wh_has_users'); if (r.error) throw new Error(errFa(r.error.message)); return r.data; }
  async register(username, password, full_name) {   // فقط برای ساخت اولین مدیر
    const uname = username.trim().toLowerCase();
    const { data, error } = await this.sb.auth.signUp({ email: uname + EMAIL_DOMAIN, password, options: { data: { username: uname, full_name } } });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('در Supabase بخش Authentication → Sign In / Providers → Email گزینه Confirm email را خاموش کنید و دوباره وارد شوید.');
    return this._loadProfile(data.user);
  }
  async logout() { await this.sb.auth.signOut(); this.user = null; }
  async changePassword(pw) { const { error } = await this.sb.auth.updateUser({ password: pw }); if (error) throw new Error(error.message); }
  async updateMyName(full_name) { this._check(await this.sb.from('wh_profiles').update({ full_name }).eq('id', this.user.id)); this.user.full_name = full_name; }

  /* ---------- کاربران ---------- */
  async listUsers() { return this._check(await this.sb.rpc('wh_list_users')); }
  async setUserAccess(id, role, members) { this._check(await this.sb.rpc('wh_admin_set_user', { target: id, new_role: role, members })); }
  async setPassword(id, pw) { this._check(await this.sb.rpc('wh_admin_set_password', { target: id, new_password: pw })); }
  async deleteUser(id) { this._check(await this.sb.rpc('wh_admin_delete_user', { target: id })); }
  async renameUser(id, username, full_name) {
    const r = await this.sb.rpc('wh_admin_rename_user', { target: id, new_username: username, new_full_name: full_name });
    if (r.error) throw new Error(/could not find the function|schema cache/i.test(r.error.message) ? 'تابع تغییر نام در دیتابیس پیدا نشد — فایل patch-rename-user.sql را در Supabase اجرا کنید (' + r.error.message + ')' : 'خطای تغییر نام: ' + r.error.message);
  }
  async createUser({ username, password, full_name }) {
    const tmp = supabase.createClient(this.cfg.url, this.cfg.key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'wh-tmp' } });
    const uname = username.trim().toLowerCase();
    const { data, error } = await tmp.auth.signUp({ email: uname + EMAIL_DOMAIN, password, options: { data: { username: uname, full_name } } });
    if (error) throw new Error(error.message.includes('registered') ? 'این نام کاربری قبلاً ثبت شده' : error.message);
    if (!data.user || (data.user.identities && !data.user.identities.length)) throw new Error('این نام کاربری قبلاً ثبت شده');
    // پروفایل توسط تریگر دیتابیس ساخته می‌شود؛ کمی صبر تا آماده شود
    for (let i = 0; i < 8; i++) {
      const u = (await this.listUsers()).find(x => x.id === data.user.id);
      if (u) return u;
      await new Promise(r => setTimeout(r, 400));
    }
    return { id: data.user.id, username: uname, full_name };
  }

  /* ---------- انبارها ---------- */
  async listWarehouses() { return this._check(await this.sb.from('wh_warehouses').select('*').order('sort').order('created_at')); }
  async saveWarehouse(w) {
    const row = { ...w }; delete row.created_at;
    if (row.id) return this._check(await this.sb.from('wh_warehouses').update(row).eq('id', row.id).select())[0];
    delete row.id; return this._check(await this.sb.from('wh_warehouses').insert(row).select())[0];
  }
  async deleteWarehouse(id) {
    const r = await this.sb.from('wh_warehouses').delete().eq('id', id);
    if (r.error) throw new Error(/foreign key|referenced/i.test(r.error.message) ? 'این انبار سند دارد و قابل حذف نیست؛ آن را غیرفعال کنید' : errFa(r.error.message));
  }

  /* ---------- کالاها ---------- */
  async _all(table, cols = '*', order = 'created_at', build = q => q) {
    const out = []; let from = 0;
    for (;;) {
      const rows = this._check(await build(this.sb.from(table).select(cols)).order(order).range(from, from + 999));
      out.push(...rows); if (rows.length < 1000) break; from += 1000;
    }
    return out;
  }
  async listItems() { return this._all('wh_items', '*', 'code'); }
  async saveItem(it) {
    const row = { ...it }; delete row.created_at; delete row.created_by;
    if (row.id) return this._check(await this.sb.from('wh_items').update(row).eq('id', row.id).select())[0];
    delete row.id; return this._check(await this.sb.from('wh_items').insert(row).select())[0];
  }
  async insertItems(rows) {
    const out = [];
    for (let i = 0; i < rows.length; i += 500) out.push(...this._check(await this.sb.from('wh_items').insert(rows.slice(i, i + 500)).select()));
    return out;
  }
  async deleteItem(id) { this._check(await this.sb.from('wh_items').delete().eq('id', id)); }

  /* ---------- اسناد ---------- */
  async listDocs() { return this._all('wh_docs', '*', 'created_at'); }
  async getDoc(id) { return this._check(await this.sb.from('wh_docs').select('*').eq('id', id).maybeSingle()); }
  async getLines(docId) { return this._check(await this.sb.from('wh_lines').select('*').eq('doc_id', docId).order('sort')); }
  async saveDoc(doc, lines, force = false) {
    const r = await this.sb.rpc('wh_save_doc', { p: { ...doc, lines, force } });
    if (r.error) throw new Error(errFa(r.error.message));
    return r.data;
  }
  async voidDoc(id, reason, force = false) { this._check(await this.sb.rpc('wh_void_doc', { doc: id, reason, force })); }
  async deleteDoc(id) { this._check(await this.sb.from('wh_docs').delete().eq('id', id)); }

  /* ---------- موجودی و گردش ---------- */
  async listStock() { return this._all('wh_stock', '*', 'item_id'); }
  async listMoves({ item_id, warehouse_id, from, to } = {}) {
    return this._all('wh_moves', '*', 'doc_date', q => {
      if (item_id) q = q.eq('item_id', item_id);
      if (warehouse_id) q = q.eq('warehouse_id', warehouse_id);
      if (from) q = q.gte('doc_date', from);
      if (to) q = q.lte('doc_date', to);
      return q;
    });
  }

  /* ---------- اموال ---------- */
  async listAssets() { return this._all('wh_assets', '*', 'tag_no'); }
  async saveAsset(a) {
    const row = { ...a, updated_at: new Date().toISOString() }; delete row.created_at;
    if (row.id) return this._check(await this.sb.from('wh_assets').update(row).eq('id', row.id).select())[0];
    delete row.id; return this._check(await this.sb.from('wh_assets').insert(row).select())[0];
  }
  async deleteAsset(id) { this._check(await this.sb.from('wh_assets').delete().eq('id', id)); }
  async assetLog(id) { return this._check(await this.sb.from('wh_asset_log').select('*').eq('asset_id', id).order('at', { ascending: false })); }
  async addAssetLog(asset_id, action, details) { await this.sb.from('wh_asset_log').insert({ asset_id, action, details, username: this.user.full_name || this.user.username }); }

  /* ---------- تاریخچه و تنظیمات ---------- */
  async addLog(e) { await this.sb.from('wh_log').insert({ ...e, username: this.user.full_name || this.user.username }); }
  async listLog(limit = 300) { return this._check(await this.sb.from('wh_log').select('*').order('at', { ascending: false }).limit(limit)); }
  async getSettings() { const rows = this._check(await this.sb.from('wh_settings').select('*')); return Object.fromEntries(rows.map(r => [r.key, r.value])); }
  async saveSetting(key, value) { this._check(await this.sb.from('wh_settings').upsert({ key, value })); }

  /* ---------- چت سازمانی ---------- */
  _chatErr(m) { return /wh_chat|relation|schema cache|wh_in_room/i.test(m) ? 'CHAT_NOT_SETUP' : /row-level/i.test(m) ? 'شما توسط مدیر در حالت سکوت هستید' : m; }
  async listChatUsers() { return this._check(await this.sb.from('wh_profiles').select('id,username,full_name').order('full_name')); }
  async listChat(room, beforeId = null, limit = 120) {
    let q = this.sb.from('wh_chat').select('*').eq('room', room).order('id', { ascending: false }).limit(limit);
    if (beforeId) q = q.lt('id', beforeId);
    const r = await q; if (r.error) throw new Error(this._chatErr(r.error.message));
    return r.data.reverse();
  }
  async chatSummary() {   // آخرین پیام‌های همه اتاق‌های من، برای فهرست گفتگوها و شمارش خوانده‌نشده
    const r = await this.sb.from('wh_chat').select('id,room,user_id,username,body,created_at').order('id', { ascending: false }).limit(800);
    if (r.error) throw new Error(this._chatErr(r.error.message)); return r.data;
  }
  async sendChat(room, body, reply_to = null) {
    const r = await this.sb.from('wh_chat').insert({ room, body, reply_to }).select();
    if (r.error) throw new Error(this._chatErr(r.error.message)); return r.data[0];
  }
  async editChat(id, body) {
    const r = await this.sb.from('wh_chat').update({ body }).eq('id', id).select();
    if (r.error) throw new Error(this._chatErr(r.error.message)); if (!r.data.length) throw new Error('امکان ویرایش این پیام نیست');
    return r.data[0];
  }
  async deleteChat(id) { const r = await this.sb.from('wh_chat').delete().eq('id', id).select('id'); if (r.error) throw new Error(this._chatErr(r.error.message)); if (!r.data.length) throw new Error('امکان حذف این پیام نیست'); }
  async mutedList() { const r = await this.sb.rpc('wh_muted_list'); return r.error ? [] : r.data.map(x => x.wh_muted_list || x); }
  async setMute(id, mute) { this._check(await this.sb.rpc('wh_admin_set_mute', { target: id, mute })); }
  async amMuted() { const r = await this.sb.rpc('wh_is_muted'); return !r.error && r.data === true; }
  presence(me, onSync) {   // وضعیت آنلاین کاربران
    this.pres = this.sb.channel('wh-presence', { config: { presence: { key: me } } });
    this.pres.on('presence', { event: 'sync' }, () => onSync(new Set(Object.keys(this.pres.presenceState()))))
      .subscribe(st => { if (st === 'SUBSCRIBED') this.pres.track({ at: Date.now() }); });
  }

  subscribe(cb) {
    this.channel = this.sb.channel('wh-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wh_chat' }, p => cb('chat', p))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wh_users' }, p => cb('whuser', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wh_docs' }, p => cb('docs', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wh_items' }, p => cb('items', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wh_assets' }, p => cb('assets', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wh_warehouses' }, p => cb('warehouses', p))
      .subscribe();
  }
}

/* ===================== محلی (آزمایشی) ===================== */
class LocalStore {
  constructor() {
    this.mode = 'local';
    this.user = { id: 'local', username: 'admin', full_name: 'مدیر (محلی)', role: 'admin', members: [] };
  }
  _get(k, d) {
    try { const v = localStorage.getItem('whl_' + k); if (v !== null) return JSON.parse(v) ?? d; } catch (e) { /* storage blocked */ }
    return (LocalStore.mem || {})[k] ?? d;
  }
  _set(k, v) {
    (LocalStore.mem = LocalStore.mem || {})[k] = v;
    try { localStorage.setItem('whl_' + k, JSON.stringify(v)); } catch (e) { /* فقط در حافظه */ }
  }
  async init() {
    if (window.ANBAR_DEMO_SEED && !this._get('seeded', false)) {
      const s = window.ANBAR_DEMO_SEED;
      ['warehouses', 'items', 'docs', 'lines', 'assets'].forEach(k => s[k] && this._set(k, s[k]));
      this._set('seeded', true);
    }
    return this.user;
  }
  async logout() { }
  async changePassword() { }
  async updateMyName(n) { this.user.full_name = n; }
  async listUsers() { return [{ id: 'local', username: 'admin', full_name: 'مدیر (محلی)', wh_role: 'admin', members: [] }]; }
  async deleteUser() { throw new Error('در حالت محلی فعال نیست'); }
  async renameUser() { throw new Error('در حالت محلی فعال نیست'); }
  async setUserAccess() { throw new Error('در حالت محلی مدیریت کاربران فعال نیست'); }
  async setPassword() { throw new Error('در حالت محلی فعال نیست'); }
  async createUser() { throw new Error('در حالت محلی ساخت کاربر فعال نیست؛ ابتدا اتصال Supabase را تنظیم کنید'); }

  _save(k, row) {
    const list = this._get(k, []); const now = new Date().toISOString();
    if (row.id) { const i = list.findIndex(x => x.id === row.id); if (i >= 0) { list[i] = { ...list[i], ...row }; this._set(k, list); return list[i]; } }
    const r = { ...row, id: row.id || uid(), created_at: now }; list.push(r); this._set(k, list); return r;
  }
  _uniq(k, field, row, msg) { if (this._get(k, []).some(x => x.id !== row.id && row[field] && String(x[field]).toLowerCase() === String(row[field]).toLowerCase())) throw new Error(msg); }
  async listWarehouses() { return this._get('warehouses', []).sort((a, b) => (a.sort ?? 100) - (b.sort ?? 100) || String(a.created_at).localeCompare(b.created_at)); }
  async saveWarehouse(w) { this._uniq('warehouses', 'code', w, 'این کد انبار قبلاً ثبت شده'); return this._save('warehouses', { active: true, sort: 100, kind: 'site', ...w }); }
  async deleteWarehouse(id) {
    if (this._get('docs', []).some(d => d.warehouse_id === id || d.to_warehouse_id === id)) throw new Error('این انبار سند دارد و قابل حذف نیست؛ آن را غیرفعال کنید');
    this._set('warehouses', this._get('warehouses', []).filter(x => x.id !== id));
  }
  async listItems() { return this._get('items', []).sort((a, b) => String(a.code).localeCompare(b.code, undefined, { numeric: true })); }
  async saveItem(it) { this._uniq('items', 'code', it, 'این کد قبلاً ثبت شده است'); return this._save('items', { active: true, min_qty: 0, unit: 'عدد', kind: 'material', ...it }); }
  async insertItems(rows) { return rows.map(r => { this._uniq('items', 'code', r, `کد ${r.code} تکراری است`); return this._save('items', { active: true, min_qty: 0, ...r }); }); }
  async deleteItem(id) {
    if (this._get('lines', []).some(l => l.item_id === id)) throw new Error('این مورد در اسناد استفاده شده و قابل حذف نیست؛ می‌توانید آن را غیرفعال کنید');
    this._set('items', this._get('items', []).filter(x => x.id !== id));
  }

  async listDocs() { return this._get('docs', []); }
  async getDoc(id) { return this._get('docs', []).find(d => d.id === id) || null; }
  async getLines(docId) { return this._get('lines', []).filter(l => l.doc_id === docId).sort((a, b) => a.sort - b.sort); }
  _moves() {
    const docs = Object.fromEntries(this._get('docs', []).filter(d => d.status === 'final').map(d => [d.id, d]));
    const out = [];
    this._get('lines', []).forEach(l => {
      const d = docs[l.doc_id]; if (!d) return;
      const base = { line_id: l.id, doc_id: d.id, item_id: l.item_id, doc_no: d.doc_no, doc_date: d.doc_date, created_at: d.created_at, party: d.party, project: d.project, note: l.note };
      out.push({ ...base, warehouse_id: d.warehouse_id, type: d.type, qty: SIGN[d.type] * l.qty, other_warehouse_id: d.to_warehouse_id || null });
      if (d.type === 'transfer') out.push({ ...base, warehouse_id: d.to_warehouse_id, type: 'transfer_in', qty: +l.qty, other_warehouse_id: d.warehouse_id });
    });
    return out;
  }
  _bal(w, it) { return this._moves().filter(m => m.warehouse_id === w && m.item_id === it).reduce((a, m) => a + m.qty, 0); }
  _checkNeg(w, items) {
    if (!w || this._get('settings', {}).allow_negative === true) return;
    const bad = [...new Set(items)].map(id => ({ id, b: this._bal(w, id) })).filter(x => x.b < -1e-9);
    if (bad.length) {
      const all = this._get('items', []);
      throw new Error('موجودی کافی نیست: ' + bad.map(x => { const it = all.find(i => i.id === x.id) || {}; return `${it.code} ${it.name} (${+x.b.toFixed(3)})`; }).join('، '));
    }
  }
  async saveDoc(doc, lines, force = false) {
    const t = doc.type;
    if (!doc.warehouse_id) throw new Error('انبار را انتخاب کنید');
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(doc.doc_date || '')) throw new Error('تاریخ سند نامعتبر است (مثال 1405/07/13)');
    if (t === 'transfer' && (!doc.to_warehouse_id || doc.to_warehouse_id === doc.warehouse_id)) throw new Error('انبار مقصد انتقال را درست انتخاب کنید');
    if (!lines.length) throw new Error('حداقل یک ردیف کالا لازم است');
    lines.forEach((l, i) => { if (!+l.qty) throw new Error(`مقدار ردیف ${i + 1} وارد نشده`); if (t !== 'adjust' && +l.qty < 0) throw new Error(`مقدار ردیف ${i + 1} نباید منفی باشد`); });
    const backup = { docs: this._get('docs', []), lines: this._get('lines', []) };
    const docs = [...backup.docs];
    let old = doc.id ? docs.find(d => d.id === doc.id) : null;
    const oldItems = old ? backup.lines.filter(l => l.doc_id === old.id).map(l => l.item_id) : [];
    let no = (doc.doc_no || '').trim();
    if (!no) {
      const yy = doc.doc_date.slice(0, 4);
      const max = docs.filter(d => d.warehouse_id === doc.warehouse_id && d.type === t && String(d.doc_no).startsWith(yy + '-')).reduce((m, d) => Math.max(m, +(String(d.doc_no).match(/(\d+)\s*$/) || [0, 0])[1]), 0);
      no = yy + '-' + String(max + 1).padStart(4, '0');
    }
    if (docs.some(d => d.id !== doc.id && d.warehouse_id === doc.warehouse_id && d.type === t && d.doc_no === no)) throw new Error(`شماره سند «${no}» در این انبار قبلاً ثبت شده است`);
    const now = new Date().toISOString();
    const row = { status: 'final', ...(old || {}), ...doc, doc_no: no, to_warehouse_id: t === 'transfer' ? doc.to_warehouse_id : null, updated_at: now };
    if (!old) Object.assign(row, { id: uid(), created_at: now, created_name: this.user.full_name });
    const nd = old ? docs.map(d => d.id === row.id ? row : d) : [...docs, row];
    const nl = backup.lines.filter(l => l.doc_id !== row.id).concat(lines.map((l, i) => ({ id: uid(), doc_id: row.id, item_id: l.item_id, qty: +l.qty, note: l.note || null, sort: i + 1 })));
    this._set('docs', nd); this._set('lines', nl);
    try {
      if (!force) {
        this._checkNeg(row.warehouse_id, [...lines.map(l => l.item_id), ...oldItems]);
        if (old && old.warehouse_id !== row.warehouse_id) this._checkNeg(old.warehouse_id, oldItems);
        if (old && old.to_warehouse_id) this._checkNeg(old.to_warehouse_id, oldItems);
      }
    } catch (e) { this._set('docs', backup.docs); this._set('lines', backup.lines); throw e; }
    this.addLog({ warehouse_id: row.warehouse_id, entity: 'doc', entity_id: row.id, label: t + ' ' + no, action: old ? 'update' : 'create', details: lines.length + ' ردیف' });
    return row;
  }
  async voidDoc(id, reason, force = false) {
    const docs = this._get('docs', []); const d = docs.find(x => x.id === id); if (!d || d.status === 'void') return;
    const backup = [...docs.map(x => ({ ...x }))];
    d.status = 'void'; d.void_reason = reason; this._set('docs', docs);
    const items = this._get('lines', []).filter(l => l.doc_id === id).map(l => l.item_id);
    try { if (!force) { this._checkNeg(d.warehouse_id, items); if (d.to_warehouse_id) this._checkNeg(d.to_warehouse_id, items); } }
    catch (e) { this._set('docs', backup); throw e; }
    this.addLog({ warehouse_id: d.warehouse_id, entity: 'doc', entity_id: id, label: d.type + ' ' + d.doc_no, action: 'void', details: reason });
  }
  async deleteDoc(id) { this._set('docs', this._get('docs', []).filter(d => d.id !== id)); this._set('lines', this._get('lines', []).filter(l => l.doc_id !== id)); }
  async listStock() {
    const m = new Map();
    this._moves().forEach(x => {
      const k = x.warehouse_id + '|' + x.item_id;
      const s = m.get(k) || { warehouse_id: x.warehouse_id, item_id: x.item_id, qty: 0, last_date: '', last_out: null, moves: 0 };
      s.qty += x.qty; s.moves++; if (x.doc_date > s.last_date) s.last_date = x.doc_date;
      if (x.qty < 0 && (!s.last_out || x.doc_date > s.last_out)) s.last_out = x.doc_date;
      m.set(k, s);
    });
    return [...m.values()];
  }
  async listMoves({ item_id, warehouse_id, from, to } = {}) {
    return this._moves().filter(x => (!item_id || x.item_id === item_id) && (!warehouse_id || x.warehouse_id === warehouse_id) && (!from || x.doc_date >= from) && (!to || x.doc_date <= to))
      .sort((a, b) => a.doc_date.localeCompare(b.doc_date) || String(a.created_at).localeCompare(b.created_at));
  }
  async listAssets() { return this._get('assets', []); }
  async saveAsset(a) { this._uniq('assets', 'tag_no', a, 'این شماره اموال قبلاً ثبت شده است'); return this._save('assets', { status: 'in_stock', ...a, updated_at: new Date().toISOString() }); }
  async deleteAsset(id) { this._set('assets', this._get('assets', []).filter(x => x.id !== id)); }
  async assetLog(id) { return this._get('alog', []).filter(x => x.asset_id === id).reverse(); }
  async addAssetLog(asset_id, action, details) { const l = this._get('alog', []); l.push({ id: l.length + 1, asset_id, action, details, username: this.user.full_name, at: new Date().toISOString() }); this._set('alog', l); }
  async addLog(e) { const l = this._get('log', []); l.push({ ...e, id: l.length + 1, username: this.user.full_name, at: new Date().toISOString() }); this._set('log', l.slice(-1000)); }
  async listLog(limit = 300) { return this._get('log', []).slice(-limit).reverse(); }
  async getSettings() { return { company: 'فولاد تکنیک', allow_negative: false, ...this._get('settings', {}) }; }
  async saveSetting(k, v) { const s = this._get('settings', {}); s[k] = v; this._set('settings', s); }
  /* چت در حالت محلی (آزمایشی) */
  async listChatUsers() { return [{ id: 'local', username: 'admin', full_name: 'مدیر (محلی)' }, { id: 'u2', username: 'anbar01', full_name: 'انباردار پالایشگاه' }, { id: 'u3', username: 'anbar02', full_name: 'انباردار نیروگاه' }]; }
  _chat() { return this._get('chat', []); }
  async listChat(room) { return this._chat().filter(m => m.room === room); }
  async chatSummary() { return [...this._chat()].reverse(); }
  async sendChat(room, body, reply_to = null) { const l = this._chat(); const m = { id: (l.at(-1)?.id || 0) + 1, room, body, reply_to, user_id: 'local', username: this.user.full_name, created_at: new Date().toISOString() }; l.push(m); this._set('chat', l); this._cb?.('chat', { eventType: 'INSERT', new: m }); return m; }
  async editChat(id, body) { const l = this._chat(); const m = l.find(x => x.id === id); m.body = body; m.edited_at = new Date().toISOString(); this._set('chat', l); this._cb?.('chat', { eventType: 'UPDATE', new: m }); return m; }
  async deleteChat(id) { this._set('chat', this._chat().filter(x => x.id !== id)); this._cb?.('chat', { eventType: 'DELETE', old: { id } }); }
  async mutedList() { return this._get('muted', []); }
  async setMute(id, mute) { const l = new Set(this._get('muted', [])); mute ? l.add(id) : l.delete(id); this._set('muted', [...l]); }
  async amMuted() { return false; }
  presence(me, onSync) { onSync(new Set([me, 'u2'])); }
  subscribe(cb) { this._cb = cb; }
}
