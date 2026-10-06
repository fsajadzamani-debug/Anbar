/* ======================================================
   انباریار — مدیریت: انبارها، کاربران، ورود اکسل، تاریخچه، تنظیمات
   ====================================================== */

/* ============================ انبارها ============================ */
async function renderWarehouses() {
  let users = []; try { users = await S.store.listUsers(); } catch (e) { /* ignore */ }
  const accOf = w => users.filter(u => u.wh_role === 'user' && (u.members || []).some(m => m.warehouse_id === w.id));
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>انبارها</h1><div class="sub">${S.warehouses.length} انبار · ${S.warehouses.filter(w => w.active !== false).length} فعال</div></div>
      <div class="actions"><button class="btn primary" id="add">${ICON.plus}انبار جدید</button></div></div>
    <div class="card">${S.warehouses.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>کد</th><th>نام انبار</th><th>نوع</th><th>پروژه / کارگاه</th><th>محل</th><th>انباردار</th><th>نام کاربری ورود</th><th class="num">قلم موجود</th><th>وضعیت</th></tr></thead><tbody>
      ${S.warehouses.map(w => `<tr data-id="${w.id}" class="${w.active === false ? 'inactive' : ''}"><td class="mono">${esc(w.code || '')}</td><td><b>${esc(w.name)}</b></td><td>${esc(WH_KINDS[w.kind] || '')}</td><td>${esc(w.project || '')}</td><td class="muted">${esc(w.location || '')}</td>
        <td>${esc(w.keeper_name || '')}</td><td class="mono">${accOf(w).map(u => esc(u.username)).join('، ') || '<span class="neg" style="font-family:Vazirmatn">تعریف نشده</span>'}</td><td class="mono num">${S.stock.filter(s => s.warehouse_id === w.id && +s.qty > 0).length}</td><td>${w.active === false ? 'غیرفعال' : '<span style="color:var(--ok)">فعال</span>'}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="empty"><b>هنوز انباری تعریف نشده</b>برای هر انبار یک نام کاربری و رمز بگذارید؛ انباردار با آن وارد می‌شود و فقط همان انبار را می‌بیند.</div>`}</div>`;
  $('#add').onclick = () => whModal(null, users);
  $$('tbody tr[data-id]').forEach(r => r.onclick = () => whModal(S.warehouses.find(w => w.id === r.dataset.id), users));
}
function whModal(w, users = []) {
  const isNew = !w; w = w || { kind: 'site', active: true, sort: (S.warehouses.length + 1) * 10 };
  const accs = isNew ? [] : users.filter(u => u.wh_role === 'user' && (u.members || []).some(m => m.warehouse_id === w.id));
  const suggestUser = () => 'anbar' + String(S.warehouses.length + (isNew ? 1 : 0)).padStart(2, '0');
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
    </div>
    <div class="sec-t" style="margin-top:18px">${ICON.key}ورود به این انبار</div>
    ${accs.length ? `<div>${accs.map(u => `<div class="acc-row"><b class="mono">${esc(u.username)}</b><span class="muted">${esc(u.full_name || '')} · ${(u.members.find(m => m.warehouse_id === w.id) || {}).role === 'viewer' ? 'مشاهده' : 'انباردار'}</span>
      <input data-pw="${u.id}" class="mono pw" dir="ltr" placeholder="رمز جدید"><button type="button" class="btn sm" data-setpw="${u.id}">تغییر رمز</button></div>`).join('')}</div>` : ''}
    <p class="muted" style="font-size:12.5px;margin:6px 0 8px">${accs.length ? 'افزودن حساب دیگر برای این انبار (اختیاری):' : 'با این نام کاربری و رمز، انباردار وارد می‌شود و فقط همین انبار را می‌بیند.'}</p>
    <div class="fgrid" style="--cols:2">
      <div class="fld"><label class="l">نام کاربری <small>انگلیسی</small></label><input id="wUser" class="mono" dir="ltr" placeholder="${esc(suggestUser())}"></div>
      <div class="fld"><label class="l">رمز عبور <small>حداقل ۶</small></label><input id="wPw" class="mono pw" dir="ltr" autocomplete="new-password"></div>
    </div>`, { footer: `<button class="btn primary" id="wSave">ذخیره</button>${!isNew ? `<button class="btn danger" id="wDel">${ICON.trash}حذف</button>` : ''}<button class="btn" data-close>انصراف</button>` });
  $('#wName', m.el).focus();
  $$('[data-setpw]', m.el).forEach(b => b.onclick = ev => busy(ev.target, async () => {
    const i = $(`[data-pw="${b.dataset.setpw}"]`, m.el); await S.store.setPassword(b.dataset.setpw, i.value); i.value = ''; toast('رمز تغییر کرد', 'ok');
  }));
  $('#wSave', m.el).onclick = ev => busy(ev.target, async () => {
    const uname = $('#wUser', m.el).value.trim().toLowerCase(), pw = $('#wPw', m.el).value;
    if (uname || pw) {
      if (!/^[a-z0-9._-]{3,}$/.test(uname)) throw new Error('نام کاربری باید انگلیسی و حداقل ۳ حرف باشد');
      if (pw.length < 6) throw new Error('رمز باید حداقل ۶ کاراکتر باشد');
      if (users.some(u => u.username === uname)) throw new Error('این نام کاربری قبلاً ثبت شده');
    }
    const row = { ...(isNew ? {} : { id: w.id }), name: $('#wName', m.el).value.trim(), code: $('#wCode', m.el).value.trim() || null, kind: $('#wKind', m.el).value, project: $('#wProj', m.el).value.trim() || null,
      location: $('#wLoc', m.el).value.trim() || null, keeper_name: $('#wKeep', m.el).value.trim() || null, phone: faToEn($('#wPh', m.el).value.trim()) || null, sort: num($('#wSort', m.el).value) || 100, active: $('#wAct', m.el).value === '1' };
    if (!row.name) throw new Error('نام انبار لازم است');
    const saved = await S.store.saveWarehouse(row);
    if (isNew) S.warehouses.push(saved); else Object.assign(w, saved);
    S.warehouses.sort((a, b) => (a.sort ?? 100) - (b.sort ?? 100));
    await log(isNew ? 'create' : 'update', 'warehouse', saved.name, '', saved.id);
    if (uname) {
      const u = await S.store.createUser({ username: uname, password: pw, full_name: row.keeper_name || row.name });
      await S.store.setUserAccess(u.id, 'user', [{ warehouse_id: saved.id, role: 'keeper' }]);
    }
    m.close(); toast(uname ? `ذخیره شد · ورود انبار: ${uname}` : 'ذخیره شد', 'ok'); refreshNav(); renderWarehouses();
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
    <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>نام</th><th>نام کاربری</th><th>نقش</th><th>انبارها</th><th></th></tr></thead><tbody>
      ${users.map(u => `<tr data-id="${u.id}" class="${u.wh_role === 'none' ? 'inactive' : ''}"><td><b>${esc(u.full_name || '')}</b></td><td class="mono">${esc(u.username)}</td>
        <td>${u.wh_role === 'admin' ? '<b style="color:var(--accent)">مدیر انبار</b>' : esc(ROLE_FA[u.wh_role] || u.wh_role)}${u.id === S.user.id ? ' <small class="muted">(شما)</small>' : ''}</td>
        <td style="font-size:12.5px">${u.wh_role === 'user' ? (u.members || []).map(m => `<span class="mini-pill ${m.role}">${esc(whName(m.warehouse_id))} · ${MEM_FA[m.role]}</span>`).join(' ') || '<span class="neg">هیچ انباری</span>' : u.wh_role === 'none' ? '' : '<span class="muted">همه انبارها</span>'}</td><td><span class="btn sm ghost">${ICON.edit}ویرایش</span></td></tr>`).join('')}
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
  const self = u.id === S.user.id;
  const m = modal(isNew ? 'کاربر جدید' : 'ویرایش کاربر ' + esc(u.full_name || u.username), `
    <div class="fgrid" style="--cols:2;margin-bottom:6px">
      <div class="fld"><label class="l">نام و نام خانوادگی *</label><input id="uName" value="${esc(u.full_name || '')}" dir="auto"></div>
      <div class="fld"><label class="l">نام کاربری * <small>انگلیسی</small></label><input id="uUser" value="${esc(u.username || '')}" class="mono" dir="ltr"></div>
      <div class="fld"><label class="l">${isNew ? 'رمز عبور *' : 'رمز جدید'} <small>${isNew ? 'حداقل ۶' : 'خالی = بدون تغییر'}</small></label><input id="uPw" class="mono pw" autocomplete="new-password" dir="ltr"></div>
    </div>
    ${self ? '<div class="warn-box card">این حساب خودتان است؛ نقش و انبار خودتان را نمی‌توانید تغییر دهید.</div>' : `
    <div class="form-row"><label>نقش</label><select id="uRole">${Object.entries(ROLE_FA).map(([k, v]) => `<option value="${k}" ${u.wh_role === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div id="memBox" class="${u.wh_role === 'user' ? '' : 'hidden'}">
      <div class="form-row move-box"><label>${ICON.swap}${isNew ? 'انباردارِ انبار' : 'جابه‌جایی: انباردارِ فقط این انبار شود'}</label>
        <select id="uMove"><option value="">— انتخاب انبار —</option>${S.warehouses.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></div>
      <label style="font-size:12.5px;font-weight:600">یا دسترسی به چند انبار</label>
      <div class="mem-list">${S.warehouses.map(w => `<div class="mem-row"><span>${esc(w.name)}${w.active === false ? ' <small class="muted">(غیرفعال)</small>' : ''}</span>
        <select data-w="${w.id}"><option value="">—</option><option value="keeper" ${mem[w.id] === 'keeper' ? 'selected' : ''}>انباردار</option><option value="viewer" ${mem[w.id] === 'viewer' ? 'selected' : ''}>مشاهده</option></select></div>`).join('') || '<div class="muted">اول انبارها را تعریف کنید</div>'}</div></div>`}`,
  { footer: `<button class="btn primary" id="uSave">${isNew ? 'ساخت کاربر' : 'ذخیره تغییرات'}</button>${!isNew && !self ? `<button class="btn danger" id="uDel">${ICON.trash}حذف کاربر</button>` : ''}<button class="btn" data-close>انصراف</button>` });
  if ($('#uRole', m.el)) $('#uRole', m.el).onchange = ev => $('#memBox', m.el).classList.toggle('hidden', ev.target.value !== 'user');
  if ($('#uMove', m.el)) $('#uMove', m.el).onchange = ev => { const w = ev.target.value; if (!w) return; $$('[data-w]', m.el).forEach(s => s.value = s.dataset.w === w ? 'keeper' : ''); };
  const members = () => $$('[data-w]', m.el).filter(s => s.value).map(s => ({ warehouse_id: s.dataset.w, role: s.value }));
  if ($('#uDel', m.el)) $('#uDel', m.el).onclick = async () => {
    if (!(await confirmBox(`حساب «${esc(u.full_name || u.username)}» حذف شود؟ اسنادی که ثبت کرده باقی می‌مانند.`, 'حذف کاربر'))) return;
    await busy(null, async () => { await S.store.deleteUser(u.id); m.close(); toast('حذف شد', 'ok'); renderUsers(); });
  };
  $('#uSave', m.el).onclick = ev => busy(ev.target, async () => {
    const name = $('#uName', m.el).value.trim(), uname = $('#uUser', m.el).value.trim().toLowerCase(), pw = $('#uPw', m.el).value;
    if (!/^[a-z0-9._-]{3,}$/.test(uname)) throw new Error('نام کاربری باید انگلیسی و حداقل ۳ حرف باشد');
    if (users.some(x => x.username === uname && x.id !== u.id)) throw new Error('این نام کاربری قبلاً ثبت شده');
    if ((isNew || pw) && pw.length < 6) throw new Error('رمز باید حداقل ۶ کاراکتر باشد');
    const role = self ? null : $('#uRole', m.el).value;
    if (role === 'user' && !members().length) throw new Error('حداقل یک انبار برای کاربر انتخاب کنید');
    let id = u.id;
    if (isNew) id = (await S.store.createUser({ username: uname, password: pw, full_name: name })).id;
    else {
      if (uname !== u.username || name !== (u.full_name || '')) await S.store.renameUser(id, uname, name);
      if (pw) await S.store.setPassword(id, pw);
    }
    if (role) await S.store.setUserAccess(id, role, role === 'user' ? members() : []);
    if (self) { S.user.full_name = name; S.user.username = uname; refreshNav(); }
    m.close(); toast(pw && !isNew ? 'ذخیره شد · رمز تغییر کرد' : 'ذخیره شد', 'ok'); renderUsers();
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
