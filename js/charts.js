/* ======================================================
   انباریار — چارت‌های داشبورد مدیر + صفحه انبار برای کاربران
   ====================================================== */

/* ---------- نمودار میله‌ای SVG (بدون کتابخانه) ----------
   رنگ‌ها از پالت دسته‌ای تأییدشده (اسلات ۱ تا ۳) با نسخه جدا برای پوسته تیره. */
const VIZ = ['--viz-1', '--viz-2', '--viz-3'];
function vbars({ cats, series, unit = '' }) {          // ستونی گروهی (روند زمانی)
  const W = 560, H = 230, L = 34, B = 26, T = 12, R = 8;
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); return Math.ceil(max / p) * p; })();
  const pw = (W - L - R) / cats.length, gap = 2, bw = Math.max(4, Math.min(22, (pw * 0.7 - gap * (series.length - 1)) / series.length));
  const y = v => T + (H - T - B) * (1 - v / nice);
  const grid = [0, .5, 1].map(f => `<line x1="${L}" x2="${W - R}" y1="${y(nice * f)}" y2="${y(nice * f)}" class="vz-grid"/><text x="${L - 6}" y="${y(nice * f) + 4}" class="vz-ax" text-anchor="end">${fmtQ(nice * f)}</text>`).join('');
  const bars = cats.map((c, i) => {
    const x0 = L + pw * i + (pw - (bw * series.length + gap * (series.length - 1))) / 2;
    return series.map((s, k) => { const v = s.values[i], h = Math.max(0, H - B - y(v)); const x = x0 + k * (bw + gap);
      return v ? `<path d="M${x},${H - B} v${-Math.max(0, h - 4)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${Math.max(0, h - 4)} z" style="fill:var(${VIZ[k]})"/><rect x="${x - 2}" y="${T}" width="${bw + 4}" height="${H - B - T}" class="vz-hit" data-tip="${esc(c)} · ${esc(s.name)}: ${fmtQ(v)}${unit}"/>` : ''; }).join('')
      + `<text x="${L + pw * i + pw / 2}" y="${H - 8}" class="vz-ax" text-anchor="middle">${esc(c)}</text>`;
  }).join('');
  return `${series.length > 1 ? `<div class="vz-legend">${series.map((s, k) => `<span><i style="background:var(${VIZ[k]})"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}
    <svg viewBox="0 0 ${W} ${H}" class="vz" role="img">${grid}${bars}</svg>`;
}
function hbars(rows, { unit = '', link } = {}) {      // افقی تک‌سری (مقایسه/رتبه)
  if (!rows.length) return '<div class="empty" style="padding:30px">داده‌ای نیست</div>';
  const max = Math.max(1, ...rows.map(r => r.v));
  return `<div class="hb">${rows.map(r => `<div class="hb-r" ${link ? `onclick="location.hash='${link(r)}'"` : ''} data-tip="${esc(r.label)}: ${fmtQ(r.v)}${unit}">
    <span class="hb-l" title="${esc(r.label)}">${esc(r.label)}</span><span class="hb-t"><i style="width:${Math.max(1.5, r.v / max * 100)}%"></i></span><b class="mono">${fmtQ(r.v)}</b></div>`).join('')}</div>`;
}
function bindTips(root) {
  let tip = $('#vzTip'); if (!tip) { tip = document.createElement('div'); tip.id = 'vzTip'; tip.className = 'vz-tip'; document.body.appendChild(tip); }
  root.addEventListener('mousemove', ev => { const t = ev.target.closest('[data-tip]'); if (!t) { tip.style.display = 'none'; return; } tip.textContent = t.dataset.tip; tip.style.display = 'block'; tip.style.left = (ev.clientX + 12) + 'px'; tip.style.top = (ev.clientY + 12) + 'px'; });
  root.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
}

/* ---------- چارت‌های داشبورد مدیر ---------- */
function lastMonths(n) {
  let [y, m] = Jalali.toJalali(); const out = [];
  for (let i = 0; i < n; i++) { out.unshift({ key: `${y}/${Jalali.pad(m)}`, fa: Jalali.MONTHS[m - 1] }); if (--m < 1) { m = 12; y--; } }
  return out;
}
async function drawDashCharts(whs) {
  const box = $('#charts'); if (!box) return;
  const vis = new Set(whs.map(w => w.id));
  const docs = S.docs.filter(d => d.status !== 'void' && (vis.has(d.warehouse_id) || vis.has(d.to_warehouse_id)));
  const months = lastMonths(6);
  const per = t => months.map(mo => docs.filter(d => d.type === t && d.doc_date.startsWith(mo.key)).length);
  const weight = whs.map(w => ({ label: w.name, id: w.id, v: Math.round(S.stock.filter(s => s.warehouse_id === w.id && +s.qty > 0).reduce((a, s) => a + (+(itemOf(s.item_id)?.weight || 0)) * s.qty, 0) / 100) / 10 })).filter(r => r.v > 0).sort((a, b) => b.v - a.v);
  const docsPerWh = whs.map(w => ({ label: w.name, id: w.id, v: docs.filter(d => d.warehouse_id === w.id && d.doc_date.startsWith(Jalali.today().slice(0, 4))).length })).sort((a, b) => b.v - a.v);
  box.innerHTML = `
    <div class="card"><div class="card-h">گردش ماهانه اسناد<small class="muted" style="font-weight:400">۶ ماه اخیر · تعداد سند</small></div><div class="card-b">${vbars({ cats: months.map(m => m.fa), series: [{ name: 'رسید', values: per('receipt') }, { name: 'حواله', values: per('issue') }, { name: 'انتقال', values: per('transfer') }], unit: ' سند' })}</div></div>
    ${whs.length > 1 ? `<div class="card"><div class="card-h">اسناد هر انبار<small class="muted" style="font-weight:400">امسال</small></div><div class="card-b">${hbars(docsPerWh.slice(0, 10), { unit: ' سند' })}</div></div>` : ''}
    <div class="card"><div class="card-h">وزن موجودی${whs.length > 1 ? ' هر انبار' : ''}<small class="muted" style="font-weight:400">تن · کالاهای دارای وزن</small></div><div class="card-b">${hbars(weight.slice(0, 10), { unit: ' تن' })}</div></div>
    <div class="card"><div class="card-h">پرمصرف‌ترین کالاها<small class="muted" style="font-weight:400">۹۰ روز اخیر · تعداد حواله</small></div><div class="card-b" id="topItems"><div class="muted">…</div></div></div>`;
  bindTips(box);
  try {
    const [y, m, d] = Jalali.toJalali(new Date(Date.now() - 90 * 86400000));
    const moves = await S.store.listMoves({ from: `${y}/${Jalali.pad(m)}/${Jalali.pad(d)}` });
    const cnt = new Map();
    moves.filter(x => x.type === 'issue' && vis.has(x.warehouse_id)).forEach(x => cnt.set(x.item_id, (cnt.get(x.item_id) || 0) + 1));
    const rows = [...cnt.entries()].map(([id, v]) => ({ id, v, label: (itemOf(id)?.name || '—') + (itemOf(id)?.spec ? ' ' + itemOf(id).spec : '') })).sort((a, b) => b.v - a.v).slice(0, 8);
    const el = $('#topItems'); if (el) el.innerHTML = hbars(rows, { unit: ' حواله', link: r => '#/item/' + r.id });
  } catch (e) { const el = $('#topItems'); if (el) el.innerHTML = `<div class="muted">${esc(e.message)}</div>`; }
}

/* ---------- صفحه انبار (کاربران غیرمدیر) ---------- */
function renderWhHome() {
  const w = whOf(S.whId);
  if (!w) { $('#view').innerHTML = '<div class="card empty"><b>انباری برای شما تعریف نشده</b>با مدیر انبار تماس بگیرید</div>'; return; }
  const mine = d => d.status !== 'void' && (d.warehouse_id === w.id || d.to_warehouse_id === w.id);
  const docs = S.docs.filter(mine).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const incoming = docs.filter(d => d.type === 'transfer' && d.to_warehouse_id === w.id).slice(0, 6);
  const canW = can.write(w.id);
  const act = t => `<a class="act-card" href="#/new/${t}" style="--c:${DT[t].color}">${DT_ICON[t]}<b>${DT[t].fa}</b><small>${t === 'receipt' ? 'ورود کالا به انبار' : t === 'issue' ? 'خروج کالا برای مصرف' : t === 'transfer' ? 'ارسال به انبار دیگر' : t === 'return' ? 'برگشت کالا از پروژه' : 'اصلاح موجودی'}</small></a>`;
  const row = d => `<tr onclick="location.hash='#/doc/${d.id}'"><td>${dtTag(d.type)}</td><td class="mono">${esc(d.doc_no)}</td><td class="mono">${esc(d.doc_date)}</td>
    <td class="subj">${d.type === 'transfer' ? (d.warehouse_id === w.id ? 'به ' + esc(whName(d.to_warehouse_id)) : 'از ' + esc(whName(d.warehouse_id))) : esc([d.party, d.project].filter(Boolean).join(' · '))}</td></tr>`;
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>${esc(w.name)}</h1><div class="sub">${esc([w.project, w.keeper_name, w.phone].filter(Boolean).join(' · '))} · ${canW ? 'دسترسی انباردار' : 'فقط مشاهده'} · امروز ${Jalali.today()}</div></div>
      <div class="actions"><a class="btn" href="#/stock">${ICON.stock}موجودی این انبار</a></div></div>
    ${canW ? `<div class="act-grid">${DT_KEYS.map(act).join('')}</div>` : ''}
    <div class="grid-2">
      <div class="card"><div class="card-h">آخرین اسناد این انبار<div class="actions"><a class="btn sm" href="#/docs/all">همه</a></div></div>
        ${docs.length ? `<div class="tbl-wrap"><table class="tbl"><tbody>${docs.slice(0, 12).map(row).join('')}</tbody></table></div>` : '<div class="empty"><b>هنوز سندی ثبت نشده</b></div>'}</div>
      <div class="card"><div class="card-h">${ICON.swap}انتقال‌های رسیده به این انبار</div>
        ${incoming.length ? `<div class="tbl-wrap"><table class="tbl"><tbody>${incoming.map(row).join('')}</tbody></table></div>` : '<div class="empty">انتقالی به این انبار ثبت نشده</div>'}</div>
    </div>`;
}
