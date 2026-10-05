/* ======================================================
   انباریار — اسناد: فهرست، نمایش، فرم ثبت، چاپ
   ====================================================== */

/* ---------- تاریخ شمسی ---------- */
function dateInput(attr, v) {
  return `<div class="date-in"><input ${attr} type="text" value="${esc(v)}" placeholder="1405/01/01" data-date><button type="button" class="icon-btn" data-cal title="تقویم">${ICON.cal}</button><button type="button" class="btn sm" data-today>امروز</button></div>`;
}
function bindDateInputs(root) {
  $$('[data-today]', root).forEach(b => b.onclick = () => { const i = b.parentNode.querySelector('input'); i.value = Jalali.today(); i.dispatchEvent(new Event('change', { bubbles: true })); });
  $$('[data-cal]', root).forEach(b => b.onclick = ev => { ev.stopPropagation(); openCalendar(b.parentNode.querySelector('input'), b); });
  $$('[data-date]', root).forEach(i => i.addEventListener('blur', () => { i.value = Jalali.normalize(i.value); }));
}
function openCalendar(input, anchor) {
  $$('.cal').forEach(c => c.remove());
  let [y, m] = (Jalali.normalize(input.value).match(/^(\d{4})\/(\d{2})/) || []).slice(1).map(Number);
  if (!y) [y, m] = Jalali.toJalali();
  const cal = document.createElement('div'); cal.className = 'cal';
  const r = anchor.getBoundingClientRect();
  cal.style.top = (window.scrollY + r.bottom + 4) + 'px'; cal.style.left = Math.max(8, window.scrollX + r.left - 200) + 'px';
  const draw = () => {
    const [gy, gm, gd] = Jalali.toGregorian(y, m, 1);
    const wd = (new Date(gy, gm - 1, gd).getDay() + 1) % 7;
    const n = Jalali.monthLength(y, m), cur = Jalali.normalize(input.value);
    let cells = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(d => `<span>${d}</span>`).join('') + '<i></i>'.repeat(wd);
    for (let d = 1; d <= n; d++) { const s = `${y}/${Jalali.pad(m)}/${Jalali.pad(d)}`; cells += `<button type="button" data-v="${s}" class="${s === cur ? 'on' : ''}">${d}</button>`; }
    cal.innerHTML = `<div class="cal-h"><button type="button" class="btn sm ghost" data-n="1">›</button><span>${Jalali.MONTHS[m - 1]} ${y}</span><button type="button" class="btn sm ghost" data-n="-1">‹</button></div><div class="cal-g">${cells}</div>`;
  };
  draw(); document.body.appendChild(cal);
  cal.onclick = ev => {
    ev.stopPropagation();
    const nb = ev.target.closest('[data-n]'); if (nb) { m -= +nb.dataset.n; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } draw(); return; }
    const b = ev.target.closest('[data-v]'); if (b) { input.value = b.dataset.v; input.dispatchEvent(new Event('change', { bubbles: true })); cal.remove(); }
  };
  setTimeout(() => document.addEventListener('click', function h() { cal.remove(); document.removeEventListener('click', h); }), 0);
}

/* ---------- اکسل ---------- */
function downloadXlsx(name, sheets) {
  if (!window.XLSX) return toast('کتابخانه اکسل هنوز بارگذاری نشده؛ چند ثانیه دیگر دوباره امتحان کنید', 'err');
  const wb = XLSX.utils.book_new();
  sheets.forEach(s => {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    ws['!cols'] = (s.rows[0] || []).map((_, c) => ({ wch: Math.min(50, Math.max(8, ...s.rows.slice(0, 300).map(r => String(r[c] ?? '').length + 2))) }));
    ws['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  });
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.writeFile(wb, `${name}-${Jalali.today().replace(/\//g, '-')}.xlsx`);
}
async function readXlsx(file) {
  if (!window.XLSX) throw new Error('کتابخانه اکسل بارگذاری نشده');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
}

/* ============================ فهرست اسناد ============================ */
function renderDocs(type, keep) {
  const key = 'docs_' + type;
  const st = S.listState[key] = { q: '', wh: '', from: '', to: '', status: 'final', sort: 'date', dir: -1, limit: 200, sel: new Set(), ...(S.listState[key] || {}) };
  const isAll = type === 'all';
  const vis = new Set(selWh().map(w => w.id));
  let docs = S.docs.filter(d => (isAll || d.type === type) && (vis.has(d.warehouse_id) || vis.has(d.to_warehouse_id)));
  if (st.status) docs = docs.filter(d => d.status === st.status);
  if (st.wh) docs = docs.filter(d => d.warehouse_id === st.wh || d.to_warehouse_id === st.wh);
  if (st.from) docs = docs.filter(d => d.doc_date >= Jalali.normalize(st.from));
  if (st.to) docs = docs.filter(d => d.doc_date <= Jalali.normalize(st.to));
  if (st.q) docs = docs.filter(d => matchQ(normFa([d.doc_no, d.doc_date, d.party, d.project, d.ref_no, d.notes, whName(d.warehouse_id), whName(d.to_warehouse_id), d.created_name, DT[d.type]?.fa].join(' ')), st.q));
  const cmp = { date: (a, b) => a.doc_date.localeCompare(b.doc_date) || String(a.created_at).localeCompare(b.created_at), no: (a, b) => String(a.doc_no).localeCompare(b.doc_no, undefined, { numeric: true }), wh: (a, b) => whName(a.warehouse_id).localeCompare(whName(b.warehouse_id), 'fa'), party: (a, b) => String(a.party || '').localeCompare(b.party || '', 'fa') }[st.sort];
  docs.sort((a, b) => cmp(a, b) * st.dir);
  const shown = docs.slice(0, st.limit);
  const th = (k, l) => `<th data-sort="${k}" class="${st.sort === k ? 'sorted' : ''}">${l}${st.sort === k ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
  const title = isAll ? 'همه اسناد' : DT[type].fa;
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>${title}</h1><div class="sub">${docs.length} سند${S.whId !== 'all' ? ' · ' + esc(whName(S.whId)) : ''}</div></div>
      <div class="actions"><button class="btn" id="xls">${ICON.excel}خروجی اکسل (با ردیف‌ها)</button>
        ${writableWh().length ? (isAll ? '' : `<a class="btn primary" href="#/new/${type}">${ICON.plus}${DT[type].short} جدید</a>`) : ''}</div></div>
    <div class="card">
      <div class="filters">
        <input id="fq" type="search" placeholder="جستجو: شماره، طرف حساب، پروژه، توضیحات…" value="${esc(st.q)}" style="flex:1;min-width:200px">
        ${selWh().length > 1 ? `<select id="fw"><option value="">همه انبارها</option>${selWh().map(w => `<option value="${w.id}" ${st.wh === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select>` : ''}
        <input id="ff" placeholder="از تاریخ" value="${esc(st.from)}" style="width:110px" class="ltr">
        <input id="ft" placeholder="تا تاریخ" value="${esc(st.to)}" style="width:110px" class="ltr">
        <select id="fs"><option value="final" ${st.status === 'final' ? 'selected' : ''}>معتبر</option><option value="void" ${st.status === 'void' ? 'selected' : ''}>باطل‌شده</option><option value="" ${!st.status ? 'selected' : ''}>همه</option></select>
      </div>
      <div class="bulkbar ${st.sel.size ? '' : 'hidden'}"><b>${st.sel.size}</b> انتخاب شده
        <button class="btn sm" id="bPrint">${ICON.print}چاپ گروهی</button><button class="btn sm ghost" id="bClr">لغو انتخاب</button></div>
      ${shown.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th style="width:30px"><input type="checkbox" id="selAll" ${shown.every(d => st.sel.has(d.id)) ? 'checked' : ''}></th>
        ${isAll ? '<th>نوع</th>' : ''}${th('no', 'شماره')}${th('date', 'تاریخ')}${th('wh', 'انبار')}${th('party', type === 'transfer' ? 'حمل‌کننده' : 'طرف حساب')}<th>پروژه / محل مصرف</th><th>مرجع</th><th>ثبت‌کننده</th></tr></thead><tbody>
        ${shown.map(d => `<tr data-id="${d.id}" class="${st.sel.has(d.id) ? 'sel' : ''} ${d.status === 'void' ? 'void' : ''}">
          <td onclick="event.stopPropagation()"><input type="checkbox" data-sel="${d.id}" ${st.sel.has(d.id) ? 'checked' : ''}></td>
          ${isAll ? `<td>${dtTag(d.type)}</td>` : ''}
          <td class="mono" style="font-weight:600;white-space:nowrap">${hilite(d.doc_no, st.q)} ${voidBadge(d)}</td>
          <td class="mono" style="white-space:nowrap">${esc(d.doc_date)}</td>
          <td style="white-space:nowrap">${esc(whName(d.warehouse_id))}${d.to_warehouse_id ? ` <span class="muted">←</span> <b>${esc(whName(d.to_warehouse_id))}</b>` : ''}</td>
          <td class="subj">${hilite(d.party || '', st.q)}</td><td class="subj">${hilite(d.project || '', st.q)}</td>
          <td class="mono" style="font-size:12.5px">${hilite(d.ref_no || '', st.q)}</td><td class="muted" style="font-size:12px;white-space:nowrap">${esc(d.created_name || '')}</td></tr>`).join('')}
      </tbody></table></div>
      ${docs.length > shown.length ? `<div style="padding:12px;text-align:center"><button class="btn" id="more">نمایش بیشتر (${docs.length - shown.length} باقی‌مانده)</button></div>` : ''}`
      : `<div class="empty"><b>سندی پیدا نشد</b></div>`}
    </div>`;
  const re = () => renderDocs(type, true);
  let t; $('#fq').oninput = ev => { clearTimeout(t); t = setTimeout(() => { st.q = ev.target.value; st.limit = 200; re(); }, 200); };
  if (keep && st.q) { const f = $('#fq'); if (document.activeElement?.id !== 'gsearch') { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }
  if ($('#fw')) $('#fw').onchange = ev => { st.wh = ev.target.value; re(); };
  $('#ff').onchange = ev => { st.from = ev.target.value; re(); };
  $('#ft').onchange = ev => { st.to = ev.target.value; re(); };
  $('#fs').onchange = ev => { st.status = ev.target.value; re(); };
  if ($('#more')) $('#more').onclick = () => { st.limit += 200; re(); };
  $$('th[data-sort]').forEach(h => h.onclick = () => { if (st.sort === h.dataset.sort) st.dir *= -1; else { st.sort = h.dataset.sort; st.dir = -1; } re(); });
  $$('tbody tr[data-id]').forEach(r => r.onclick = () => location.hash = '#/doc/' + r.dataset.id);
  $$('[data-sel]').forEach(c => c.onchange = () => { c.checked ? st.sel.add(c.dataset.sel) : st.sel.delete(c.dataset.sel); re(); });
  if ($('#selAll')) $('#selAll').onchange = ev => { shown.forEach(d => ev.target.checked ? st.sel.add(d.id) : st.sel.delete(d.id)); re(); };
  $('#bClr').onclick = () => { st.sel.clear(); re(); };
  $('#bPrint').onclick = ev => busy(ev.target, async () => {
    const list = S.docs.filter(d => st.sel.has(d.id)).sort((a, b) => a.doc_date.localeCompare(b.doc_date));
    const withLines = []; for (const d of list) withLines.push({ doc: d, lines: await S.store.getLines(d.id) });
    printDocs(withLines);
  });
  $('#xls').onclick = ev => busy(ev.target, async () => {
    const rows = [['نوع', 'شماره', 'تاریخ', 'انبار', 'انبار مقصد', 'طرف حساب', 'پروژه / محل مصرف', 'مرجع', 'وضعیت', 'ردیف', 'کد کالا', 'شرح کالا', 'مشخصات', 'واحد', 'مقدار', 'توضیح ردیف', 'ثبت‌کننده']];
    const list = docs.slice(0, 3000);
    for (const d of list) {
      const ls = await S.store.getLines(d.id);
      ls.forEach((l, i) => { const it = itemOf(l.item_id) || {}; rows.push([DT[d.type].fa, d.doc_no, d.doc_date, whName(d.warehouse_id), d.to_warehouse_id ? whName(d.to_warehouse_id) : '', d.party || '', d.project || '', d.ref_no || '', d.status === 'void' ? 'باطل' : 'معتبر', i + 1, it.code, it.name, it.spec || '', it.unit, +l.qty, l.note || '', d.created_name || '']); });
    }
    downloadXlsx(title, [{ name: title, rows }]);
  });
}

/* ============================ نمایش سند ============================ */
async function renderDoc(id) {
  const d = S.docs.find(x => x.id === id) || await S.store.getDoc(id);
  if (!d) { $('#view').innerHTML = '<div class="card empty"><b>سند پیدا نشد</b></div>'; return; }
  const lines = await S.store.getLines(id);
  const t = DT[d.type];
  const kv = (l, v, cls = '') => `<div><span class="kv-l">${l}</span><div class="kv-v ${cls}">${v || '<span class="ro-empty">—</span>'}</div></div>`;
  const totalW = lines.reduce((a, l) => a + (+(itemOf(l.item_id)?.weight || 0)) * Math.abs(+l.qty), 0);
  const isAdmin = can.admin();
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>${dtTag(d.type)} ${t.fa} <span class="mono">${esc(d.doc_no)}</span> ${voidBadge(d)}</h1>
      <div class="sub">ثبت: ${esc(d.created_name || '—')} · ${Jalali.isoToJalali(d.created_at)}${d.updated_at && d.updated_at !== d.created_at ? ` · آخرین ویرایش ${Jalali.isoToJalali(d.updated_at)}` : ''}</div></div>
      <div class="actions">
        <button class="btn" onclick="history.length>1?history.back():location.hash='#/docs/${d.type}'">${ICON.back}بازگشت</button>
        <button class="btn" id="pr">${ICON.print}چاپ</button>
        ${can.write(d.warehouse_id) ? `<a class="btn" href="#/new/${d.type}/${d.id}">${ICON.copy}کپی به سند جدید</a>` : ''}
        ${isAdmin && d.status !== 'void' ? `<a class="btn" href="#/edit/${d.id}">${ICON.edit}ویرایش</a><button class="btn danger" id="vd">${ICON.ban}ابطال</button>` : ''}
        ${isAdmin && d.status === 'void' ? `<button class="btn danger" id="del">${ICON.trash}حذف کامل</button>` : ''}
      </div></div>
    ${d.status === 'void' ? `<div class="card warn-box">این سند باطل شده و در موجودی اثری ندارد.${d.void_reason ? ` علت: <b>${esc(d.void_reason)}</b>` : ''}</div>` : ''}
    <div class="card">
      <div class="hdr-grid">
        ${kv(d.type === 'transfer' ? 'انبار مبدأ' : 'انبار', esc(whName(d.warehouse_id)))}
        ${d.type === 'transfer' ? kv('انبار مقصد', esc(whName(d.to_warehouse_id))) : kv('تاریخ', esc(d.doc_date), 'mono')}
        ${d.type === 'transfer' ? kv('تاریخ', esc(d.doc_date), 'mono') : kv(t.party, esc(d.party))}
        ${d.type === 'transfer' ? kv(t.party, esc(d.party)) : kv('پروژه / محل مصرف', esc(d.project))}
        ${kv(t.ref, esc(d.ref_no), 'mono')}
        ${d.type === 'transfer' ? kv('پروژه', esc(d.project)) : ''}
        ${kv('تعداد ردیف', lines.length, 'mono')}
        ${totalW ? kv('وزن تقریبی', fmtQ(totalW) + ' kg', 'mono') : ''}
      </div>
      ${d.notes ? `<div class="sec"><div class="sec-t">توضیحات</div><div class="ro-text">${esc(d.notes)}</div></div>` : ''}
      <div class="tbl-wrap"><table class="tbl lines-ro"><thead><tr><th style="width:40px">#</th><th>کد</th><th>شرح کالا</th><th>مشخصات</th><th>واحد</th><th>مقدار</th><th>موجودی فعلی</th><th>توضیح</th></tr></thead><tbody>
        ${lines.map((l, i) => { const it = itemOf(l.item_id) || { name: '(کالای حذف‌شده)' }; return `<tr onclick="location.hash='#/item/${l.item_id}'">
          <td class="mono muted">${i + 1}</td><td class="mono">${esc(it.code)}</td><td>${esc(it.name)} ${kindTag(it.kind)}</td><td class="muted">${esc(it.spec || '')}</td><td>${esc(it.unit)}</td>
          <td class="mono num" style="font-weight:700;font-size:15px">${fmtQ(l.qty)}</td><td class="mono num muted">${fmtQ(stockOf(d.warehouse_id, l.item_id))}</td><td class="muted">${esc(l.note || '')}</td></tr>`; }).join('')}
      </tbody></table></div>
    </div>`;
  $('#pr').onclick = () => printDocs([{ doc: d, lines }]);
  if ($('#vd')) $('#vd').onclick = async () => {
    const reason = await promptBox('ابطال سند', `علت ابطال ${esc(docLabel(d))} — موجودی کالاها برمی‌گردد`, '', 'ابطال سند');
    if (reason === null) return;
    try { await S.store.voidDoc(d.id, reason); }
    catch (e) {
      if (!/موجودی کافی نیست/.test(e.message) || !(await confirmBox(esc(e.message) + '<br><br>با این حال باطل شود؟ (موجودی منفی می‌شود)', 'ابطال با موجودی منفی'))) return toast(e.message, 'err');
      await S.store.voidDoc(d.id, reason, true);
    }
    await reloadStock(); toast('سند باطل شد', 'ok'); route();
  };
  if ($('#del')) $('#del').onclick = async () => {
    if (!(await confirmBox(`سند باطل‌شده ${esc(docLabel(d))} برای همیشه حذف شود؟`, 'حذف'))) return;
    await busy(null, async () => { await S.store.deleteDoc(d.id); await log('delete', 'doc', docLabel(d), '', d.warehouse_id, d.id); await reloadStock(); location.hash = '#/docs/' + d.type; });
  };
}

/* ============================ فرم سند ============================ */
async function renderForm(id, type, copyFrom) {
  let doc, lines = [];
  if (id) {
    doc = S.docs.find(x => x.id === id) || await S.store.getDoc(id);
    if (!doc) return void ($('#view').innerHTML = '<div class="card empty"><b>سند پیدا نشد</b></div>');
    if (!can.admin()) return void ($('#view').innerHTML = '<div class="card empty"><b>ویرایش سند فقط توسط مدیر انبار ممکن است</b></div>');
    lines = await S.store.getLines(id); type = doc.type;
  } else {
    if (!DT[type]) type = 'receipt';
    const wws = writableWh();
    if (!wws.length) return void ($('#view').innerHTML = '<div class="card empty"><b>شما اجازه ثبت سند در هیچ انباری را ندارید</b></div>');
    const defWh = wws.some(w => w.id === S.whId) ? S.whId : (wws.find(w => w.id === localStorage.getItem('wh_last')) || wws[0]).id;
    doc = { type, warehouse_id: defWh, doc_date: Jalali.today(), doc_no: '' };
    if (copyFrom) {
      const src = S.docs.find(x => x.id === copyFrom);
      if (src) { const { party, project, ref_no, notes, to_warehouse_id } = src; Object.assign(doc, { party, project, ref_no, notes, to_warehouse_id }); if (can.write(src.warehouse_id)) doc.warehouse_id = src.warehouse_id; lines = (await S.store.getLines(copyFrom)).map(l => ({ item_id: l.item_id, qty: l.qty, note: l.note })); }
    }
  }
  const t = DT[type];
  const whOpts = (sel, list) => list.map(w => `<option value="${w.id}" ${w.id === sel ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
  const srcList = id ? S.warehouses : writableWh();
  const dl = (name, vals) => `<datalist id="${name}">${[...new Set(vals.filter(Boolean))].slice(0, 300).map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>${dtTag(type)} ${id ? 'ویرایش ' + t.fa + ' ' + esc(doc.doc_no) : t.fa + ' جدید'}</h1>
      <div class="sub">${type === 'adjust' ? 'مقدار مثبت = افزایش موجودی، منفی = کاهش (مثلاً اختلاف انبارگردانی)' : type === 'transfer' ? 'از موجودی انبار مبدأ کم و به انبار مقصد اضافه می‌شود' : t.sign > 0 ? 'به موجودی انبار اضافه می‌شود' : 'از موجودی انبار کم می‌شود'}</div></div>
      ${!id ? `<div class="actions type-switch">${DT_KEYS.map(k => `<a class="btn sm ${k === type ? 'on' : ''}" href="#/new/${k}" style="--c:${DT[k].color}">${DT[k].short}</a>`).join('')}</div>` : ''}</div>
    <form class="card" id="docForm" autocomplete="off">
      <div class="sec"><div class="fgrid" style="--cols:4">
        <div class="fld"><label class="l">${type === 'transfer' ? 'انبار مبدأ' : 'انبار'} *</label><select name="warehouse_id" required>${whOpts(doc.warehouse_id, srcList)}</select></div>
        ${type === 'transfer' ? `<div class="fld"><label class="l">انبار مقصد *</label><select name="to_warehouse_id" required><option value="">— انتخاب —</option>${whOpts(doc.to_warehouse_id, S.warehouses.filter(w => w.active !== false || w.id === doc.to_warehouse_id))}</select></div>` : ''}
        <div class="fld"><label class="l">تاریخ *</label>${dateInput('name="doc_date"', doc.doc_date)}</div>
        <div class="fld"><label class="l">شماره سند <small>خالی = خودکار</small></label><input name="doc_no" value="${esc(doc.doc_no)}" class="mono" dir="ltr" placeholder="${esc(Jalali.today().slice(0, 4))}-0001"></div>
        <div class="fld"><label class="l">${t.party}</label><input name="party" value="${esc(doc.party)}" list="dlParty" dir="auto"></div>
        <div class="fld"><label class="l">${type === 'receipt' ? 'پروژه' : 'پروژه / محل مصرف'}</label><input name="project" value="${esc(doc.project)}" list="dlProj" dir="auto"></div>
        <div class="fld"><label class="l">${t.ref}</label><input name="ref_no" value="${esc(doc.ref_no)}" dir="auto"></div>
        <div class="fld wide"><label class="l">توضیحات</label><input name="notes" value="${esc(doc.notes)}" dir="auto"></div>
      </div></div>
      <div class="sec"><div class="sec-t">ردیف‌های کالا</div>
        <div class="tbl-wrap"><table class="lines" id="lines"><thead><tr><th style="width:34px">#</th><th>کالا (کد یا نام را تایپ کنید)</th><th style="width:70px">واحد</th><th style="width:110px">موجودی</th><th style="width:120px">مقدار *</th><th>توضیح</th><th style="width:40px"></th></tr></thead><tbody></tbody></table></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <button type="button" class="btn sm" id="addLine">${ICON.plus}ردیف</button>
          <button type="button" class="btn sm" id="pasteXl" title="ستون اول کد کالا، ستون دوم مقدار، ستون سوم توضیح">${ICON.excel}چسباندن از اکسل</button>
          ${can.writeAny() ? `<button type="button" class="btn sm" id="newItem">${ICON.box}تعریف کالای جدید</button>` : ''}
          <span class="muted" id="lineSum" style="margin-inline-start:auto;font-size:12.5px"></span>
        </div></div>
      <div class="form-actions">
        <button class="btn primary" type="submit">${ICON.in}${id ? 'ذخیره تغییرات' : 'ثبت ' + t.short}</button>
        ${!id ? '<button class="btn" type="button" id="saveNew">ثبت و سند جدید</button>' : ''}
        <button class="btn" type="button" onclick="history.back()">انصراف</button>
        <span class="muted" style="font-size:12px;align-self:center;margin-inline-start:auto">Ctrl+S ذخیره · Enter در مقدار = ردیف بعد</span>
      </div>
    </form>
    ${dl('dlParty', S.docs.filter(x => x.type === type).map(x => x.party))}${dl('dlProj', S.docs.map(x => x.project).concat(S.warehouses.map(w => w.project)))}`;
  const form = $('#docForm'), tb = $('#lines tbody');
  bindDateInputs(form);
  form.addEventListener('input', () => { S.dirty = true; });
  form.addEventListener('change', () => { S.dirty = true; });
  const curWh = () => form.warehouse_id.value;
  const sumUp = () => {
    const rows = $$('tr[data-line]', tb).filter(r => r.dataset.item);
    const qty = rows.reduce((a, r) => a + num(r.querySelector('[data-q]').value), 0);
    const w = rows.reduce((a, r) => a + (+(itemOf(r.dataset.item)?.weight || 0)) * Math.abs(num(r.querySelector('[data-q]').value)), 0);
    $('#lineSum').textContent = `${rows.length} قلم · جمع مقادیر ${fmtQ(qty)}${w ? ` · وزن ≈ ${fmtQ(w)} kg` : ''}`;
  };
  const refreshRow = tr => {
    const it = itemOf(tr.dataset.item);
    tr.querySelector('[data-u]').textContent = it?.unit || '';
    const s = it ? stockOf(curWh(), it.id) : null;
    const st = tr.querySelector('[data-s]');
    const q = num(tr.querySelector('[data-q]').value);
    const after = s === null ? null : s + (type === 'adjust' ? q : t.sign * q) + (id && doc.warehouse_id === curWh() ? -(type === 'adjust' ? 1 : t.sign) * (lines.filter(l => l.item_id === it.id).reduce((a, l) => a + +l.qty, 0)) : 0);
    st.innerHTML = s === null ? '' : `${fmtQ(s)}${q ? ` <span class="${after < 0 ? 'neg' : 'muted'}">→ ${fmtQ(after)}</span>` : ''}`;
    sumUp();
  };
  const addRow = (l = {}, focus) => {
    const tr = document.createElement('tr'); tr.dataset.line = '1';
    const it = l.item_id ? itemOf(l.item_id) : null; if (it) tr.dataset.item = it.id;
    tr.innerHTML = `<td class="mono muted" data-n></td>
      <td class="ac-cell"><input data-it value="${it ? esc(it.code + ' — ' + it.name + (it.spec ? ' (' + it.spec + ')' : '')) : ''}" placeholder="جستجوی کالا…" dir="auto"></td>
      <td data-u class="muted">${esc(it?.unit || '')}</td><td data-s class="mono num" style="font-size:12.5px"></td>
      <td><input data-q placeholder="مقدار" value="${l.qty ? fmtQ(l.qty).replace(/,/g, '') : ''}" inputmode="decimal" class="mono" dir="ltr" style="text-align:center"></td>
      <td><input data-note placeholder="توضیح" value="${esc(l.note || '')}" dir="auto"></td>
      <td><button type="button" class="icon-btn sm-x" data-rm title="حذف ردیف">${ICON.x}</button></td>`;
    tb.appendChild(tr);
    const inp = tr.querySelector('[data-it]');
    itemPicker(inp, picked => {
      tr.dataset.item = picked.id; inp.value = picked.code + ' — ' + picked.name + (picked.spec ? ' (' + picked.spec + ')' : '');
      const dup = $$('tr[data-line]', tb).find(r => r !== tr && r.dataset.item === picked.id);
      if (dup) toast('این کالا در ردیف دیگری هم هست');
      refreshRow(tr); tr.querySelector('[data-q]').focus();
    }, () => curWh(), () => { delete tr.dataset.item; refreshRow(tr); });
    tr.querySelector('[data-q]').addEventListener('input', () => refreshRow(tr));
    tr.querySelector('[data-q]').addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); const next = tr.nextElementSibling; if (next) next.querySelector('[data-it]').focus(); else addRow({}, true); }
    });
    tr.querySelector('[data-rm]').onclick = () => { tr.remove(); renumber(); sumUp(); S.dirty = true; };
    renumber(); refreshRow(tr);
    if (focus) inp.focus();
    return tr;
  };
  const renumber = () => $$('tr[data-line]', tb).forEach((r, i) => r.querySelector('[data-n]').textContent = i + 1);
  (lines.length ? lines : [{}, {}, {}]).forEach(l => addRow(l));
  form.warehouse_id.onchange = () => { $$('tr[data-line]', tb).forEach(refreshRow); localStorage.setItem('wh_last', curWh()); };
  $('#addLine').onclick = () => addRow({}, true);
  if ($('#newItem')) $('#newItem').onclick = () => itemModal(null, it => { const empty = $$('tr[data-line]', tb).find(r => !r.dataset.item) || addRow(); empty.remove(); addRow({ item_id: it.id }, false).querySelector('[data-q]').focus(); });
  $('#pasteXl').onclick = () => {
    const m = modal('چسباندن ردیف‌ها از اکسل', `<p class="muted" style="margin-top:0;font-size:13px">در اکسل ستون‌های <b>کد کالا</b>، <b>مقدار</b> و (اختیاری) <b>توضیح</b> را انتخاب و کپی کنید و اینجا بچسبانید.</p><textarea id="pt" rows="10" class="mono" dir="ltr"></textarea>`, { footer: '<button class="btn primary" id="ptOk">افزودن ردیف‌ها</button><button class="btn" data-close>انصراف</button>' });
    $('#pt', m.el).focus();
    $('#ptOk', m.el).onclick = () => {
      const bad = []; let n = 0;
      $('#pt', m.el).value.split(/\r?\n/).map(r => r.split('\t')).filter(r => r[0]?.trim()).forEach(([code, qty, note]) => {
        const it = S.itemByCode.get(normFa(code)) || S.items.find(i => normFa(i.name) === normFa(code));
        if (!it) return bad.push(code.trim());
        $$('tr[data-line]', tb).filter(r => !r.dataset.item && !r.querySelector('[data-q]').value).forEach(r => r.remove());
        addRow({ item_id: it.id, qty: num(qty), note: (note || '').trim() }); n++;
      });
      m.close(); renumber(); S.dirty = true;
      toast(`${n} ردیف اضافه شد` + (bad.length ? ` · پیدا نشد: ${bad.slice(0, 8).join('، ')}${bad.length > 8 ? '…' : ''}` : ''), bad.length ? 'err' : 'ok');
    };
  };
  const collect = () => {
    const f = Object.fromEntries(['warehouse_id', 'to_warehouse_id', 'doc_date', 'doc_no', 'party', 'project', 'ref_no', 'notes'].filter(k => form[k]).map(k => [k, form[k].value.trim()]));
    f.doc_date = Jalali.normalize(f.doc_date); f.doc_no = faToEn(f.doc_no);
    const ls = []; const err = [];
    $$('tr[data-line]', tb).forEach((r, i) => {
      const q = r.querySelector('[data-q]').value.trim(), txt = r.querySelector('[data-it]').value.trim();
      if (!r.dataset.item) { if (txt || q) err.push(`ردیف ${i + 1}: کالا از فهرست انتخاب نشده`); return; }
      ls.push({ item_id: r.dataset.item, qty: num(q), note: r.querySelector('[data-note]').value.trim() });
    });
    if (err.length) throw new Error(err.join(' · '));
    return { doc: { ...(id ? { id } : {}), type, ...f }, lines: ls };
  };
  const save = async (andNew) => {
    const { doc: payload, lines: ls } = collect();
    let saved;
    try { saved = await S.store.saveDoc(payload, ls); }
    catch (e) {
      if (!/موجودی کافی نیست/.test(e.message) || !can.admin()) throw e;
      if (!(await confirmBox(esc(e.message) + '<br><br>به عنوان مدیر انبار با موجودی منفی ثبت شود؟', 'ثبت با موجودی منفی'))) return;
      saved = await S.store.saveDoc(payload, ls, true);
    }
    S.dirty = false; await reloadStock();
    toast(`${t.short} ${saved.doc_no} ${id ? 'ذخیره' : 'ثبت'} شد`, 'ok');
    if (andNew) { S.skipRoute = false; renderForm(null, type); history.replaceState(null, '', '#/new/' + type); }
    else location.hash = '#/doc/' + saved.id;
  };
  form.onsubmit = ev => { ev.preventDefault(); busy(form.querySelector('[type=submit]'), () => save(false)); };
  if ($('#saveNew')) $('#saveNew').onclick = ev => busy(ev.target, () => save(true));
  setTimeout(() => (lines.length ? null : tb.querySelector('[data-it]'))?.focus(), 50);
}

/* ---------- انتخابگر کالا با جستجوی فارسی ---------- */
function itemPicker(input, onPick, whFn, onClear) {
  let box, list = [], idx = 0;
  const close = () => { box?.remove(); box = null; };
  const draw = () => {
    if (!box) { box = document.createElement('div'); box.className = 'ac'; document.body.appendChild(box); }
    const r = input.getBoundingClientRect();
    Object.assign(box.style, { top: (window.scrollY + r.bottom + 4) + 'px', left: (window.scrollX + r.left) + 'px', width: Math.max(r.width, 420) + 'px' });
    if (r.left + Math.max(r.width, 420) > window.innerWidth) box.style.left = Math.max(8, window.scrollX + r.right - Math.max(r.width, 420)) + 'px';
    const w = whFn?.();
    box.innerHTML = list.length ? list.map((it, i) => `<div class="ac-i ${i === idx ? 'on' : ''}" data-i="${i}"><span class="mono ac-code">${esc(it.code)}</span><span class="ac-name">${esc(it.name)}${it.spec ? ` <small>${esc(it.spec)}</small>` : ''}</span>${kindTag(it.kind)}<span class="mono ac-st ${w && stockOf(w, it.id) <= 0 ? 'zero' : ''}">${w ? fmtQ(stockOf(w, it.id)) + ' ' + esc(it.unit) : ''}</span></div>`).join('')
      : `<div class="ac-empty">کالایی پیدا نشد${can.writeAny() ? ' — از دکمه «تعریف کالای جدید» استفاده کنید' : ''}</div>`;
    $$('.ac-i', box).forEach(el => el.onmousedown = ev => { ev.preventDefault(); pick(+el.dataset.i); });
  };
  const search = () => {
    const q = input.value.trim(); idx = 0;
    const w = whFn?.();
    const exact = S.itemByCode.get(normFa(q));
    let res = S.items.filter(i => i.active !== false && matchQ(itemText(i), q));
    if (w) res.sort((a, b) => (stockOf(w, b.id) > 0) - (stockOf(w, a.id) > 0));
    if (exact) res = [exact, ...res.filter(x => x !== exact)];
    list = res.slice(0, 14); draw();
  };
  const pick = i => { const it = list[i]; if (!it) return; close(); onPick(it); };
  input.addEventListener('input', () => { onClear?.(); search(); });
  input.addEventListener('focus', () => input.select());
  input.addEventListener('click', () => { if (!box) search(); });
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', ev => {
    if (!box) { if (ev.key === 'ArrowDown') { ev.preventDefault(); search(); } return; }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); idx = Math.min(list.length - 1, idx + 1); draw(); box.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); idx = Math.max(0, idx - 1); draw(); box.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }
    else if (ev.key === 'Enter') { ev.preventDefault(); pick(idx); }
    else if (ev.key === 'Escape') close();
  });
}

/* ============================ چاپ ============================ */
function printDocs(list) {
  const company = S.settings.company || 'فولاد تکنیک';
  const html = list.map(({ doc: d, lines }) => {
    const t = DT[d.type];
    const totalW = lines.reduce((a, l) => a + (+(itemOf(l.item_id)?.weight || 0)) * Math.abs(+l.qty), 0);
    const rows = lines.map((l, i) => { const it = itemOf(l.item_id) || {}; return `<tr><td>${i + 1}</td><td class="m">${esc(it.code)}</td><td class="r">${esc(it.name)}</td><td>${esc(it.spec || '')}</td><td>${esc(it.unit)}</td><td class="m b">${fmtQ(l.qty)}</td><td class="r">${esc(l.note || '')}</td></tr>`; }).join('');
    const pad = Math.max(0, 12 - lines.length);
    return `<div class="pv">
      <table class="pv-h"><tr>
        <td style="width:30%"><b style="font-size:15px">${esc(company)}</b><br><span>${esc(t.fa === 'انتقال بین انبارها' ? 'واحد انبار' : 'واحد انبار')}</span></td>
        <td style="width:40%;text-align:center"><div class="pv-t">${esc(t.fa)}</div>${d.status === 'void' ? '<div class="pv-void">باطل شده</div>' : ''}</td>
        <td style="width:30%"><div>شماره: <b class="m">${esc(d.doc_no)}</b></div><div>تاریخ: <b class="m">${esc(d.doc_date)}</b></div></td></tr></table>
      <table class="pv-i"><tr>
        <td><span>${d.type === 'transfer' ? 'انبار مبدأ' : 'انبار'}:</span> <b>${esc(whName(d.warehouse_id))}</b></td>
        ${d.type === 'transfer' ? `<td><span>انبار مقصد:</span> <b>${esc(whName(d.to_warehouse_id))}</b></td>` : ''}
        <td><span>${t.party}:</span> <b>${esc(d.party || '')}</b></td></tr><tr>
        <td><span>پروژه / محل مصرف:</span> <b>${esc(d.project || '')}</b></td>
        <td ${d.type === 'transfer' ? 'colspan="2"' : ''}><span>${t.ref}:</span> <b>${esc(d.ref_no || '')}</b></td></tr></table>
      <table class="pv-l"><thead><tr><th style="width:28px">ردیف</th><th style="width:80px">کد کالا</th><th>شرح کالا</th><th style="width:110px">مشخصات</th><th style="width:48px">واحد</th><th style="width:70px">مقدار</th><th style="width:140px">توضیحات</th></tr></thead>
        <tbody>${rows}${'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(pad)}</tbody></table>
      <div class="pv-n">${d.notes ? `<b>توضیحات:</b> ${esc(d.notes)}` : ''}${totalW ? `<span style="float:left">وزن تقریبی: <b class="m">${fmtQ(totalW)}</b> kg</span>` : ''}</div>
      <table class="pv-s"><tr>${t.signs.map(s => `<td><div>${s}</div><div class="sl">نام و امضا</div></td>`).join('')}</tr></table>
      <div class="pv-f"><span>ثبت: ${esc(d.created_name || '')} · ${Jalali.isoToJalali(d.created_at)}</span><span>انباریار</span></div>
    </div>`;
  }).join('');
  $('#print-area').innerHTML = html;
  setTimeout(() => window.print(), 50);
}
