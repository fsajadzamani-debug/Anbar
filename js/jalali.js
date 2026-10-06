/* تبدیل تاریخ شمسی ↔ میلادی (الگوریتم jalaali) + ابزار اعداد فارسی */
const Jalali = (() => {
  const div = (a, b) => ~~(a / b);
  const mod = (a, b) => a - ~~(a / b) * b;
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

  function jalCal(jy) {
    let bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump, leap, n, i;
    for (i = 1; i < bl; i++) {
      jm = breaks[i]; jump = jm - jp;
      if (jy < jm) break;
      leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm;
    }
    n = jy - jp;
    leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap, gy, march };
  }
  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  }
  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return [gy, gm, gd];
  }
  function j2d(jy, jm, jd) {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }
  function d2j(jdn) {
    const gy = d2g(jdn)[0];
    let jy = gy - 621, r = jalCal(jy), jdn1f = g2d(gy, 3, r.march), jd, jm, k;
    k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) { jm = 1 + div(k, 31); jd = mod(k, 31) + 1; return [jy, jm, jd]; }
      k -= 186;
    } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
    jm = 7 + div(k, 30); jd = mod(k, 30) + 1;
    return [jy, jm, jd];
  }
  const toJalali = (d = new Date()) => d2j(g2d(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  const toGregorian = (jy, jm, jd) => d2g(j2d(jy, jm, jd));
  const pad = n => String(n).padStart(2, '0');
  const today = () => { const [y, m, d] = toJalali(); return `${y}/${pad(m)}/${pad(d)}`; };
  const monthLength = (jy, jm) => jm <= 6 ? 31 : jm <= 11 ? 30 : (jalCal(jy).leap === 0 ? 30 : 29);
  const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

  /* نرمال‌سازی تاریخ ورودی: ۱۴۰۲/۱۱/۴ → 1402/11/04 */
  function normalize(s) {
    if (!s) return '';
    s = faToEn(String(s)).replace(/[-.\\]/g, '/').replace(/\s+/g, '');
    const m = s.match(/^(\d{2,4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return s;
    let y = +m[1]; if (y < 100) y += 1400;
    return `${y}/${pad(+m[2])}/${pad(+m[3])}`;
  }
  function isoToJalali(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const [y, m, dd] = toJalali(d);
    return `${y}/${pad(m)}/${pad(dd)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  /* روزهای گذشته از یک تاریخ شمسی */
  function daysSince(js) {
    const m = normalize(js).match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (!m) return null;
    const [gy, gm, gd] = +m[1] > 1700 ? [+m[1], +m[2], +m[3]] : toGregorian(+m[1], +m[2], +m[3]); // تاریخ میلادی هم پشتیبانی می‌شود
    return Math.floor((Date.now() - new Date(gy, gm - 1, gd).getTime()) / 86400000);
  }
  return { toJalali, toGregorian, today, normalize, isoToJalali, daysSince, monthLength, MONTHS, pad };
})();

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹', AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
function faToEn(s) {
  return String(s ?? '').replace(/[۰-۹]/g, d => FA_DIGITS.indexOf(d)).replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d));
}
function enToFa(s) { return String(s ?? '').replace(/\d/g, d => FA_DIGITS[d]); }
/* یکسان‌سازی حروف عربی/فارسی برای جستجو */
function normFa(s) {
  return faToEn(String(s ?? '')).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ة]/g, 'ه')
    .replace(/[أإآ]/g, 'ا').replace(/[ً-ٰٟ‌‏‎]/g, '').replace(/\s+/g, ' ').toLowerCase().trim();
}
Jalali.weekday = (d = new Date()) => ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'][d.getDay()];
