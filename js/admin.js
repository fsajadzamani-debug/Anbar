/* ======================================================
   انباریار — مدیریت: انبارها، کاربران، ورود اکسل، تاریخچه، تنظیمات
   ====================================================== */

/* ============================ انبارها ============================ */
function renderWarehouses() {
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>انبارها</h1><div class="sub">${S.warehouses.length} انبار · ${S.warehouses.filter(w => w.active !== false).length} فعال</div></div>
      <div class="actions"><button class="btn primary" id="add">${ICON.plus}انبار جدید</button></div></div>
    <div class="card">${S.warehouses.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>کد</th><th>نام انبار</th><th>نوع</th><th>پروژه / کارگاه</th><th>محل</th><th>انباردار</th><th>تلفن</th><th class="num">قلم موجود</th><th>وضعیت</th></tr></thead><tbody>
      ${S.warehouses.map(w => `<tr data-id="${w.id}" class="${w.active === false ? 'inactive' : ''}"><td class="mono">${esc(w.code || '')}</td><td><b>${esc(w.name)}</b></td><td>${esc(WH_KINDS[w.kind] || '')}</td><td>${esc(w.project || '')}</td><td class="muted">${esc(w.location || '')}</td>
        <td>${esc(w.keeper_name || '')}</td><td class="mono">${esc(w.phone || '')}</td><td class="mono num">${S.stock.filter(s => s.warehouse_id === w.id && +s.qty > 0).length}</td><td>${w.active === false ? 'غیرفعال' : '<span style="color:var(--ok)">فعال</span>'}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="empty"><b>هنوز انباری تعریف نشده</b>اول انبارها (مرکزی و کارگاه‌ها) را تعریف کنید، بعد از «کاربران و دسترسی» انباردار هر انبار را تعیین کنید.</div>`}</div>`;
  $('#add').onclick = () => whModal(null);
  $$('tbody tr[data-id]').forEach(r => r.onclick = () => whModal(S.warehouses.find(w => w.id === r.dataset.id)));
}
function whModal(w) {
  const isNew = !w; w = w || { kind: 'site', active: true, sort: (S.warehouses.length + 1) * 10 };
  const m = modal(isNew ? 'انبار جدید' : 'ویرایش انبار', `
    <div class="fgrid" style="--cols:2">
      <div class="fld wide"><label class="l">نام انبار *</label><input id="wName" value="${esc(w.name)}" dir="auto"></div>
      <div class="fld"><label class="l">کد انبار</label><input id="wCode" value="${esc(w.code)}" class="mono" dir="ltr" placeholder="WH-01"></div>
      <div class="fld"><label class="l">نوع</label><select id="wKind">${Object.entries(WH_KINDS).map(([k, v]) => `<option value="${k}" ${w.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="fld"><label class="l">پروژه / کارگاه</label><input id="wProj" value="${esc(w.project)}" dir="auto"></div>
      <div class="fld"><label class="l">محل / آدرس</label><input id="wLoc" value="${esc(w.location)}" dir="auto"></div>
      <div class="fld"><label class="l">نام انباردار</label><input id="wKeep" value="${esc(w.keeper_name)}" dir="auto"></div>
      <div class="fld"><label class="l">تلفن</label><input id="wPh" value="${esc(w.phone)}" class="mono" dir="ltr"></div>
      <div class="fld"><label class="l">ترتیب نمایش</label><input id="wSort" value="${esc(w.sort ?? 100)}" class="mono" dir="ltr"></div>
      <div class="fld"><label class="l">وضعیت</label><select id="wAct"><option value="1">فعال</option><option value="0" ${w.active === false ? 'selected' : ''}>غیرفعال (بسته‌شده)</option></select></div>
    </div>`, { footer: `<button class="btn primary" id="wSave">ذخیره</button>${!isNew ? `<button class="btn danger" id="wDel">${ICON.trash}حذف</button>` : ''}<button class="btn" data-close>انصراف</button>` });
  $('#wName', m.el).focus();
  $('#wSave', m.el).onclick = ev => busy(ev.target, async () => {
    const row = { ...(isNew ? {} : { id: w.id }), name: $('#wName', m.el).value.trim(), code: $('#wCode', m.el).value.trim() || null, kind: $('#wKind', m.el).value, project: $('#wProj', m.el).value.trim() || null,
      location: $('#wLoc', m.el).value.trim() || null, keeper_name: $('#wKeep', m.el).value.trim() || null, phone: faToEn($('#wPh', m.el).value.trim()) || null, sort: num($('#wSort', m.el).value) || 100, active: $('#wAct', m.el).value === '1' };
    if (!row.name) throw new Error('نام انبار لازم است');
    const saved = await S.store.saveWarehouse(row);
    if (isNew) S.warehouses.push(saved); else Object.assign(w, saved);
    S.warehouses.sort((a, b) => (a.sort ?? 100) - (b.sort ?? 100));
    await log(isNew ? 'create' : 'update', 'warehouse', saved.name, '', saved.id);
    m.close(); toast('ذخیره شد', 'ok'); refreshNav(); renderWarehouses();
  });
  if ($('#wDel', m.el)) $('#wDel', m.el).onclick = async () => {
    if (!(await confirmBox(`انبار «${esc(w.name)}» حذف شود؟ (انبار دارای سند حذف نمی‌شود؛ غیرفعالش کنید)`, 'حذف'))) return;
    await busy(null, async () => { await S.store.deleteWarehouse(w.id); S.warehouses = S.warehouses.filter(x => x.id !== w.id); m.close(); refreshNav(); renderWarehouses(); });
  };
}

/* ============================ کاربران ============================ */
async function renderUsers() {
  const users = await S.store.listUsers();
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>کاربران و دسترسی انبار</h1><div class="sub">${users.length} کاربر</div></div>
      <div class="actions"><button class="btn primary" id="add">${ICON.plus}کاربر جدید</button></div></div>
    <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>نام</th><th>نام کاربری</th><th>نقش</th><th>انبارها</th></tr></thead><tbody>
      ${users.map(u => `<tr data-id="${u.id}" class="${u.wh_role === 'none' ? 'inactive' : ''}"><td><b>${esc(u.full_name || '')}</b></td><td class="mono">${esc(u.username)}</td>
        <td>${u.wh_role === 'admin' ? '<b style="color:var(--accent)">مدیر انبار</b>' : esc(ROLE_FA[u.wh_role] || u.wh_role)}${u.id === S.user.id ? ' <small class="muted">(شما)</small>' : ''}</td>
        <td style="font-size:12.5px">${u.wh_role === 'user' ? (u.members || []).map(m => `<span class="mini-pill ${m.role}">${esc(whName(m.warehouse_id))} · ${MEM_FA[m.role]}</span>`).join(' ') || '<span class="neg">هیچ انباری</span>' : u.wh_role === 'none' ? '' : '<span class="muted">همه انبارها</span>'}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card" style="margin-top:14px"><div class="card-b muted" style="font-size:13px;line-height:2.1">
      <b>مدیر انبار:</b> همه انبارها، تعریف انبار/کالا/کاربر، ویرایش و ابطال سند · <b>ناظر:</b> مشاهده و گزارش همه انبارها بدون ثبت ·
      <b>کاربر انبار:</b> فقط انبارهای تعیین‌شده؛ در هر انبار «انباردار» (ثبت رسید/حواله) یا «مشاهده».<br>
      برای غیرفعال کردن کسی، نقشش را «بدون دسترسی» بگذارید.
    </div></div>`;
  $('#add').onclick = () => userModal(null, users);
  $$('tbody tr[data-id]').forEach(r => r.onclick = () => userModal(users.find(u => u.id === r.dataset.id), users));
}
function userModal(u, users) {
  const isNew = !u; u = u || { wh_role: 'user', members: [] };
  const mem = Object.fromEntries((u.members || []).map(m => [m.warehouse_id, m.role]));
  const locked = u.id === S.user.id;
  const m = modal(isNew ? 'کاربر جدید' : 'دسترسی ' + esc(u.full_name || u.username), `
    ${isNew ? `<div class="fgrid" style="--cols:2;margin-bottom:14px">
      <div class="fld"><label class="l">نام و نام خانوادگی *</label><input id="uName" dir="auto"></div>
      <div class="fld"><label class="l">نام کاربری * <small>انگلیسی</small></label><input id="uUser" class="mono" dir="ltr"></div>
      <div class="fld"><label class="l">رمز عبور * <small>حداقل ۶</small></label><input id="uPw" class="mono" dir="ltr"></div></div>
` :
      `<p class="muted" style="margin-top:0">نام کاربری: <b class="mono">${esc(u.username)}</b></p>`}
    ${locked ? '<div class="warn-box card">این حساب خودتان است؛ نقش خودتان را نمی‌توانید تغییر دهید. رمزتان را از «تنظیمات» عوض کنید.</div>' : `
    <div class="form-row"><label>نقش در انبار</label><select id="uRole">${Object.entries(ROLE_FA).map(([k, v]) => `<option value="${k}" ${u.wh_role === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div id="memBox" class="${u.wh_role === 'user' ? '' : 'hidden'}"><label style="font-size:12.5px;font-weight:600">انبارهای مجاز</label>
      <div class="mem-list">${S.warehouses.map(w => `<div class="mem-row"><span>${esc(w.name)}${w.active === false ? ' <small class="muted">(غیرفعال)</small>' : ''}</span>
        <select data-w="${w.id}"><option value="">—</option><option value="keeper" ${mem[w.id] === 'keeper' ? 'selected' : ''}>انباردار</option><option value="viewer" ${mem[w.id] === 'viewer' ? 'selected' : ''}>مشاهده</option></select></div>`).join('') || '<div class="muted">اول انبارها را تعریف کنید</div>'}</div></div>`}
    ${!isNew && !locked ? `<div class="form-row" style="margin-top:14px"><label>تغییر رمز عبور</label><div style="display:flex;gap:6px"><input id="uNewPw" class="mono" dir="ltr" style="flex:1" placeholder="رمز جدید"><button class="btn" id="uSetPw">${ICON.key}تغییر رمز</button></div></div>` : ''}`,
  { footer: locked && !isNew ? '<button class="btn" data-close>بستن</button>' : `<button class="btn primary" id="uSave">${isNew ? 'ساخت کاربر' : 'ذخیره دسترسی'}</button>${!isNew ? `<button class="btn danger" id="uDel">${ICON.trash}حذف کاربر</button>` : ''}<button class="btn" data-close>انصراف</button>` });
  if ($('#uDel', m.el)) $('#uDel', m.el).onclick = async () => {
    if (!(await confirmBox(`حساب «${esc(u.full_name || u.username)}» حذف شود؟ اسنادی که ثبت کرده باقی می‌مانند.`, 'حذف کاربر'))) return;
    await busy(null, async () => { await S.store.deleteUser(u.id); m.close(); toast('حذف شد', 'ok'); renderUsers(); });
  };
  if ($('#uRole', m.el)) $('#uRole', m.el).onchange = ev => $('#memBox', m.el).classList.toggle('hidden', ev.target.value !== 'user');
  const members = () => $$('[data-w]', m.el).filter(s => s.value).map(s => ({ warehouse_id: s.dataset.w, role: s.value }));
  if ($('#uSave', m.el)) $('#uSave', m.el).onclick = ev => busy(ev.target, async () => {
    let id = u.id;
    const role = $('#uRole', m.el)?.value || 'admin';
    if (role === 'user' && !members().length) throw new Error('حداقل یک انبار برای کاربر انتخاب کنید');
    if (isNew) {
      const uname = $('#uUser', m.el).value.trim(), pw = $('#uPw', m.el).value, name = $('#uName', m.el).value.trim();
      if (!/^[a-z0-9._-]{3,}$/i.test(uname)) throw new Error('نام کاربری باید انگلیسی و حداقل ۳ حرف باشد');
      if (pw.length < 6) throw new Error('رمز باید حداقل ۶ کاراکتر باشد');
      if (users.some(x => x.username === uname.toLowerCase())) throw new Error('این نام کاربری وجود دارد؛ از فهرست روی آن بزنید');
      id = (await S.store.createUser({ username: uname, password: pw, full_name: name })).id;
    }
    await S.store.setUserAccess(id, role, role === 'user' ? members() : []);
    m.close(); toast('ذخیره شد', 'ok'); renderUsers();
  });
  if ($('#uSetPw', m.el)) $('#uSetPw', m.el).onclick = ev => busy(ev.target, async () => { await S.store.setPassword(u.id, $('#uNewPw', m.el).value); $('#uNewPw', m.el).value = ''; toast('رمز تغییر کرد', 'ok'); });
}

/* ============================ ورود از اکسل ============================ */
function renderImport() {
  if (!can.writeAny()) { $('#view').innerHTML = '<div class="card empty"><b>دسترسی ندارید</b></div>'; return; }
  const wws = writableWh();
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>ورود از اکسل</h1><div class="sub">فهرست کالا (شناسنامه کالا) و موجودی اول دوره</div></div></div>
    <div class="grid-2" style="grid-template-columns:1fr 1fr">
      <div class="card"><div class="card-h">${ICON.box}۱) فهرست کالاها<div class="actions"><button class="btn sm" id="tplI">${ICON.download}قالب اکسل</button></div></div><div class="card-b">
        <p class="muted" style="margin-top:0;font-size:13px">ستون‌ها: <b>کد کالا، شرح کالا</b>، مشخصات، گروه (قطعات سیویل / مصالح / مصرفی / ابزارآلات / اموال)، دسته، واحد، وزن، حداقل موجودی.
        نام ستون‌ها مهم است، ترتیب نه. کد تکراری ${can.admin() ? 'به‌روزرسانی' : 'نادیده گرفته'} می‌شود.</p>
        <label class="drop" id="dropI">فایل اکسل کالاها را اینجا رها کنید یا بزنید<input type="file" accept=".xlsx,.xls,.csv" hidden id="fI"></label>
        <div id="prevI"></div></div></div>
      <div class="card"><div class="card-h">${ICON.adj}۲) موجودی اول دوره<div class="actions"><button class="btn sm" id="tplO">${ICON.download}قالب اکسل</button></div></div><div class="card-b">
        <p class="muted" style="margin-top:0;font-size:13px">یک سند «تعدیل» برای انبار انتخابی ساخته می‌شود. ستون‌ها: <b>کد کالا، مقدار</b>، توضیح. کالاها باید قبلاً تعریف شده باشند.</p>
        <div class="fgrid" style="--cols:2;margin-bottom:12px"><div class="fld"><label class="l">انبار</label><select id="oWh">${wws.map(w => `<option value="${w.id}" ${S.whId === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>
          <div class="fld"><label class="l">تاریخ</label>${dateInput('id="oDate"', Jalali.today())}</div></div>
        <label class="drop" id="dropO">فایل اکسل موجودی را اینجا رها کنید یا بزنید<input type="file" accept=".xlsx,.xls,.csv" hidden id="fO"></label>
        <div id="prevO"></div></div></div>
    </div>`;
  bindDateInputs($('#view'));
  $('#tplI').onclick = () => downloadXlsx('قالب-کالا', [{ name: 'کالاها', rows: [ITEM_COLS.slice(0, 8).map(c => c[1]), ['C-0001', 'پنل قالب فلزی', '60×120', 'قطعات سیویل', 'قالب دیوار', 'عدد', 18.5, 0], ['M-0001', 'سیمان تیپ ۲', '', 'مصالح', 'سیمان', 'کیسه', 50, 100]] }]);
  $('#tplO').onclick = () => downloadXlsx('قالب-موجودی-اول-دوره', [{ name: 'موجودی', rows: [['کد کالا', 'مقدار', 'توضیح'], ...S.items.slice(0, 3).map(i => [i.code, 0, ''])] }]);
  const bindDrop = (drop, input, fn) => {
    drop.onclick = () => input.click();
    input.onchange = () => input.files[0] && fn(input.files[0]);
    drop.ondragover = ev => { ev.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = ev => { ev.preventDefault(); drop.classList.remove('over'); ev.dataTransfer.files[0] && fn(ev.dataTransfer.files[0]); };
  };
  const colIdx = (hdr, names) => hdr.findIndex(h => names.some(n => normFa(h).includes(normFa(n))));
  bindDrop($('#dropI'), $('#fI'), async file => {
    try {
      const rows = await readXlsx(file); const hdr = (rows[0] || []).map(String);
      const ix = { code: colIdx(hdr, ['کد']), name: colIdx(hdr, ['شرح', 'نام کالا', 'نام']), spec: colIdx(hdr, ['مشخصات', 'سایز']), kind: colIdx(hdr, ['گروه', 'نوع']), category: colIdx(hdr, ['دسته']),
        unit: colIdx(hdr, ['واحد']), weight: colIdx(hdr, ['وزن']), min_qty: colIdx(hdr, ['حداقل', 'نقطه سفارش']), notes: colIdx(hdr, ['توضیح']) };
      if (ix.code < 0 || ix.name < 0) throw new Error('ستون «کد کالا» یا «شرح کالا» پیدا نشد');
      const kindOf = s => { s = normFa(s); return Object.keys(KINDS).find(k => s && normFa(KINDS[k]).includes(s.split(' ')[0])) || (/سیویل|قالب|داربست/.test(s) ? 'civil' : /اموال/.test(s) ? 'asset' : /ابزار/.test(s) ? 'tool' : /مصرف/.test(s) ? 'consumable' : 'material'); };
      const seen = new Set();
      const items = rows.slice(1).map(r => ({
        code: faToEn(String(r[ix.code] || '').trim()), name: String(r[ix.name] || '').trim(), spec: ix.spec >= 0 ? String(r[ix.spec] || '').trim() || null : null,
        kind: ix.kind >= 0 ? kindOf(r[ix.kind]) : 'material', category: ix.category >= 0 ? String(r[ix.category] || '').trim() || null : null,
        unit: ix.unit >= 0 ? String(r[ix.unit] || '').trim() || 'عدد' : 'عدد', weight: ix.weight >= 0 && String(r[ix.weight]).trim() ? num(r[ix.weight]) : null,
        min_qty: ix.min_qty >= 0 ? num(r[ix.min_qty]) : 0, notes: ix.notes >= 0 ? String(r[ix.notes] || '').trim() || null : null,
      })).filter(i => i.code && i.name && !seen.has(normFa(i.code)) && seen.add(normFa(i.code)));
      const fresh = items.filter(i => !S.itemByCode.has(normFa(i.code))), exist = items.filter(i => S.itemByCode.has(normFa(i.code)));
      $('#prevI').innerHTML = `<div style="margin-top:12px"><b>${items.length}</b> کالا در فایل · <b style="color:var(--ok)">${fresh.length}</b> جدید · <b>${exist.length}</b> موجود
        <div class="tbl-wrap" style="max-height:240px;margin:8px 0"><table class="tbl"><tbody>${items.slice(0, 50).map(i => `<tr><td class="mono">${esc(i.code)}</td><td>${esc(i.name)}</td><td>${kindTag(i.kind)}</td><td>${esc(i.unit)}</td><td>${S.itemByCode.has(normFa(i.code)) ? '<span class="muted">موجود</span>' : '<span style="color:var(--ok)">جدید</span>'}</td></tr>`).join('')}</tbody></table></div>
        <button class="btn primary" id="doI">${ICON.import}ورود ${fresh.length} کالای جدید${can.admin() && exist.length ? ` و به‌روزرسانی ${exist.length}` : ''}</button></div>`;
      $('#doI').onclick = ev => busy(ev.target, async () => {
        if (fresh.length) await S.store.insertItems(fresh);
        if (can.admin()) for (const i of exist) await S.store.saveItem({ ...i, id: S.itemByCode.get(normFa(i.code)).id });
        S.items = await S.store.listItems(); rebuildIndex();
        await log('import', 'item', file.name, `${fresh.length} جدید، ${can.admin() ? exist.length : 0} به‌روز`);
        toast('ورود کالاها انجام شد', 'ok'); refreshNav(); $('#prevI').innerHTML = '';
      });
    } catch (e) { toast(e.message, 'err'); }
  });
  bindDrop($('#dropO'), $('#fO'), async file => {
    try {
      const rows = await readXlsx(file); const hdr = (rows[0] || []).map(String);
      const ci = Math.max(0, colIdx(hdr, ['کد'])), qi = colIdx(hdr, ['مقدار', 'موجودی', 'تعداد']), ni = colIdx(hdr, ['توضیح']);
      if (qi < 0) throw new Error('ستون «مقدار» پیدا نشد');
      const lines = [], bad = [];
      rows.slice(1).forEach(r => { const code = String(r[ci] || '').trim(); const q = num(r[qi]); if (!code || !q) return; const it = S.itemByCode.get(normFa(code)); if (!it) bad.push(code); else lines.push({ item_id: it.id, qty: q, note: ni >= 0 ? String(r[ni] || '').trim() : '' }); });
      $('#prevO').innerHTML = `<div style="margin-top:12px"><b>${lines.length}</b> ردیف آماده${bad.length ? ` · <span class="neg">${bad.length} کد تعریف‌نشده: ${esc(bad.slice(0, 10).join('، '))}${bad.length > 10 ? '…' : ''}</span>` : ''}
        <div style="margin-top:8px"><button class="btn primary" id="doO" ${lines.length ? '' : 'disabled'}>${ICON.adj}ثبت سند موجودی اول دوره</button></div></div>`;
      $('#doO').onclick = ev => busy(ev.target, async () => {
        const saved = await S.store.saveDoc({ type: 'adjust', warehouse_id: $('#oWh').value, doc_date: Jalali.normalize($('#oDate').value), party: S.user.full_name || '', notes: 'موجودی اول دوره — از فایل ' + file.name }, lines, true);
        await reloadStock(); toast('سند ' + saved.doc_no + ' ثبت شد', 'ok'); location.hash = '#/doc/' + saved.id;
      });
    } catch (e) { toast(e.message, 'err'); }
  });
}

/* ============================ تاریخچه ============================ */
const LOG_FA = { create: 'ثبت کرد', update: 'ویرایش کرد', delete: 'حذف کرد', void: 'باطل کرد', import: 'از اکسل وارد کرد', role: 'دسترسی را تغییر داد' };
const ENT_FA = { doc: 'سند', item: 'کالا', asset: 'اموال', warehouse: 'انبار', user: 'کاربر' };
async function renderLog() {
  const list = await S.store.listLog(400);
  const lab = l => l.entity === 'doc' ? (l.label || '').replace(/^(\w+)/, (_, t) => DT[t]?.short || t) : l.label;
  $('#view').innerHTML = `<div class="page-head"><div><h1>تاریخچه تغییرات</h1><div class="sub">${list.length} رویداد آخر</div></div></div>
    <div class="card">${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>زمان</th><th>کاربر</th><th>عملیات</th><th>مورد</th><th>انبار</th><th>جزئیات</th></tr></thead><tbody>
      ${list.map(l => `<tr ${l.entity === 'doc' && l.entity_id && l.action !== 'delete' ? `onclick="location.hash='#/doc/${l.entity_id}'"` : l.entity === 'item' && l.entity_id ? `onclick="location.hash='#/item/${l.entity_id}'"` : ''}>
        <td class="mono muted" style="font-size:12px;white-space:nowrap">${Jalali.isoToJalali(l.at)}</td><td>${esc(l.username || '')}</td><td>${LOG_FA[l.action] || esc(l.action)}</td>
        <td><span class="muted">${ENT_FA[l.entity] || ''}</span> <b class="mono">${esc(lab(l) || '')}</b></td><td class="muted">${l.warehouse_id ? esc(whName(l.warehouse_id)) : ''}</td><td class="muted">${esc(l.entity === 'user' ? ROLE_FA[l.details] || l.details : l.details || '')}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">رویدادی ثبت نشده</div>'}</div>`;
}

/* ============================ تنظیمات ============================ */
function renderSettings() {
  const cfg = getConfig();
  $('#view').innerHTML = `<div class="page-head"><div><h1>تنظیمات</h1></div></div>
    <div class="grid-2" style="grid-template-columns:1fr 1fr">
      <div class="card"><div class="card-h">حساب من</div><div class="card-b">
        <div class="form-row"><label>نام نمایشی</label><div style="display:flex;gap:6px"><input id="myName" value="${esc(S.user.full_name)}" style="flex:1"><button class="btn" id="saveName">ذخیره</button></div></div>
        <div class="muted" style="margin-bottom:12px">نام کاربری: <b class="mono">${esc(S.user.username)}</b> · نقش انبار: ${ROLE_FA[S.user.role]}
          ${S.user.role === 'user' ? '<br>انبارها: ' + (S.user.members || []).map(m => `${esc(whName(m.warehouse_id))} (${MEM_FA[m.role]})`).join('، ') : ''}</div>
        ${S.store.mode === 'online' ? `<div class="form-row"><label>رمز عبور جدید</label><div style="display:flex;gap:6px"><input id="myPw" type="password" class="ltr" minlength="6" style="flex:1"><button class="btn" id="savePw">تغییر رمز</button></div></div>
        <button class="btn danger" id="logout">${ICON.logout}خروج از حساب</button>` : ''}
      </div></div>
      ${can.admin() ? `<div class="card"><div class="card-h">تنظیمات انبار</div><div class="card-b">
        <div class="form-row"><label>نام شرکت (سربرگ چاپ)</label><div style="display:flex;gap:6px"><input id="sComp" value="${esc(S.settings.company || '')}" style="flex:1"><button class="btn" id="saveComp">ذخیره</button></div></div>
        <label class="chk" style="direction:rtl"><input type="checkbox" id="sNeg" ${S.settings.allow_negative === true ? 'checked' : ''}> اجازه موجودی منفی (توصیه نمی‌شود)</label>
        <div class="muted" style="font-size:12px">وقتی خاموش است، حواله/انتقال بیشتر از موجودی ثبت نمی‌شود؛ مدیر انبار در صورت لزوم می‌تواند با تأیید جداگانه ثبت کند.</div>
      </div></div>` : ''}
      <div class="card"><div class="card-h">اتصال به سرور (Supabase)</div><div class="card-b">
        <p style="margin-top:0">وضعیت: <span class="mode-pill ${S.store.mode}">${S.store.mode === 'online' ? 'آنلاین — همه کاربران داده مشترک می‌بینند' : 'آزمایشی محلی — داده فقط روی همین مرورگر است'}</span></p>
        ${can.admin() ? `<button class="btn" id="cfgBtn">${ICON.settings}تنظیم اتصال</button>
        ${cfg ? `<div class="form-row" style="margin-top:14px"><label>لینک دعوت برای همکاران</label><div style="display:flex;gap:6px"><input id="inv" readonly class="ltr" value="${esc(inviteLink(cfg))}" style="flex:1;font-size:12px"><button class="btn" id="cpInv">${ICON.copy}</button></div></div>` : ''}` : ''}
      </div></div>
      <div class="card"><div class="card-h">پشتیبان‌گیری</div><div class="card-b" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="bk">${ICON.download}پشتیبان کامل (JSON)</button>
        <button class="btn" id="xAll">${ICON.excel}اکسل موجودی همه انبارها</button>
        ${S.store.mode === 'local' ? `<button class="btn danger" id="wipe">${ICON.trash}پاک‌کردن داده‌های آزمایشی</button>` : ''}
        <button class="btn" id="instBtn" style="display:none">${ICON.download}نصب برنامه روی ویندوز</button>
      </div></div>
    </div>`;
  $('#saveName').onclick = ev => busy(ev.target, async () => { await S.store.updateMyName($('#myName').value.trim()); toast('ذخیره شد', 'ok'); renderShell(); route(); });
  if ($('#savePw')) $('#savePw').onclick = ev => busy(ev.target, async () => { await S.store.changePassword($('#myPw').value); toast('رمز تغییر کرد', 'ok'); $('#myPw').value = ''; });
  if ($('#logout')) $('#logout').onclick = async () => { await S.store.logout(); location.hash = ''; location.reload(); };
  if ($('#saveComp')) $('#saveComp').onclick = ev => busy(ev.target, async () => { const v = $('#sComp').value.trim(); await S.store.saveSetting('company', v); S.settings.company = v; refreshNav(); toast('ذخیره شد', 'ok'); });
  if ($('#sNeg')) $('#sNeg').onchange = ev => busy(null, async () => { await S.store.saveSetting('allow_negative', ev.target.checked); S.settings.allow_negative = ev.target.checked; toast('ذخیره شد', 'ok'); });
  if ($('#cfgBtn')) $('#cfgBtn').onclick = openConnection;
  if ($('#cpInv')) $('#cpInv').onclick = () => { navigator.clipboard.writeText($('#inv').value); toast('کپی شد', 'ok'); };
  $('#bk').onclick = ev => busy(ev.target, async () => {
    const lines = []; for (const d of S.docs) lines.push(...(await S.store.getLines(d.id)));
    const data = { app: 'anbaryar', at: new Date().toISOString(), warehouses: S.warehouses, items: S.items.map(({ _s, ...i }) => i), docs: S.docs, lines, assets: S.assets };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = `anbaryar-backup-${Jalali.today().replace(/\//g, '-')}.json`; a.click();
  });
  $('#xAll').onclick = () => { const keep = S.whId; S.whId = 'all'; const whs = myWh(); S.whId = keep;
    downloadXlsx('موجودی-همه-انبارها', [{ name: 'موجودی', rows: [['کد', 'شرح کالا', 'مشخصات', 'واحد', ...whs.map(w => w.name), 'جمع'], ...S.items.map(i => { const per = whs.map(w => stockOf(w.id, i.id)); return [i.code, i.name, i.spec || '', i.unit, ...per, per.reduce((a, b) => a + b, 0)]; }).filter(r => r.slice(4).some(x => x))] }]); };
  if ($('#wipe')) $('#wipe').onclick = async () => { if (await confirmBox('همه داده‌های آزمایشی محلی پاک شوند؟', 'پاک کن')) { Object.keys(localStorage).filter(k => k.startsWith('whl_')).forEach(k => localStorage.removeItem(k)); LocalStore.mem = {}; location.reload(); } };
  if (window._installPrompt) { $('#instBtn').style.display = 'inline-flex'; $('#instBtn').onclick = () => window._installPrompt.prompt(); }
}
function openConnection() {
  const cfg = getConfig() || {};
  const m = modal('اتصال به Supabase', `
    <p class="muted" style="margin-top:0;font-size:13px">از داشبورد Supabase → Project Settings → API: مقدار Project URL و کلید publishable (anon).</p>
    <div class="form-row"><label>Project URL</label><input id="cUrl" class="ltr" value="${esc(cfg.url)}" placeholder="https://xxxx.supabase.co"></div>
    <div class="form-row"><label>کلید عمومی (publishable / anon)</label><textarea id="cKey" class="ltr" rows="3" style="font-family:var(--mono);font-size:12px">${esc(cfg.key)}</textarea></div>`,
  { footer: `<button class="btn primary" id="cSave">ذخیره و اتصال</button>${cfg.url ? '<button class="btn danger" id="cClear">قطع اتصال (حالت محلی)</button>' : ''}<button class="btn" data-close>انصراف</button>` });
  $('#cSave', m.el).onclick = () => {
    const url = $('#cUrl', m.el).value.trim().replace(/\/$/, ''), key = $('#cKey', m.el).value.trim();
    if (!/^https:\/\/.+/.test(url) || key.length < 30) return toast('آدرس یا کلید معتبر نیست', 'err');
    localStorage.setItem('wh_cfg', JSON.stringify({ url, key })); location.hash = ''; location.reload();
  };
  if ($('#cClear', m.el)) $('#cClear', m.el).onclick = () => { localStorage.removeItem('wh_cfg'); location.reload(); };
}

/* ============================ شروع ============================ */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window._installPrompt = e; });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
boot();
