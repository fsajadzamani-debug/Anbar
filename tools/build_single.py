#!/usr/bin/env python3
"""ساخت نسخه تک‌فایلی HTML انباریار — همه CSS/JS/فونت‌ها داخل یک فایل.
استفاده:
  python3 tools/build_single.py --online -o anbaryar.html      # متصل به Supabase طبق config.js
  python3 tools/build_single.py --demo   -o anbaryar-demo.html # حالت آزمایشی محلی با داده نمونه"""
import argparse, base64, json, os, random, uuid
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(R, p), encoding='utf8').read()
b64 = lambda p: base64.b64encode(open(os.path.join(R, p), 'rb').read()).decode()

ap = argparse.ArgumentParser()
ap.add_argument('-o', '--out', default='anbaryar.html')
ap.add_argument('--online', action='store_true', help='اتصال به Supabase طبق config.js')
ap.add_argument('--demo', action='store_true', help='داده نمونه برای حالت محلی')
a = ap.parse_args()

fonts = rd('fonts/fonts.css')
fonts = fonts.replace("url('Vazirmatn.woff2') format('woff2-variations'), url('Vazirmatn.woff2') format('woff2')", f"url(data:font/woff2;base64,{b64('fonts/Vazirmatn.woff2')}) format('woff2')")
for f in ('plexmono-400', 'plexmono-600'):
    fonts = fonts.replace(f"url('{f}.woff2')", f"url(data:font/woff2;base64,{b64('fonts/' + f + '.woff2')})")

shim = """<script>
(function(){ // اگر مرورگر حافظه محلی را مسدود کرده باشد، حافظه موقت جایگزین می‌شود
  function mem(){ var d={}; return {getItem:function(k){return k in d?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]},get length(){return Object.keys(d).length}}; }
  ['localStorage','sessionStorage'].forEach(function(n){ try{ window[n].getItem('x'); }catch(e){ try{ Object.defineProperty(window,n,{value:mem(),configurable:true}); }catch(_){} } });
})();
</script>"""
shim += '<script>' + (rd('config.js') if a.online else "window.ANBAR_CONFIG = { supabaseUrl: '', supabaseKey: '' };") + '</script>'


def demo():
    rnd = random.Random(7)
    now = '2026-10-05T08:00:00.000Z'
    whs = [('انبار مرکزی', 'WH-00', 'central', 'دفتر مرکزی'), ('انبار پروژه پالایشگاه', 'WH-01', 'site', 'پالایشگاه ستاره'),
           ('انبار پروژه نیروگاه', 'WH-02', 'site', 'نیروگاه سیکل ترکیبی'), ('یارد قالب و داربست', 'WH-03', 'yard', 'یارد مرکزی')]
    W = [{'id': str(uuid.uuid4()), 'name': n, 'code': c, 'kind': k, 'project': p, 'active': True, 'sort': i * 10, 'created_at': now, 'keeper_name': ['آقای رضایی', 'آقای احمدی', 'آقای کریمی', 'آقای موسوی'][i]} for i, (n, c, k, p) in enumerate(whs)]
    raw = [('C-0001', 'پنل قالب فلزی', '60×120', 'civil', 'قالب دیوار', 'عدد', 18.5, 50), ('C-0002', 'پنل قالب فلزی', '30×120', 'civil', 'قالب دیوار', 'عدد', 10.2, 30),
           ('C-0003', 'جک سقفی', '3 متری', 'civil', 'جک و شمع', 'عدد', 14, 40), ('C-0004', 'لوله داربست', '6 متری', 'civil', 'داربست', 'شاخه', 22, 100),
           ('C-0005', 'بست داربست ثابت', '', 'civil', 'داربست', 'عدد', 1.2, 300), ('C-0006', 'تخته زیرپایی فلزی', '', 'civil', 'داربست', 'عدد', 12, 0),
           ('M-0001', 'سیمان تیپ ۲', '', 'material', 'سیمان', 'کیسه', 50, 200), ('M-0002', 'میلگرد A3', 'Ø16', 'material', 'میلگرد', 'کیلوگرم', 1, 2000),
           ('M-0003', 'میلگرد A3', 'Ø20', 'material', 'میلگرد', 'کیلوگرم', 1, 2000), ('M-0004', 'سیم آرماتوربندی', '', 'material', 'میلگرد', 'کیلوگرم', 1, 100),
           ('M-0005', 'تیرآهن', 'IPE180', 'material', 'پروفیل', 'شاخه', 113, 10), ('S-0001', 'الکترود جوشکاری', 'E6013 Ø3.2', 'consumable', 'جوشکاری', 'بسته', 5, 20),
           ('S-0002', 'سنگ فرز', '180', 'consumable', 'ابزار مصرفی', 'عدد', 0.4, 50), ('S-0003', 'دستکش کار', '', 'consumable', 'ایمنی', 'جفت', 0.1, 100),
           ('T-0001', 'دریل چکشی', 'بوش 2-26', 'tool', 'ابزار برقی', 'دستگاه', 3, 2), ('T-0002', 'فرز سنگبری', '180', 'tool', 'ابزار برقی', 'دستگاه', 4, 2),
           ('A-0001', 'دستگاه جوش اینورتر', '250A', 'asset', 'تجهیزات', 'دستگاه', 15, 0), ('A-0002', 'لپ‌تاپ', '', 'asset', 'اداری', 'دستگاه', 2, 0)]
    I = [{'id': str(uuid.uuid4()), 'code': c, 'name': n, 'spec': s or None, 'kind': k, 'category': cat, 'unit': u, 'weight': w, 'min_qty': m, 'active': True, 'created_at': now} for c, n, s, k, cat, u, w, m in raw]
    D, L = [], []
    seq = {}
    def doc(wh, t, date, lines, to=None, party=None, project=None, ref=None, notes=None):
        k = (wh['id'], t); seq[k] = seq.get(k, 0) + 1
        d = {'id': str(uuid.uuid4()), 'warehouse_id': wh['id'], 'type': t, 'doc_no': f'1405-{seq[k]:04d}', 'doc_date': date, 'to_warehouse_id': to['id'] if to else None,
             'party': party, 'project': project, 'ref_no': ref, 'notes': notes, 'status': 'final', 'created_name': 'مدیر (محلی)', 'created_at': f'2026-{date[5:7]}-{date[8:10]}T09:00:00Z', 'updated_at': now}
        D.append(d)
        for i, (it, q) in enumerate(lines):
            L.append({'id': str(uuid.uuid4()), 'doc_id': d['id'], 'item_id': it['id'], 'qty': q, 'note': None, 'sort': i + 1})
    by = {i['code']: i for i in I}
    doc(W[0], 'adjust', '1405/01/05', [(by[c], q) for c, q in [('M-0001', 400), ('M-0002', 12000), ('M-0003', 9000), ('M-0004', 300), ('M-0005', 40), ('S-0001', 60), ('S-0002', 200), ('S-0003', 150), ('T-0001', 6), ('T-0002', 5), ('A-0001', 3), ('A-0002', 4)]], party='کمیته انبارگردانی', notes='موجودی اول دوره')
    doc(W[3], 'adjust', '1405/01/05', [(by[c], q) for c, q in [('C-0001', 800), ('C-0002', 400), ('C-0003', 600), ('C-0004', 1500), ('C-0005', 4000), ('C-0006', 300)]], party='کمیته انبارگردانی', notes='موجودی اول دوره')
    doc(W[0], 'receipt', '1405/02/10', [(by['M-0001'], 600), (by['S-0001'], 40)], party='سیمان تهران', ref='PR-1405-112')
    doc(W[0], 'receipt', '1405/03/02', [(by['M-0002'], 8000), (by['M-0004'], 200)], party='ذوب آهن اصفهان', ref='PR-1405-140')
    doc(W[0], 'transfer', '1405/03/15', [(by['M-0001'], 300), (by['M-0002'], 6000), (by['S-0001'], 30)], to=W[1], party='راننده: کاظمی', ref='بارنامه 5521')
    doc(W[3], 'transfer', '1405/03/18', [(by['C-0001'], 300), (by['C-0003'], 250), (by['C-0004'], 600), (by['C-0005'], 1500)], to=W[1], party='تریلی شرکت')
    doc(W[0], 'transfer', '1405/04/01', [(by['M-0003'], 5000), (by['M-0001'], 250)], to=W[2], party='راننده: نوری')
    doc(W[1], 'issue', '1405/04/10', [(by['M-0001'], 120), (by['M-0002'], 3500)], party='پیمانکار بتن آرمه', project='فونداسیون واحد ۲')
    doc(W[1], 'issue', '1405/05/03', [(by['C-0001'], 180), (by['C-0003'], 140)], party='پیمانکار قالب‌بندی', project='دیوار حائل')
    doc(W[1], 'return', '1405/06/20', [(by['C-0001'], 60), (by['C-0003'], 40)], party='پیمانکار قالب‌بندی', project='دیوار حائل')
    doc(W[2], 'issue', '1405/06/25', [(by['M-0003'], 4200), (by['M-0001'], 230)], party='پیمانکار سازه', project='سالن توربین')
    doc(W[0], 'issue', '1405/07/08', [(by['S-0002'], 40), (by['S-0003'], 60)], party='کارگاه تعمیرات', project='تعمیرات')
    A = [{'id': str(uuid.uuid4()), 'tag_no': '14051001', 'item_id': by['A-0001']['id'], 'name': 'دستگاه جوش اینورتر گام', 'serial': 'GM250-8812', 'brand': 'گام الکتریک', 'warehouse_id': W[1]['id'], 'holder': 'علی حسینی', 'holder_unit': 'تیم جوشکاری', 'status': 'assigned', 'created_at': now},
         {'id': str(uuid.uuid4()), 'tag_no': '14051002', 'item_id': by['A-0002']['id'], 'name': 'لپ‌تاپ لنوو', 'serial': 'PF3XK1', 'brand': 'Lenovo', 'warehouse_id': W[0]['id'], 'holder': None, 'holder_unit': None, 'status': 'in_stock', 'created_at': now}]
    return {'warehouses': W, 'items': I, 'docs': D, 'lines': L, 'assets': A}


seed = f'<script>window.ANBAR_DEMO_SEED = {json.dumps(demo(), ensure_ascii=False)};</script>' if a.demo else ''
files = (['lib/supabase.js'] if a.online else []) + ['lib/xlsx.full.min.js', 'js/jalali.js', 'js/store.js', 'js/app.js', 'js/docs.js', 'js/stock.js', 'js/charts.js', 'js/admin.js']
js = ''.join(f'<script>\n{rd(p)}\n</script>\n' for p in files)
js = js.replace("if ('serviceWorker' in navigator", "if (false && 'serviceWorker' in navigator")
icon = f"data:image/svg+xml;base64,{base64.b64encode(rd('icons/icon.svg').encode()).decode()}"
html = f"""<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>انباریار — سامانه انبارداری</title><link rel="icon" href="{icon}">
<style>{fonts}\n{rd('css/app.css')}\n{rd('css/anbar.css')}</style>{shim}{seed}</head>
<body><div style="display:grid;place-items:center;height:100vh;color:#8a909c">در حال بارگذاری…</div>
{js}</body></html>"""
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
open(a.out, 'w', encoding='utf8').write(html)
print(a.out, round(len(html.encode()) / 1024), 'KB')
