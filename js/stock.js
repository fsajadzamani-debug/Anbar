/* ======================================================
   انباریار — موجودی، کاردکس، کالاها، اموال، گزارش‌ها
   ====================================================== */

/* ============================ موجودی ============================ */
function renderStock(keep) {
  const st = S.listState.stock = { q: '', kind: '', cat: '', only: 'pos', sort: 'code', dir: 1, limit: 300, ...(S.listState.stock || {}) };
  const whs = selWh();
  const matrix = whs.length > 1;
  const cats = [...new Set(S.items.map(i => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fa'));
  let rows = S.items.map(it => ({ it, per: whs.map(w => stockOf(w.id, it.id)), last: whs.map(w => S.stockMap.get(w.id + '|' + it.id)?.last_date || '').sort().pop() || '' }))
    .map(r => ({ ...r, total: r.per.reduce((a, b) => a + b, 0) }));
  if (st.q) rows = rows.filter(r => matchQ(itemText(r.it), st.q));
  if (st.kind) rows = rows.filter(r => r.it.kind === st.kind);
  if (st.cat) rows = rows.filter(r => r.it.category === st.cat);
  if (st.only === 'pos') rows = rows.filter(r => r.per.some(x => Math.abs(x) > 1e-9));
  if (st.only === 'low') rows = rows.filter(r => +r.it.min_qty > 0 && r.total < +r.it.min_qty);
  if (st.only === 'neg') rows = rows.filter(r => r.per.some(x => x < -1e-9));
  const cmp = { code: (a, b) => String(a.it.code).localeCompare(b.it.code, undefined, { numeric: true }), name: (a, b) => a.it.name.localeCompare(b.it.name, 'fa'), total: (a, b) => a.total - b.total, last: (a, b) => a.last.localeCompare(b.last) }[st.sort] || ((a, b) => a.per[+st.sort] - b.per[+st.sort]);
  rows.sort((a, b) => cmp(a, b) * st.dir);
  const shown = rows.slice(0, st.limit);
  const th = (k, l, cls = '') => `<th data-sort="${k}" class="${st.sort === String(k) ? 'sorted' : ''} ${cls}">${l}${st.sort === String(k) ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
  const totalW = rows.reduce((a, r) => a + (+r.it.weight || 0) * Math.max(0, r.total), 0);
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>موجودی انبار</h1><div class="sub">${S.whId === 'all' ? `${whs.length} انبار` : esc(whName(S.whId))} · ${rows.length} قلم${totalW ? ` · وزن کل ≈ ${fmtQ(Math.round(totalW / 100) / 10)} تن` : ''}</div></div>
      <div class="actions"><button class="btn" id="xls">${ICON.excel}خروجی اکسل</button><button class="btn" id="prt">${ICON.print}چاپ</button></div></div>
    <div class="card">
      <div class="filters">
        <input id="fq" type="search" placeholder="جستجو: کد، نام، مشخصات…" value="${esc(st.q)}" style="flex:1;min-width:200px">
        <select id="fk"><option value="">همه گروه‌ها</option>${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${st.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        ${cats.length ? `<select id="fc"><option value="">همه دسته‌ها</option>${cats.map(c => `<option ${st.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : ''}
        <select id="fo"><option value="pos" ${st.only === 'pos' ? 'selected' : ''}>دارای موجودی</option><option value="" ${!st.only ? 'selected' : ''}>همه کالاها</option><option value="low" ${st.only === 'low' ? 'selected' : ''}>کمتر از حداقل</option><option value="neg" ${st.only === 'neg' ? 'selected' : ''}>موجودی منفی</option></select>
      </div>
      ${shown.length ? `<div class="tbl-wrap stock-wrap"><table class="tbl stock"><thead><tr>
        ${th('code', 'کد')}${th('name', 'شرح کالا')}<th>واحد</th>
        ${matrix ? whs.map((w, i) => th(i, `<span class="wh-col">${esc(w.name)}</span>`, 'num')).join('') + th('total', 'جمع', 'num') : th('total', 'موجودی', 'num') + '<th class="num">حداقل</th>'}
        ${th('last', 'آخرین گردش')}</tr></thead><tbody>
        ${shown.map(r => `<tr data-id="${r.it.id}" class="${r.it.active === false ? 'inactive' : ''}">
          <td class="mono" style="white-space:nowrap">${hilite(r.it.code, st.q)}</td>
          <td class="subj" title="${esc(r.it.name + (r.it.spec ? ' — ' + r.it.spec : ''))}">${hilite(r.it.name, st.q)}${r.it.spec ? ` <small class="muted">${hilite(r.it.spec, st.q)}</small>` : ''} ${kindTag(r.it.kind)}</td>
          <td class="muted">${esc(r.it.unit)}</td>
          ${matrix ? r.per.map(x => qCell(x)).join('') + qCell(r.total, 'tot') : qCell(r.total, 'tot') + `<td class="mono num muted">${+r.it.min_qty ? fmtQ(r.it.min_qty) : ''}</td>`}
          <td class="mono muted" style="font-size:12px">${esc(r.last)}</td></tr>`).join('')}
      </tbody></table></div>
      ${rows.length > shown.length ? `<div style="padding:12px;text-align:center"><button class="btn" id="more">نمایش بیشتر (${rows.length - shown.length} باقی‌مانده)</button></div>` : ''}`
      : `<div class="empty"><b>${S.items.length ? 'کالایی با این شرایط پیدا نشد' : 'هنوز کالایی تعریف نشده'}</b>${!S.items.length && can.writeAny() ? '<a href="#/import">ورود فهرست کالا از اکسل</a>' : ''}</div>`}
    </div>`;
  const re = () => renderStock(true);
  let t; $('#fq').oninput = ev => { clearTimeout(t); t = setTimeout(() => { st.q = ev.target.value; st.limit = 300; re(); }, 200); };
  if (keep && st.q && document.activeElement?.id !== 'gsearch') { const f = $('#fq'); f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
  $('#fk').onchange = ev => { st.kind = ev.target.value; re(); };
  if ($('#fc')) $('#fc').onchange = ev => { st.cat = ev.target.value; re(); };
  $('#fo').onchange = ev => { st.only = ev.target.value; re(); };
  if ($('#more')) $('#more').onclick = () => { st.limit += 300; re(); };
  $$('th[data-sort]').forEach(h => h.onclick = () => { if (st.sort === h.dataset.sort) st.dir *= -1; else { st.sort = h.dataset.sort; st.dir = ['total', 'last'].includes(h.dataset.sort) || /^\d+$/.test(h.dataset.sort) ? -1 : 1; } re(); });
  $$('tbody tr[data-id]').forEach(r => r.onclick = () => location.hash = '#/item/' + r.dataset.id);
  const sheet = () => [['کد', 'شرح کالا', 'مشخصات', 'گروه', 'دسته', 'واحد', ...(matrix ? whs.map(w => w.name) : []), matrix ? 'جمع' : 'موجودی', 'حداقل', 'آخرین گردش'],
    ...rows.map(r => [r.it.code, r.it.name, r.it.spec || '', KINDS[r.it.kind] || '', r.it.category || '', r.it.unit, ...(matrix ? r.per : []), r.total, +r.it.min_qty || '', r.last])];
  $('#xls').onclick = () => downloadXlsx('موجودی-' + (S.whId === 'all' ? 'همه-انبارها' : whName(S.whId)), [{ name: 'موجودی', rows: sheet() }]);
  $('#prt').onclick = () => printTable(`گزارش موجودی — ${S.whId === 'all' ? 'همه انبارها' : whName(S.whId)}`, sheet().map(r => r.filter((_, i) => i !== 3 && i !== 4)));
}
function printTable(title, rows) {
  const [h, ...body] = rows;
  $('#print-area').innerHTML = `<div class="pv pv-table"><table class="pv-h"><tr><td><b>${esc(S.settings.company || '')}</b></td><td style="text-align:center"><div class="pv-t">${esc(title)}</div></td><td style="text-align:left">تاریخ: <b class="m">${Jalali.today()}</b></td></tr></table>
    <table class="pv-l"><thead><tr><th>#</th>${h.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${body.map((r, i) => `<tr><td>${i + 1}</td>${r.map(c => `<td class="${typeof c === 'number' ? 'm' : 'r'}">${typeof c === 'number' ? fmtQ(c) : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  setTimeout(() => window.print(), 50);
}

/* ============================ کارت کالا + کاردکس ============================ */
async function renderItem(id) {
  const it = itemOf(id);
  if (!it) { $('#view').innerHTML = '<div class="card empty"><b>کالا پیدا نشد</b></div>'; return; }
  const st = S.listState['k_' + id] = { wh: S.whId !== 'all' ? S.whId : '', from: '', to: '', ...(S.listState['k_' + id] || {}) };
  const whs = myWh();
  const per = whs.map(w => ({ w, q: stockOf(w.id, id), s: S.stockMap.get(w.id + '|' + id) })).filter(x => x.s);
  const moves = await S.store.listMoves({ item_id: id, warehouse_id: st.wh || undefined });
  moves.sort((a, b) => a.doc_date.localeCompare(b.doc_date) || String(a.created_at).localeCompare(b.created_at));
  let bal = 0;
  const rows = moves.map(m => { bal += +m.qty; return { ...m, bal }; });
  const opening = rows.filter(r => st.from && r.doc_date < Jalali.normalize(st.from)).pop()?.bal || 0;
  const shownRows = rows.filter(r => (!st.from || r.doc_date >= Jalali.normalize(st.from)) && (!st.to || r.doc_date <= Jalali.normalize(st.to)));
  const tIn = shownRows.filter(r => r.qty > 0).reduce((a, r) => a + +r.qty, 0), tOut = shownRows.filter(r => r.qty < 0).reduce((a, r) => a - r.qty, 0);
  const assets = S.assets.filter(a => a.item_id === id);
  const typeFa = m => m.type === 'transfer_in' ? 'انتقال (ورود)' : m.type === 'transfer' ? 'انتقال (خروج)' : DT[m.type]?.short;
  $('#view').innerHTML = `
    <div class="page-head"><div><h1><span class="mono">${esc(it.code)}</span> — ${esc(it.name)} ${kindTag(it.kind)}${it.active === false ? ' <span class="badge" style="background:#64748b1a;color:#64748b">غیرفعال</span>' : ''}</h1>
      <div class="sub">${esc([it.spec, it.category, 'واحد: ' + it.unit, it.weight ? `وزن واحد ${fmtQ(it.weight)} kg` : '', +it.min_qty ? `حداقل ${fmtQ(it.min_qty)}` : ''].filter(Boolean).join(' · '))}</div></div>
      <div class="actions"><button class="btn" onclick="history.back()">${ICON.back}بازگشت</button>
        ${can.admin() ? `<button class="btn" id="ed">${ICON.edit}ویرایش کالا</button>` : ''}
        <button class="btn" id="xls">${ICON.excel}کاردکس اکسل</button></div></div>
    <div class="grid-2 item-grid">
      <div class="card"><div class="card-h">${ICON.stock}کاردکس کالا
        <div class="actions" style="flex-wrap:wrap">
          <select id="kw" class="btn sm"><option value="">همه انبارها</option>${whs.map(w => `<option value="${w.id}" ${st.wh === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select>
          <input id="kf" placeholder="از تاریخ" value="${esc(st.from)}" style="width:100px" class="ltr"><input id="kt" placeholder="تا تاریخ" value="${esc(st.to)}" style="width:100px" class="ltr"></div></div>
        ${shownRows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>تاریخ</th><th>سند</th>${st.wh ? '' : '<th>انبار</th>'}<th>طرف حساب / مقصد</th><th class="num">وارده</th><th class="num">صادره</th><th class="num">مانده</th></tr></thead><tbody>
          ${st.from ? `<tr class="open-row"><td colspan="${st.wh ? 4 : 5}">مانده از قبل</td><td></td><td class="mono num">${fmtQ(opening)}</td></tr>` : ''}
          ${shownRows.map(m => `<tr onclick="location.hash='#/doc/${m.doc_id}'"><td class="mono">${esc(m.doc_date)}</td><td style="white-space:nowrap">${dtTag(m.type === 'transfer_in' ? 'transfer' : m.type)} <span class="mono">${esc(m.doc_no)}</span> <small class="muted">${typeFa(m)}</small></td>
            ${st.wh ? '' : `<td>${esc(whName(m.warehouse_id))}</td>`}
            <td class="subj">${esc(m.other_warehouse_id ? (m.qty > 0 ? 'از ' : 'به ') + whName(m.other_warehouse_id) : [m.party, m.project].filter(Boolean).join(' · '))}</td>
            <td class="mono num in">${m.qty > 0 ? fmtQ(m.qty) : ''}</td><td class="mono num out">${m.qty < 0 ? fmtQ(-m.qty) : ''}</td><td class="mono num ${m.bal < 0 ? 'neg' : ''}" style="font-weight:700">${fmtQ(m.bal)}</td></tr>`).join('')}
          <tr class="sum-row"><td colspan="${st.wh ? 3 : 4}">جمع دوره</td><td class="mono num in">${fmtQ(tIn)}</td><td class="mono num out">${fmtQ(tOut)}</td><td class="mono num">${fmtQ(shownRows.at(-1)?.bal || 0)}</td></tr>
        </tbody></table></div>${!st.wh && whs.length > 1 ? '<div class="muted" style="padding:8px 14px;font-size:12px">در حالت «همه انبارها» انتقال‌ها دو ردیف (خروج و ورود) دارند و مانده، جمع همه انبارهاست.</div>' : ''}`
        : '<div class="empty">گردشی ثبت نشده</div>'}
      </div>
      <div>
        <div class="card"><div class="card-h">${ICON.wh}موجودی در انبارها</div>
          ${per.length ? `<table class="tbl"><tbody>${per.map(x => `<tr onclick="document.getElementById('kw').value='${x.w.id}';document.getElementById('kw').dispatchEvent(new Event('change'))"><td>${esc(x.w.name)}</td>${qCell(x.q, 'tot')}<td class="mono muted" style="font-size:12px">${esc(x.s.last_date || '')}</td></tr>`).join('')}
            <tr class="sum-row"><td>جمع</td>${qCell(per.reduce((a, x) => a + x.q, 0))}<td></td></tr></tbody></table>` : '<div class="empty">در هیچ انباری موجودی ندارد</div>'}
        </div>
        ${it.notes ? `<div class="card" style="margin-top:14px"><div class="card-b ro-text">${esc(it.notes)}</div></div>` : ''}
        ${assets.length ? `<div class="card" style="margin-top:14px"><div class="card-h">${ICON.tag}اموال این کالا (${assets.length})</div><table class="tbl"><tbody>${assets.map(a => `<tr onclick="location.hash='#/assets'"><td class="mono">${esc(a.tag_no)}</td><td>${assetBadge(a.status)}</td><td class="muted">${esc(a.holder || whName(a.warehouse_id))}</td></tr>`).join('')}</tbody></table></div>` : ''}
      </div>
    </div>`;
  const re = () => renderItem(id);
  $('#kw').onchange = ev => { st.wh = ev.target.value; re(); };
  $('#kf').onchange = ev => { st.from = ev.target.value; re(); };
  $('#kt').onchange = ev => { st.to = ev.target.value; re(); };
  if ($('#ed')) $('#ed').onclick = () => itemModal(it, () => re());
  $('#xls').onclick = () => downloadXlsx('کاردکس-' + it.code, [{ name: 'کاردکس', rows: [['تاریخ', 'نوع', 'شماره سند', 'انبار', 'طرف حساب / مقصد', 'وارده', 'صادره', 'مانده'],
    ...shownRows.map(m => [m.doc_date, typeFa(m), m.doc_no, whName(m.warehouse_id), m.other_warehouse_id ? whName(m.other_warehouse_id) : [m.party, m.project].filter(Boolean).join(' · '), m.qty > 0 ? +m.qty : '', m.qty < 0 ? -m.qty : '', m.bal])] }]);
}

/* ============================ کالاها ============================ */
function renderItems(keep) {
  const st = S.listState.items = { q: '', kind: '', act: '1', limit: 300, ...(S.listState.items || {}) };
  let items = S.items;
  if (st.q) items = items.filter(i => matchQ(itemText(i), st.q));
  if (st.kind) items = items.filter(i => i.kind === st.kind);
  if (st.act) items = items.filter(i => (i.active !== false) === (st.act === '1'));
  const shown = items.slice(0, st.limit);
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>کالاها / شناسنامه کالا</h1><div class="sub">${items.length} قلم · ${Object.entries(KINDS).map(([k, v]) => `${v}: ${S.items.filter(i => i.kind === k).length}`).join(' · ')}</div></div>
      <div class="actions"><button class="btn" id="xls">${ICON.excel}خروجی اکسل</button>
        ${can.writeAny() ? `<a class="btn" href="#/import">${ICON.import}ورود از اکسل</a><button class="btn primary" id="add">${ICON.plus}کالای جدید</button>` : ''}</div></div>
    <div class="card">
      <div class="filters">
        <input id="fq" type="search" placeholder="جستجو…" value="${esc(st.q)}" style="flex:1;min-width:200px">
        <select id="fk"><option value="">همه گروه‌ها</option>${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${st.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <select id="fa"><option value="1" ${st.act === '1' ? 'selected' : ''}>فعال</option><option value="0" ${st.act === '0' ? 'selected' : ''}>غیرفعال</option><option value="" ${!st.act ? 'selected' : ''}>همه</option></select>
      </div>
      ${shown.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>کد</th><th>شرح کالا</th><th>مشخصات</th><th>گروه</th><th>دسته</th><th>واحد</th><th class="num">وزن (kg)</th><th class="num">حداقل</th><th class="num">موجودی کل</th>${can.admin() ? '<th></th>' : ''}</tr></thead><tbody>
        ${shown.map(i => `<tr data-id="${i.id}" class="${i.active === false ? 'inactive' : ''}"><td class="mono">${hilite(i.code, st.q)}</td><td>${hilite(i.name, st.q)}</td><td class="muted">${hilite(i.spec || '', st.q)}</td><td>${kindTag(i.kind)}</td><td class="muted">${esc(i.category || '')}</td><td>${esc(i.unit)}</td>
          <td class="mono num muted">${i.weight ? fmtQ(i.weight) : ''}</td><td class="mono num muted">${+i.min_qty ? fmtQ(i.min_qty) : ''}</td>${qCell(stockTotal(i.id, myWh()))}
          ${can.admin() ? `<td onclick="event.stopPropagation()"><button class="btn sm ghost" data-ed="${i.id}">${ICON.edit}</button></td>` : ''}</tr>`).join('')}
      </tbody></table></div>${items.length > shown.length ? `<div style="padding:12px;text-align:center"><button class="btn" id="more">نمایش بیشتر</button></div>` : ''}`
      : '<div class="empty"><b>کالایی پیدا نشد</b></div>'}
    </div>`;
  const re = () => renderItems(true);
  let t; $('#fq').oninput = ev => { clearTimeout(t); t = setTimeout(() => { st.q = ev.target.value; re(); }, 200); };
  if (keep && st.q) { const f = $('#fq'); f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
  $('#fk').onchange = ev => { st.kind = ev.target.value; re(); };
  $('#fa').onchange = ev => { st.act = ev.target.value; re(); };
  if ($('#more')) $('#more').onclick = () => { st.limit += 300; re(); };
  if ($('#add')) $('#add').onclick = () => itemModal(null, () => re());
  $$('[data-ed]').forEach(b => b.onclick = () => itemModal(itemOf(b.dataset.ed), () => re()));
  $$('tbody tr[data-id]').forEach(r => r.onclick = () => location.hash = '#/item/' + r.dataset.id);
  $('#xls').onclick = () => downloadXlsx('فهرست-کالا', [{ name: 'کالاها', rows: [ITEM_COLS.map(c => c[1]), ...items.map(i => ITEM_COLS.map(([k]) => k === 'kind' ? KINDS[i.kind] : k === 'active' ? (i.active === false ? 'خیر' : 'بله') : (i[k] ?? '')))] }]);
}
const ITEM_COLS = [['code', 'کد کالا'], ['name', 'شرح کالا'], ['spec', 'مشخصات / سایز'], ['kind', 'گروه'], ['category', 'دسته'], ['unit', 'واحد'], ['weight', 'وزن واحد (kg)'], ['min_qty', 'حداقل موجودی'], ['notes', 'توضیحات'], ['active', 'فعال']];

function itemModal(it, after) {
  const isNew = !it; it = it || { kind: 'material', unit: 'عدد', min_qty: 0, active: true };
  const units = [...new Set(['عدد', 'کیلوگرم', 'تن', 'متر', 'مترمربع', 'مترمکعب', 'شاخه', 'ورق', 'کیسه', 'لیتر', 'دستگاه', 'جفت', 'رول', 'بسته', 'کارتن', 'سری', ...S.items.map(i => i.unit)])];
  const cats = [...new Set(S.items.map(i => i.category).filter(Boolean))];
  const nextCode = () => { const k = $('#iKind', m.el).value; const pre = { civil: 'C', material: 'M', consumable: 'S', tool: 'T', asset: 'A' }[k]; const max = S.items.filter(i => new RegExp('^' + pre + '-\\d+$').test(i.code)).reduce((a, i) => Math.max(a, +i.code.split('-')[1]), 0); return `${pre}-${String(max + 1).padStart(4, '0')}`; };
  const m = modal(isNew ? 'تعریف کالای جدید' : 'ویرایش کالا ' + esc(it.code), `
    <div class="fgrid" style="--cols:2">
      <div class="fld"><label class="l">گروه *</label><select id="iKind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${it.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="fld"><label class="l">کد کالا * ${isNew ? '<a href="#" id="autoCode" style="font-size:12px">پیشنهاد کد</a>' : ''}</label><input id="iCode" value="${esc(it.code)}" class="mono" dir="ltr"></div>
      <div class="fld wide"><label class="l">شرح کالا *</label><input id="iName" value="${esc(it.name)}" dir="auto"></div>
      <div class="fld"><label class="l">مشخصات / سایز</label><input id="iSpec" value="${esc(it.spec)}" dir="auto"></div>
      <div class="fld"><label class="l">دسته</label><input id="iCat" value="${esc(it.category)}" list="dlCat" dir="auto"><datalist id="dlCat">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="fld"><label class="l">واحد *</label><input id="iUnit" value="${esc(it.unit)}" list="dlUnit"><datalist id="dlUnit">${units.map(u => `<option value="${esc(u)}">`).join('')}</datalist></div>
      <div class="fld"><label class="l">وزن واحد (کیلوگرم)</label><input id="iW" value="${esc(it.weight ?? '')}" class="mono" dir="ltr" inputmode="decimal"></div>
      <div class="fld"><label class="l">حداقل موجودی (نقطه سفارش)</label><input id="iMin" value="${esc(+it.min_qty || '')}" class="mono" dir="ltr" inputmode="decimal"></div>
      <div class="fld"><label class="l">وضعیت</label><select id="iAct"><option value="1">فعال</option><option value="0" ${it.active === false ? 'selected' : ''}>غیرفعال</option></select></div>
      <div class="fld wide"><label class="l">توضیحات</label><textarea id="iNotes" rows="2" dir="auto">${esc(it.notes)}</textarea></div>
    </div>`, { footer: `<button class="btn primary" id="iSave">ذخیره</button>${!isNew && can.admin() ? `<button class="btn danger" id="iDel">${ICON.trash}حذف</button>` : ''}<button class="btn" data-close>انصراف</button>` });
  if ($('#autoCode', m.el)) { $('#autoCode', m.el).onclick = ev => { ev.preventDefault(); $('#iCode', m.el).value = nextCode(); }; if (!it.code) $('#iCode', m.el).value = nextCode(); $('#iKind', m.el).onchange = () => { if (/^[CMSTA]-\d+$/.test($('#iCode', m.el).value)) $('#iCode', m.el).value = nextCode(); }; }
  $('#iName', m.el).focus();
  $('#iSave', m.el).onclick = ev => busy(ev.target, async () => {
    const row = { ...(isNew ? {} : { id: it.id }), kind: $('#iKind', m.el).value, code: faToEn($('#iCode', m.el).value.trim()), name: $('#iName', m.el).value.trim(), spec: $('#iSpec', m.el).value.trim() || null,
      category: $('#iCat', m.el).value.trim() || null, unit: $('#iUnit', m.el).value.trim(), weight: $('#iW', m.el).value.trim() ? num($('#iW', m.el).value) : null,
      min_qty: num($('#iMin', m.el).value), active: $('#iAct', m.el).value === '1', notes: $('#iNotes', m.el).value.trim() || null };
    if (!row.code || !row.name || !row.unit) throw new Error('کد، شرح و واحد کالا لازم است');
    const saved = await S.store.saveItem(row);
    if (isNew) S.items.push(saved); else Object.assign(it, saved);
    S.items.sort((a, b) => String(a.code).localeCompare(b.code, undefined, { numeric: true })); rebuildIndex();
    await log(isNew ? 'create' : 'update', 'item', saved.code + ' ' + saved.name, '', null, saved.id);
    m.close(); toast('ذخیره شد', 'ok'); refreshNav(); after?.(saved);
  });
  if ($('#iDel', m.el)) $('#iDel', m.el).onclick = async () => {
    if (!(await confirmBox(`کالای ${esc(it.code)} حذف شود؟ (اگر در سندی استفاده شده باشد حذف نمی‌شود)`, 'حذف'))) return;
    await busy(null, async () => { await S.store.deleteItem(it.id); S.items = S.items.filter(x => x.id !== it.id); rebuildIndex(); await log('delete', 'item', it.code + ' ' + it.name); m.close(); toast('حذف شد', 'ok'); location.hash = '#/items'; });
  };
}

/* ============================ اموال ============================ */
const assetBadge = s => { const x = ASSET_ST[s] || { fa: s, c: '#777' }; return `<span class="badge" style="background:${x.c}1a;color:${x.c}"><i style="background:${x.c}"></i>${x.fa}</span>`; };
function renderAssets(keep) {
  const st = S.listState.assets = { q: '', status: '', ...(S.listState.assets || {}) };
  const vis = new Set(selWh().map(w => w.id));
  let list = S.assets.filter(a => S.whId === 'all' ? true : a.warehouse_id === S.whId || (!a.warehouse_id && can.seeAll()));
  if (S.whId === 'all' && !can.seeAll()) list = list.filter(a => vis.has(a.warehouse_id));
  if (st.status) list = list.filter(a => a.status === st.status);
  if (st.q) list = list.filter(a => matchQ(normFa([a.tag_no, a.name, a.serial, a.brand, a.holder, a.holder_unit, a.notes, whName(a.warehouse_id), itemOf(a.item_id)?.code].join(' ')), st.q));
  list.sort((a, b) => String(a.tag_no).localeCompare(b.tag_no, undefined, { numeric: true }));
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>اموال</h1><div class="sub">${list.length} قلم · ${Object.entries(ASSET_ST).map(([k, v]) => `${v.fa}: ${list.filter(a => a.status === k).length}`).join(' · ')}</div></div>
      <div class="actions"><button class="btn" id="xls">${ICON.excel}خروجی اکسل</button>${can.writeAny() ? `<button class="btn primary" id="add">${ICON.plus}ثبت اموال</button>` : ''}</div></div>
    <div class="card">
      <div class="filters"><input id="fq" type="search" placeholder="جستجو: شماره اموال، نام، سریال، تحویل‌گیرنده…" value="${esc(st.q)}" style="flex:1;min-width:200px">
        <select id="fs"><option value="">همه وضعیت‌ها</option>${Object.entries(ASSET_ST).map(([k, v]) => `<option value="${k}" ${st.status === k ? 'selected' : ''}>${v.fa}</option>`).join('')}</select></div>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>شماره اموال</th><th>شرح</th><th>سریال / برند</th><th>انبار</th><th>تحویل‌گیرنده</th><th>واحد / محل</th><th>وضعیت</th></tr></thead><tbody>
        ${list.map(a => `<tr data-id="${a.id}"><td class="mono" style="font-weight:700">${hilite(a.tag_no, st.q)}</td><td>${hilite(a.name, st.q)}</td><td class="muted mono" style="font-size:12.5px">${esc([a.serial, a.brand].filter(Boolean).join(' · '))}</td>
          <td>${esc(whName(a.warehouse_id))}</td><td>${hilite(a.holder || '', st.q)}</td><td class="muted">${esc(a.holder_unit || '')}</td><td>${assetBadge(a.status)}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty"><b>اموالی ثبت نشده</b>اموال کالاهای شماره‌دار هستند (ابزار برقی، تجهیزات، رایانه…) که با شماره پلاک تحویل اشخاص می‌شوند</div>`}
    </div>`;
  let t; $('#fq').oninput = ev => { clearTimeout(t); t = setTimeout(() => { st.q = ev.target.value; renderAssets(true); }, 200); };
  if (keep && st.q) { const f = $('#fq'); f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
  $('#fs').onchange = ev => { st.status = ev.target.value; renderAssets(); };
  if ($('#add')) $('#add').onclick = () => assetModal(null);
  $$('tbody tr[data-id]').forEach(r => r.onclick = () => assetModal(S.assets.find(a => a.id === r.dataset.id)));
  $('#xls').onclick = () => downloadXlsx('اموال', [{ name: 'اموال', rows: [['شماره اموال', 'شرح', 'کد کالا', 'سریال', 'برند', 'انبار', 'تحویل‌گیرنده', 'واحد / محل', 'وضعیت', 'تاریخ تحصیل', 'توضیحات'],
    ...list.map(a => [a.tag_no, a.name, itemOf(a.item_id)?.code || '', a.serial || '', a.brand || '', whName(a.warehouse_id), a.holder || '', a.holder_unit || '', ASSET_ST[a.status]?.fa, a.acquired_date || '', a.notes || ''])] }]);
}
async function assetModal(a) {
  const isNew = !a; a = a || { status: 'in_stock', warehouse_id: (writableWh().find(w => w.id === S.whId) || writableWh()[0])?.id };
  const editable = isNew || can.admin() || can.write(a.warehouse_id);
  const assetItems = S.items.filter(i => i.kind === 'asset' || i.kind === 'tool' || i.id === a.item_id);
  const histP = isNew ? Promise.resolve([]) : S.store.assetLog(a.id);
  const m = modal(isNew ? 'ثبت اموال' : 'اموال ' + esc(a.tag_no), `
    <div class="fgrid" style="--cols:2">
      <div class="fld"><label class="l">شماره اموال / پلاک *</label><input id="aTag" value="${esc(a.tag_no)}" class="mono" dir="ltr" ${editable ? '' : 'disabled'}></div>
      <div class="fld"><label class="l">کالای مرتبط</label><select id="aItem" ${editable ? '' : 'disabled'}><option value="">—</option>${assetItems.map(i => `<option value="${i.id}" ${a.item_id === i.id ? 'selected' : ''}>${esc(i.code + ' — ' + i.name)}</option>`).join('')}</select></div>
      <div class="fld wide"><label class="l">شرح *</label><input id="aName" value="${esc(a.name)}" dir="auto" ${editable ? '' : 'disabled'}></div>
      <div class="fld"><label class="l">سریال</label><input id="aSer" value="${esc(a.serial)}" dir="ltr" ${editable ? '' : 'disabled'}></div>
      <div class="fld"><label class="l">برند / مدل</label><input id="aBr" value="${esc(a.brand)}" dir="auto" ${editable ? '' : 'disabled'}></div>
      <div class="fld"><label class="l">انبار *</label><select id="aWh" ${editable ? '' : 'disabled'}>${S.warehouses.map(w => `<option value="${w.id}" ${a.warehouse_id === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>
      <div class="fld"><label class="l">وضعیت</label><select id="aSt" ${editable ? '' : 'disabled'}>${Object.entries(ASSET_ST).map(([k, v]) => `<option value="${k}" ${a.status === k ? 'selected' : ''}>${v.fa}</option>`).join('')}</select></div>
      <div class="fld"><label class="l">تحویل‌گیرنده (شخص)</label><input id="aHol" value="${esc(a.holder)}" dir="auto" list="dlHol" ${editable ? '' : 'disabled'}><datalist id="dlHol">${[...new Set(S.assets.map(x => x.holder).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="fld"><label class="l">واحد / پیمانکار / محل استقرار</label><input id="aUnit" value="${esc(a.holder_unit)}" dir="auto" ${editable ? '' : 'disabled'}></div>
      <div class="fld"><label class="l">تاریخ تحصیل</label>${dateInput('id="aDate"', a.acquired_date || '')}</div>
      <div class="fld wide"><label class="l">توضیحات</label><input id="aNotes" value="${esc(a.notes)}" dir="auto" ${editable ? '' : 'disabled'}></div>
    </div>
    ${isNew ? '' : '<div class="sec-t" style="margin-top:18px">سابقه</div><div id="aHist" class="muted">…</div>'}`,
  { wide: false, footer: editable ? `<button class="btn primary" id="aSave">ذخیره</button>${!isNew && can.admin() ? `<button class="btn danger" id="aDel">${ICON.trash}حذف</button>` : ''}<button class="btn" data-close>بستن</button>` : '<button class="btn" data-close>بستن</button>' });
  bindDateInputs(m.el);
  $('#aStatusHint', m.el);
  $('#aItem', m.el).onchange = ev => { const it = itemOf(ev.target.value); if (it && !$('#aName', m.el).value) $('#aName', m.el).value = it.name; };
  $('#aHol', m.el).oninput = ev => { if (ev.target.value && $('#aSt', m.el).value === 'in_stock') $('#aSt', m.el).value = 'assigned'; };
  histP.then(h => { const b = $('#aHist', m.el); if (b) b.innerHTML = h.length ? h.map(x => `<div class="log-item"><b>${esc(x.username || '')}</b> ${esc(x.action)} — ${esc(x.details || '')} <span class="mono muted" style="font-size:11px">${Jalali.isoToJalali(x.at)}</span></div>`).join('') : 'سابقه‌ای ثبت نشده'; });
  if ($('#aSave', m.el)) $('#aSave', m.el).onclick = ev => busy(ev.target, async () => {
    const row = { ...(isNew ? {} : { id: a.id }), tag_no: faToEn($('#aTag', m.el).value.trim()), item_id: $('#aItem', m.el).value || null, name: $('#aName', m.el).value.trim(), serial: $('#aSer', m.el).value.trim() || null,
      brand: $('#aBr', m.el).value.trim() || null, warehouse_id: $('#aWh', m.el).value, status: $('#aSt', m.el).value, holder: $('#aHol', m.el).value.trim() || null,
      holder_unit: $('#aUnit', m.el).value.trim() || null, acquired_date: Jalali.normalize($('#aDate', m.el).value) || null, notes: $('#aNotes', m.el).value.trim() || null };
    if (!row.tag_no || !row.name) throw new Error('شماره اموال و شرح لازم است');
    if (row.status === 'in_stock') { row.holder = null; }
    const saved = await S.store.saveAsset(row);
    const changes = isNew ? 'ثبت اولیه' : [['status', 'وضعیت', v => ASSET_ST[v]?.fa], ['holder', 'تحویل‌گیرنده'], ['holder_unit', 'محل'], ['warehouse_id', 'انبار', whName]].filter(([k]) => (a[k] || null) !== (row[k] || null)).map(([k, l, f]) => `${l}: ${(f || (x => x))(row[k]) || '—'}`).join('، ');
    if (changes) await S.store.addAssetLog(saved.id, isNew ? 'ثبت' : 'تغییر', changes);
    if (isNew) S.assets.push(saved); else Object.assign(a, saved);
    m.close(); toast('ذخیره شد', 'ok'); refreshNav(); renderAssets();
  });
  if ($('#aDel', m.el)) $('#aDel', m.el).onclick = async () => {
    if (!(await confirmBox(`اموال ${esc(a.tag_no)} حذف شود؟`, 'حذف'))) return;
    await busy(null, async () => { await S.store.deleteAsset(a.id); S.assets = S.assets.filter(x => x.id !== a.id); await log('delete', 'asset', a.tag_no + ' ' + a.name, '', a.warehouse_id); m.close(); renderAssets(); refreshNav(); });
  };
}

/* ============================ گزارش‌ها ============================ */
const REPORTS = { low: 'کمتر از حداقل', dead: 'کالای راکد', period: 'گردش دوره', project: 'مصرف به تفکیک پروژه', civil: 'قطعات سیویل نزد پروژه‌ها' };
async function renderReports(tab) {
  if (!REPORTS[tab]) tab = 'low';
  const st = S.listState.rep = { days: 180, from: Jalali.today().slice(0, 5) + '01/01', to: Jalali.today(), ...(S.listState.rep || {}) };
  const whs = selWh(), vis = new Set(whs.map(w => w.id));
  let head = [], rows = [], note = '';
  if (tab === 'low') {
    head = ['کد', 'شرح کالا', 'واحد', 'موجودی', 'حداقل', 'کسری'];
    rows = lowItems(whs).map(i => { const q = stockTotal(i.id, whs); return { id: i.id, c: [i.code, i.name + (i.spec ? ' — ' + i.spec : ''), i.unit, q, +i.min_qty, +i.min_qty - q] }; });
    note = 'کالاهایی که حداقل موجودی برایشان تعریف شده و موجودی' + (whs.length > 1 ? ' مجموع انبارهای انتخابی' : '') + ' کمتر از آن است.';
  } else if (tab === 'dead') {
    const lim = (() => { const [y, m, d] = Jalali.toJalali(new Date(Date.now() - st.days * 86400000)); return `${y}/${Jalali.pad(m)}/${Jalali.pad(d)}`; })();
    head = ['کد', 'شرح کالا', 'انبار', 'واحد', 'موجودی', 'آخرین خروج', 'آخرین گردش', 'روز بدون خروج'];
    rows = S.stock.filter(s => vis.has(s.warehouse_id) && +s.qty > 1e-9 && (s.last_out || '') < lim).map(s => { const i = itemOf(s.item_id) || {}; const ref = s.last_out || s.last_date; return { id: s.item_id, c: [i.code, i.name, whName(s.warehouse_id), i.unit, +s.qty, s.last_out || 'هرگز', s.last_date, Jalali.daysSince(ref) ?? ''] }; })
      .sort((a, b) => (b.c[7] || 0) - (a.c[7] || 0));
    note = `کالاهای دارای موجودی که در ${st.days} روز گذشته هیچ خروجی (حواله/انتقال/کسر) نداشته‌اند.`;
  } else if (tab === 'period' || tab === 'project') {
    const from = Jalali.normalize(st.from), to = Jalali.normalize(st.to);
    const moves = (await S.store.listMoves({ to })).filter(m => vis.has(m.warehouse_id));
    if (tab === 'period') {
      const agg = new Map();
      moves.forEach(m => {
        const k = m.item_id; const a = agg.get(k) || { open: 0, inn: 0, out: 0 }; const q = +m.qty;
        if (m.doc_date < from) a.open += q; else if (q > 0) a.inn += q; else a.out -= q;
        agg.set(k, a);
      });
      head = ['کد', 'شرح کالا', 'واحد', 'مانده اول دوره', 'وارده', 'صادره', 'مانده پایان دوره'];
      rows = [...agg.entries()].filter(([, a]) => a.inn || a.out || Math.abs(a.open) > 1e-9).map(([id, a]) => { const i = itemOf(id) || {}; return { id, c: [i.code, i.name, i.unit, a.open, a.inn, a.out, a.open + a.inn - a.out] }; })
        .sort((x, y) => String(x.c[0]).localeCompare(y.c[0], undefined, { numeric: true }));
      note = whs.length > 1 ? 'در حالت چند انبار، انتقال بین انبارهای انتخابی هم در وارده و هم در صادره دیده می‌شود.' : '';
    } else {
      const agg = new Map();
      moves.filter(m => m.doc_date >= from && (m.type === 'issue' || m.type === 'return')).forEach(m => {
        const k = (m.project || '(بدون پروژه)') + '|' + m.item_id; const a = agg.get(k) || { p: m.project || '(بدون پروژه)', id: m.item_id, out: 0, back: 0 };
        if (m.type === 'issue') a.out -= +m.qty; else a.back += +m.qty; agg.set(k, a);
      });
      head = ['پروژه / محل مصرف', 'کد', 'شرح کالا', 'واحد', 'حواله شده'];
      rows = [...agg.values()].map(a => { const i = itemOf(a.id) || {}; return { id: a.id, c: [a.p, i.code, i.name, i.unit, a.out] }; })
        .sort((x, y) => x.c[0].localeCompare(y.c[0], 'fa') || String(x.c[1]).localeCompare(y.c[1], undefined, { numeric: true }));
      note = 'حواله‌ها در بازه انتخابی، بر اساس فیلد «پروژه / محل مصرف».';
    }
  } else if (tab === 'civil') {
    const moves = (await S.store.listMoves({})).filter(m => vis.has(m.warehouse_id) && (m.type === 'issue' || m.type === 'return') && itemOf(m.item_id)?.kind === 'civil');
    const agg = new Map();
    moves.forEach(m => { const k = (m.project || m.party || '(نامشخص)') + '|' + m.item_id; const a = agg.get(k) || { p: m.project || m.party || '(نامشخص)', id: m.item_id, q: 0, last: '' }; a.q -= +m.qty; if (m.doc_date > a.last) a.last = m.doc_date; agg.set(k, a); });
    head = ['پروژه / پیمانکار', 'کد', 'شرح قطعه', 'واحد', 'حواله شده به پروژه', 'وزن (kg)', 'آخرین گردش'];
    rows = [...agg.values()].filter(a => Math.abs(a.q) > 1e-9).map(a => { const i = itemOf(a.id) || {}; return { id: a.id, c: [a.p, i.code, i.name, i.unit, a.q, i.weight ? +(i.weight * a.q).toFixed(1) : '', a.last] }; })
      .sort((x, y) => x.c[0].localeCompare(y.c[0], 'fa'));
    note = 'جمع قطعات سیویل (قالب، داربست، …) حواله‌شده به هر پروژه/پیمانکار.';
  }
  const numCols = new Set(head.map((h, i) => rows.some(r => typeof r.c[i] === 'number') ? i : -1));
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>گزارش‌ها</h1><div class="sub">${S.whId === 'all' ? `همه انبارهای قابل دسترس (${whs.length})` : esc(whName(S.whId))}</div></div>
      <div class="actions"><button class="btn" id="xls">${ICON.excel}اکسل</button><button class="btn" id="prt">${ICON.print}چاپ</button></div></div>
    <div class="tabs">${Object.entries(REPORTS).map(([k, v]) => `<a href="#/reports/${k}" class="${k === tab ? 'on' : ''}">${v}</a>`).join('')}</div>
    <div class="card">
      ${tab === 'dead' ? `<div class="filters">بدون خروج در <input id="rd" value="${st.days}" style="width:70px" class="mono" dir="ltr"> روز گذشته</div>` : ''}
      ${tab === 'period' || tab === 'project' ? `<div class="filters">از ${dateInput('id="rf"', st.from)} تا ${dateInput('id="rt"', st.to)}</div>` : ''}
      ${note ? `<div class="muted" style="padding:10px 18px;font-size:12.5px">${note}</div>` : ''}
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head.map((h, i) => `<th class="${numCols.has(i) ? 'num' : ''}">${h}</th>`).join('')}</tr></thead><tbody>
        ${rows.slice(0, 2000).map(r => `<tr onclick="location.hash='#/item/${r.id}'">${r.c.map((c, i) => typeof c === 'number' ? qCell(c) : `<td class="${i === 0 && /^[A-Z0-9-]+$/i.test(c) ? 'mono' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>` : '<div class="empty"><b>موردی وجود ندارد</b></div>'}
    </div>`;
  bindDateInputs($('#view'));
  if ($('#rd')) $('#rd').onchange = ev => { st.days = Math.max(1, num(ev.target.value)); renderReports(tab); };
  if ($('#rf')) { $('#rf').onchange = ev => { st.from = Jalali.normalize(ev.target.value); renderReports(tab); }; $('#rt').onchange = ev => { st.to = Jalali.normalize(ev.target.value); renderReports(tab); }; }
  $('#xls').onclick = () => downloadXlsx(REPORTS[tab], [{ name: REPORTS[tab], rows: [head, ...rows.map(r => r.c)] }]);
  $('#prt').onclick = () => printTable(REPORTS[tab] + (tab === 'period' || tab === 'project' ? ` (${st.from} تا ${st.to})` : '') + ' — ' + (S.whId === 'all' ? 'همه انبارها' : whName(S.whId)), [head, ...rows.map(r => r.c)]);
}
