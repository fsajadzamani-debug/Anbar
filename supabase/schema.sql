-- =====================================================================
--  انباریار — سامانه انبارداری فولاد تکنیک — Supabase schema
--  پروژه Supabase مستقل با کاربران خودش (جدا از سامانه مدارک).
--  این فایل را یک‌بار در Supabase → SQL Editor اجرا کنید (Run). اجرای دوباره بی‌خطر است.
--  همه جدول‌ها پیشوند wh_ دارند.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- کاربران (ورود با نام کاربری) ----------
create table if not exists public.wh_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- ---------- نقش انبار ----------
--  admin   = مدیر انبار: همه انبارها، تعریف کالا/انبار/کاربر، ویرایش و ابطال سند
--  auditor = ناظر: مشاهده همه انبارها و گزارش‌ها، بدون ثبت
--  user    = کاربر انبار: فقط انبارهایی که در wh_members به او داده شده
--  none    = بدون دسترسی به انبار
--  اولین کاربری که ثبت‌نام می‌کند خودکار مدیر انبار می‌شود.
create table if not exists public.wh_users (
  user_id     uuid primary key references public.wh_profiles(id) on delete cascade,
  role        text not null default 'none' check (role in ('admin','auditor','user','none')),
  created_at  timestamptz not null default now()
);

create table if not exists public.wh_warehouses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text unique,
  kind        text not null default 'site' check (kind in ('central','site','yard','other')),
  project     text,                     -- پروژه / کارگاه
  location    text,
  keeper_name text,
  phone       text,
  active      boolean not null default true,
  sort        int not null default 100,
  created_at  timestamptz not null default now()
);

-- دسترسی هر کاربر به هر انبار: keeper = انباردار (ثبت)، viewer = فقط مشاهده
create table if not exists public.wh_members (
  user_id      uuid not null references public.wh_profiles(id) on delete cascade,
  warehouse_id uuid not null references public.wh_warehouses(id) on delete cascade,
  role         text not null default 'keeper' check (role in ('keeper','viewer')),
  primary key (user_id, warehouse_id)
);
create index if not exists wh_members_wh_idx on public.wh_members(warehouse_id);

-- ساخت خودکار پروفایل هنگام ثبت کاربر. اولین کاربر = مدیر انبار.
create or replace function public.wh_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uname text := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)));
  first_user boolean := not exists (select 1 from public.wh_profiles);
begin
  insert into public.wh_profiles (id, username, full_name)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'full_name', uname))
  on conflict (id) do nothing;
  insert into public.wh_users (user_id, role) values (new.id, case when first_user then 'admin' else 'none' end)
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists wh_on_auth_user_created on auth.users;
create trigger wh_on_auth_user_created after insert on auth.users
  for each row execute function public.wh_handle_new_user();

-- آیا هنوز هیچ کاربری ساخته نشده؟ (برای نمایش «ساخت حساب مدیر» در صفحه ورود)
create or replace function public.wh_has_users() returns boolean
language sql stable security definer set search_path = public as $$ select exists (select 1 from public.wh_profiles) $$;

-- ---------- توابع دسترسی (security definer تا در RLS حلقه نشود) ----------
create or replace function public.wh_role() returns text
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then 'none'
    else coalesce((select role from public.wh_users where user_id = auth.uid()), 'none')
  end;
$$;
create or replace function public.wh_is_admin() returns boolean
language sql stable security definer set search_path = public as $$ select public.wh_role() = 'admin' $$;
create or replace function public.wh_active() returns boolean
language sql stable security definer set search_path = public as $$ select public.wh_role() <> 'none' $$;
create or replace function public.wh_can_see(w uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.wh_role() in ('admin','auditor')
      or (public.wh_role() = 'user' and exists (select 1 from public.wh_members m where m.user_id = auth.uid() and m.warehouse_id = w));
$$;
create or replace function public.wh_can_write(w uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.wh_role() = 'admin'
      or (public.wh_role() = 'user' and exists (select 1 from public.wh_members m where m.user_id = auth.uid() and m.warehouse_id = w and m.role = 'keeper'));
$$;
create or replace function public.wh_can_write_any() returns boolean
language sql stable security definer set search_path = public as $$
  select public.wh_role() = 'admin'
      or (public.wh_role() = 'user' and exists (select 1 from public.wh_members m where m.user_id = auth.uid() and m.role = 'keeper'));
$$;

-- ---------- کالاها ----------
--  kind: civil = قطعات سیویل (قالب/داربست، برگشت‌پذیر) · material = مصالح · consumable = مصرفی
--        tool = ابزارآلات · asset = اموال (کالای شماره‌دار)
create table if not exists public.wh_items (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  kind        text not null default 'material' check (kind in ('civil','material','consumable','tool','asset')),
  category    text,
  unit        text not null default 'عدد',
  spec        text,                    -- مشخصات / سایز
  weight      numeric,                 -- وزن واحد (کیلوگرم)
  min_qty     numeric not null default 0,
  notes       text,
  active      boolean not null default true,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists wh_items_kind_idx on public.wh_items(kind);

-- ---------- اسناد انبار ----------
--  receipt = رسید (+) · return = برگشت از مصرف (+) · issue = حواله (−)
--  transfer = انتقال بین انبارها (− مبدأ / + مقصد) · adjust = تعدیل / انبارگردانی (±)
create table if not exists public.wh_docs (
  id              uuid primary key default gen_random_uuid(),
  warehouse_id    uuid not null references public.wh_warehouses(id) on delete restrict,
  type            text not null check (type in ('receipt','issue','transfer','return','adjust')),
  doc_no          text not null,
  doc_date        text not null,          -- تاریخ شمسی YYYY/MM/DD
  to_warehouse_id uuid references public.wh_warehouses(id) on delete restrict,
  party           text,                   -- تأمین‌کننده / تحویل‌گیرنده / پیمانکار
  project         text,                   -- محل مصرف / پروژه
  ref_no          text,                   -- شماره درخواست خرید / فاکتور / نامه
  notes           text,
  status          text not null default 'final' check (status in ('final','void')),
  void_reason     text,
  created_by      uuid default auth.uid(),
  created_name    text,
  created_at      timestamptz not null default now(),
  updated_by      uuid default auth.uid(),
  updated_at      timestamptz not null default now(),
  unique (warehouse_id, type, doc_no),
  check (type <> 'transfer' or (to_warehouse_id is not null and to_warehouse_id <> warehouse_id))
);
create index if not exists wh_docs_wh_idx on public.wh_docs(warehouse_id);
create index if not exists wh_docs_to_idx on public.wh_docs(to_warehouse_id);
create index if not exists wh_docs_date_idx on public.wh_docs(doc_date);

create table if not exists public.wh_lines (
  id       uuid primary key default gen_random_uuid(),
  doc_id   uuid not null references public.wh_docs(id) on delete cascade,
  item_id  uuid not null references public.wh_items(id) on delete restrict,
  qty      numeric not null check (qty <> 0),
  note     text,
  sort     int not null default 0
);
create index if not exists wh_lines_doc_idx on public.wh_lines(doc_id);
create index if not exists wh_lines_item_idx on public.wh_lines(item_id);

-- ---------- اموال (کالای شماره‌دار / پلاک‌دار) ----------
create table if not exists public.wh_assets (
  id            uuid primary key default gen_random_uuid(),
  tag_no        text unique not null,      -- شماره اموال / پلاک
  item_id       uuid references public.wh_items(id) on delete set null,
  name          text not null,
  serial        text,
  brand         text,
  warehouse_id  uuid references public.wh_warehouses(id) on delete set null,
  holder        text,                      -- تحویل‌گیرنده (شخص)
  holder_unit   text,                      -- واحد / پیمانکار / محل استقرار
  status        text not null default 'in_stock' check (status in ('in_stock','assigned','repair','lost','scrapped')),
  acquired_date text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists wh_assets_wh_idx on public.wh_assets(warehouse_id);

create table if not exists public.wh_asset_log (
  id        bigserial primary key,
  asset_id  uuid not null references public.wh_assets(id) on delete cascade,
  action    text not null,
  details   text,
  user_id   uuid default auth.uid(),
  username  text,
  at        timestamptz not null default now()
);
create index if not exists wh_asset_log_idx on public.wh_asset_log(asset_id);

-- ---------- تاریخچه و تنظیمات ----------
create table if not exists public.wh_log (
  id           bigserial primary key,
  warehouse_id uuid,
  entity       text,          -- doc / item / asset / warehouse / user
  entity_id    text,
  label        text,
  action       text not null,
  details      text,
  user_id      uuid default auth.uid(),
  username     text,
  at           timestamptz not null default now()
);
create index if not exists wh_log_at_idx on public.wh_log(at desc);

create table if not exists public.wh_settings (
  key    text primary key,
  value  jsonb
);
insert into public.wh_settings(key, value) values
  ('company', '"فولاد تکنیک"'::jsonb),
  ('allow_negative', 'false'::jsonb)
on conflict (key) do nothing;

-- ---------- محاسبه موجودی ----------
create or replace function public.wh_balance(w uuid, it uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case
      when d.warehouse_id = w and d.type in ('issue','transfer') then -l.qty
      when d.warehouse_id = w then l.qty
      when d.to_warehouse_id = w and d.type = 'transfer' then l.qty
      else 0 end), 0)
  from public.wh_lines l join public.wh_docs d on d.id = l.doc_id
  where l.item_id = it and d.status = 'final' and (d.warehouse_id = w or d.to_warehouse_id = w);
$$;

-- گردش کالا (هر ردیف سند = یک حرکت؛ انتقال دو حرکت دارد). RLS جدول‌ها اعمال می‌شود.
create or replace view public.wh_moves with (security_invoker = true) as
  select l.id as line_id, d.id as doc_id, d.warehouse_id, l.item_id, d.type, d.doc_no, d.doc_date, d.created_at,
         case when d.type in ('issue','transfer') then -l.qty else l.qty end as qty,
         d.party, d.project, d.to_warehouse_id as other_warehouse_id, l.note
    from public.wh_lines l join public.wh_docs d on d.id = l.doc_id
   where d.status = 'final' and public.wh_can_see(d.warehouse_id)
  union all
  select l.id, d.id, d.to_warehouse_id, l.item_id, 'transfer_in', d.doc_no, d.doc_date, d.created_at,
         l.qty, d.party, d.project, d.warehouse_id, l.note
    from public.wh_lines l join public.wh_docs d on d.id = l.doc_id
   where d.status = 'final' and d.type = 'transfer' and public.wh_can_see(d.to_warehouse_id);

create or replace view public.wh_stock with (security_invoker = true) as
  select warehouse_id, item_id, sum(qty) as qty, max(doc_date) as last_date,
         max(case when qty < 0 then doc_date end) as last_out, count(*) as moves
    from public.wh_moves group by warehouse_id, item_id;

-- ---------- شماره‌گذاری خودکار: 1405-0001 جدا برای هر انبار و هر نوع سند ----------
create or replace function public.wh_next_no(w uuid, t text, d text) returns text
language sql stable security definer set search_path = public as $$
  select left(coalesce(nullif(d,''), '0000'), 4) || '-' || lpad((coalesce(max(nullif(substring(doc_no from '(\d+)\s*$'), '')::bigint), 0) + 1)::text, 4, '0')
    from public.wh_docs
   where warehouse_id = w and type = t and doc_no like left(coalesce(nullif(d,''), '0000'), 4) || '-%';
$$;

-- کنترل منفی نشدن موجودی برای مجموعه‌ای از کالاها در یک انبار
create or replace function public.wh_check_negative(w uuid, items uuid[]) returns void
language plpgsql stable security definer set search_path = public as $$
declare bad text;
begin
  if w is null or coalesce((select value::text from public.wh_settings where key = 'allow_negative'), 'false') = 'true' then return; end if;
  select string_agg(i.code || ' ' || i.name || ' (' || trim(to_char(public.wh_balance(w, i.id), 'FM999999999990.###')) || ')', '، ')
    into bad
    from public.wh_items i where i.id = any(items) and public.wh_balance(w, i.id) < 0;
  if bad is not null then
    raise exception 'موجودی کافی نیست: %', bad using errcode = 'P0001';
  end if;
end $$;

-- ---------- ثبت / ویرایش سند (اتمیک: سربرگ + ردیف‌ها + کنترل موجودی) ----------
create or replace function public.wh_save_doc(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid := nullif(p->>'id','')::uuid;
  v_wh    uuid := nullif(p->>'warehouse_id','')::uuid;
  v_type  text := p->>'type';
  v_to    uuid := nullif(p->>'to_warehouse_id','')::uuid;
  v_no    text := nullif(trim(coalesce(p->>'doc_no','')),'');
  v_date  text := nullif(trim(coalesce(p->>'doc_date','')),'');
  v_force boolean := coalesce((p->>'force')::boolean, false) and public.wh_is_admin();
  v_old   public.wh_docs;
  v_name  text := (select coalesce(full_name, username) from public.wh_profiles where id = auth.uid());
  v_items uuid[];
  v_old_items uuid[] := '{}';
  ln      jsonb;
  i       int := 0;
  q       numeric;
begin
  if v_wh is null then raise exception 'انبار را انتخاب کنید'; end if;
  if v_type not in ('receipt','issue','transfer','return','adjust') then raise exception 'نوع سند نامعتبر است'; end if;
  if not public.wh_can_write(v_wh) then raise exception 'شما اجازه ثبت سند در این انبار را ندارید'; end if;
  if v_date is null or v_date !~ '^\d{4}/\d{2}/\d{2}$' then raise exception 'تاریخ سند نامعتبر است (مثال 1405/07/13)'; end if;
  if v_type = 'transfer' then
    if v_to is null or v_to = v_wh then raise exception 'انبار مقصد انتقال را درست انتخاب کنید'; end if;
  else v_to := null; end if;
  if jsonb_typeof(p->'lines') <> 'array' or jsonb_array_length(p->'lines') = 0 then raise exception 'حداقل یک ردیف کالا لازم است'; end if;

  if v_id is not null then
    select * into v_old from public.wh_docs where id = v_id for update;
    if not found then raise exception 'سند پیدا نشد'; end if;
    if not public.wh_is_admin() then raise exception 'ویرایش سند ثبت‌شده فقط توسط مدیر انبار ممکن است'; end if;
    if v_old.status = 'void' then raise exception 'سند باطل‌شده قابل ویرایش نیست'; end if;
    select coalesce(array_agg(distinct item_id), '{}') into v_old_items from public.wh_lines where doc_id = v_id;
  end if;

  -- قفل انبار تا شماره‌گذاری و کنترل موجودی همزمان قاطی نشود
  perform pg_advisory_xact_lock(hashtext('wh:' || v_wh::text));
  if v_to is not null then perform pg_advisory_xact_lock(hashtext('wh:' || v_to::text)); end if;

  if v_no is null and v_old.id is not null and v_old.warehouse_id = v_wh and v_old.type = v_type then v_no := v_old.doc_no; end if;
  if v_no is null then v_no := public.wh_next_no(v_wh, v_type, v_date); end if;

  if v_id is null then
    insert into public.wh_docs (warehouse_id, type, doc_no, doc_date, to_warehouse_id, party, project, ref_no, notes, created_name)
    values (v_wh, v_type, v_no, v_date, v_to, nullif(p->>'party',''), nullif(p->>'project',''), nullif(p->>'ref_no',''), nullif(p->>'notes',''), v_name)
    returning id into v_id;
  else
    update public.wh_docs set warehouse_id = v_wh, type = v_type, doc_no = v_no, doc_date = v_date, to_warehouse_id = v_to,
      party = nullif(p->>'party',''), project = nullif(p->>'project',''), ref_no = nullif(p->>'ref_no',''), notes = nullif(p->>'notes',''),
      updated_by = auth.uid(), updated_at = now()
    where id = v_id;
    delete from public.wh_lines where doc_id = v_id;
  end if;

  for ln in select * from jsonb_array_elements(p->'lines') loop
    i := i + 1;
    q := nullif(ln->>'qty','')::numeric;
    if q is null or q = 0 then raise exception 'مقدار ردیف % وارد نشده', i; end if;
    if v_type <> 'adjust' and q < 0 then raise exception 'مقدار ردیف % نباید منفی باشد', i; end if;
    insert into public.wh_lines (doc_id, item_id, qty, note, sort)
    values (v_id, (ln->>'item_id')::uuid, q, nullif(ln->>'note',''), i);
  end loop;

  select coalesce(array_agg(distinct item_id), '{}') into v_items from public.wh_lines where doc_id = v_id;
  if not v_force then
    perform public.wh_check_negative(v_wh, v_items || v_old_items);
    if v_old.id is not null and v_old.warehouse_id <> v_wh then perform public.wh_check_negative(v_old.warehouse_id, v_old_items); end if;
    if v_old.id is not null and v_old.to_warehouse_id is not null then perform public.wh_check_negative(v_old.to_warehouse_id, v_old_items); end if;
  end if;

  insert into public.wh_log (warehouse_id, entity, entity_id, label, action, details, username)
  values (v_wh, 'doc', v_id::text, v_type || ' ' || v_no, case when v_old.id is null then 'create' else 'update' end, i || ' ردیف', v_name);

  return (select to_jsonb(d) from public.wh_docs d where d.id = v_id);
exception when unique_violation then
  raise exception 'شماره سند «%» در این انبار قبلاً ثبت شده است', v_no;
end $$;

-- ابطال سند (فقط مدیر انبار). موجودی برمی‌گردد؛ اگر منفی شود خطا می‌دهد مگر force.
create or replace function public.wh_void_doc(doc uuid, reason text, force boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare d public.wh_docs; v_items uuid[]; v_name text := (select coalesce(full_name, username) from public.wh_profiles where id = auth.uid());
begin
  if not public.wh_is_admin() then raise exception 'ابطال سند فقط توسط مدیر انبار ممکن است'; end if;
  select * into d from public.wh_docs where id = doc for update;
  if not found then raise exception 'سند پیدا نشد'; end if;
  if d.status = 'void' then return; end if;
  update public.wh_docs set status = 'void', void_reason = reason, updated_by = auth.uid(), updated_at = now() where id = doc;
  select coalesce(array_agg(distinct item_id), '{}') into v_items from public.wh_lines where doc_id = doc;
  if not force then
    perform public.wh_check_negative(d.warehouse_id, v_items);
    if d.to_warehouse_id is not null then perform public.wh_check_negative(d.to_warehouse_id, v_items); end if;
  end if;
  insert into public.wh_log (warehouse_id, entity, entity_id, label, action, details, username)
  values (d.warehouse_id, 'doc', doc::text, d.type || ' ' || d.doc_no, 'void', reason, v_name);
end $$;

-- ---------- مدیریت کاربران انبار ----------
-- فهرست کاربران + نقش انبار + انبارهای مجاز
create or replace function public.wh_list_users() returns table (
  id uuid, username text, full_name text, wh_role text, members jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.full_name, coalesce(u.role, 'none'),
         coalesce((select jsonb_agg(jsonb_build_object('warehouse_id', m.warehouse_id, 'role', m.role)) from public.wh_members m where m.user_id = p.id), '[]'::jsonb),
         p.created_at
    from public.wh_profiles p left join public.wh_users u on u.user_id = p.id
   where public.wh_is_admin()
   order by p.created_at;
$$;

create or replace function public.wh_admin_set_user(target uuid, new_role text, members jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  if not public.wh_is_admin() then raise exception 'فقط مدیر انبار'; end if;
  if new_role not in ('admin','auditor','user','none') then raise exception 'نقش نامعتبر'; end if;
  if target = auth.uid() and new_role <> 'admin' then
    raise exception 'نمی‌توانید نقش مدیر را از خودتان بگیرید';
  end if;
  insert into public.wh_users (user_id, role) values (target, new_role)
  on conflict (user_id) do update set role = excluded.role;
  delete from public.wh_members where user_id = target;
  for m in select * from jsonb_array_elements(coalesce(members, '[]'::jsonb)) loop
    insert into public.wh_members (user_id, warehouse_id, role)
    values (target, (m->>'warehouse_id')::uuid, coalesce(nullif(m->>'role',''), 'keeper'))
    on conflict do nothing;
  end loop;
  insert into public.wh_log (entity, entity_id, label, action, details, username)
  values ('user', target::text, (select username from public.wh_profiles where id = target), 'role', new_role,
          (select coalesce(full_name, username) from public.wh_profiles where id = auth.uid()));
end $$;

-- تغییر رمز و حذف کاربر توسط مدیر انبار
create or replace function public.wh_admin_set_password(target uuid, new_password text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.wh_is_admin() then raise exception 'فقط مدیر انبار'; end if;
  if length(new_password) < 6 then raise exception 'رمز باید حداقل ۶ کاراکتر باشد'; end if;
  update auth.users set encrypted_password = crypt(new_password, gen_salt('bf')) where id = target;
end $$;

create or replace function public.wh_admin_delete_user(target uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.wh_is_admin() then raise exception 'فقط مدیر انبار'; end if;
  if target = auth.uid() then raise exception 'نمی‌توانید حساب خودتان را حذف کنید'; end if;
  delete from auth.users where id = target;
end $$;

-- تغییر نام کاربری و نام نمایشی توسط مدیر
create or replace function public.wh_admin_rename_user(target uuid, new_username text, new_full_name text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare u text := lower(trim(coalesce(new_username, '')));
begin
  if not public.wh_is_admin() then raise exception 'فقط مدیر انبار'; end if;
  if u !~ '^[a-z0-9._-]{3,}$' then raise exception 'نام کاربری باید انگلیسی و حداقل ۳ حرف باشد'; end if;
  if exists (select 1 from public.wh_profiles where username = u and id <> target) then raise exception 'این نام کاربری قبلاً ثبت شده'; end if;
  update public.wh_profiles set username = u, full_name = coalesce(nullif(trim(new_full_name), ''), full_name) where id = target;
  update auth.users set email = u || '@anbaryar.app' where id = target;
end $$;

-- ---------- دسترسی API ----------
grant usage on schema public to anon, authenticated;
grant select on public.wh_profiles to authenticated;
grant update (full_name) on public.wh_profiles to authenticated;
grant execute on function public.wh_has_users() to anon, authenticated;
grant select, insert, update, delete on public.wh_users, public.wh_warehouses, public.wh_members, public.wh_items,
  public.wh_docs, public.wh_lines, public.wh_assets, public.wh_asset_log, public.wh_log, public.wh_settings to authenticated;
grant select on public.wh_moves, public.wh_stock to authenticated;
grant usage, select on sequence public.wh_log_id_seq, public.wh_asset_log_id_seq to authenticated;
grant execute on function public.wh_role(), public.wh_is_admin(), public.wh_active(), public.wh_can_see(uuid), public.wh_can_write(uuid),
  public.wh_can_write_any(), public.wh_balance(uuid, uuid), public.wh_next_no(uuid, text, text) to authenticated;
revoke all on function public.wh_save_doc(jsonb), public.wh_void_doc(uuid, text, boolean), public.wh_list_users(),
  public.wh_admin_set_user(uuid, text, jsonb), public.wh_admin_set_password(uuid, text), public.wh_admin_delete_user(uuid), public.wh_admin_rename_user(uuid, text, text), public.wh_check_negative(uuid, uuid[]) from public, anon;
grant execute on function public.wh_save_doc(jsonb), public.wh_void_doc(uuid, text, boolean), public.wh_list_users(),
  public.wh_admin_set_user(uuid, text, jsonb), public.wh_admin_set_password(uuid, text), public.wh_admin_delete_user(uuid), public.wh_admin_rename_user(uuid, text, text), public.wh_check_negative(uuid, uuid[]) to authenticated;

-- ---------- RLS ----------
alter table public.wh_profiles   enable row level security;
alter table public.wh_users      enable row level security;
alter table public.wh_warehouses enable row level security;
alter table public.wh_members    enable row level security;
alter table public.wh_items      enable row level security;
alter table public.wh_docs       enable row level security;
alter table public.wh_lines      enable row level security;
alter table public.wh_assets     enable row level security;
alter table public.wh_asset_log  enable row level security;
alter table public.wh_log        enable row level security;
alter table public.wh_settings   enable row level security;

do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and tablename like 'wh\_%' loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- پروفایل: هر کس خودش، کاربران فعال همه را (برای نام‌ها)؛ هر کس فقط نام نمایشی خودش را عوض می‌کند
create policy wh_profiles_sel on public.wh_profiles for select using (id = auth.uid() or public.wh_active());
create policy wh_profiles_upd on public.wh_profiles for update using (id = auth.uid() or public.wh_is_admin()) with check (id = auth.uid() or public.wh_is_admin());

-- نقش و دسترسی‌ها: هر کس مال خودش را می‌بیند؛ تغییر فقط از طریق تابع مدیر
create policy wh_users_sel on public.wh_users for select using (user_id = auth.uid() or public.wh_is_admin());
create policy wh_users_all on public.wh_users for all using (public.wh_is_admin()) with check (public.wh_is_admin());
create policy wh_members_sel on public.wh_members for select using (user_id = auth.uid() or public.wh_is_admin());
create policy wh_members_all on public.wh_members for all using (public.wh_is_admin()) with check (public.wh_is_admin());

-- انبارها: نام همه انبارها برای کاربران فعال قابل دیدن است (برای انتخاب مقصد انتقال)
create policy wh_wh_sel on public.wh_warehouses for select using (public.wh_active());
create policy wh_wh_all on public.wh_warehouses for all using (public.wh_is_admin()) with check (public.wh_is_admin());

-- کالاها: همه کاربران فعال می‌بینند؛ تعریف، ویرایش و حذف فقط با مدیر
create policy wh_items_sel on public.wh_items for select using (public.wh_active());
create policy wh_items_ins on public.wh_items for insert with check (public.wh_is_admin());
create policy wh_items_upd on public.wh_items for update using (public.wh_is_admin()) with check (public.wh_is_admin());
create policy wh_items_del on public.wh_items for delete using (public.wh_is_admin());

-- اسناد: مشاهده اگر انبار مبدأ یا مقصد مجاز باشد. ثبت/ویرایش از طریق wh_save_doc. حذف فقط مدیر.
create policy wh_docs_sel on public.wh_docs for select using (public.wh_can_see(warehouse_id) or (to_warehouse_id is not null and public.wh_can_see(to_warehouse_id)));
create policy wh_docs_del on public.wh_docs for delete using (public.wh_is_admin());
create policy wh_lines_sel on public.wh_lines for select using (exists (select 1 from public.wh_docs d where d.id = doc_id));

-- اموال
create policy wh_assets_sel on public.wh_assets for select using (public.wh_role() in ('admin','auditor') or (warehouse_id is not null and public.wh_can_see(warehouse_id)));
create policy wh_assets_ins on public.wh_assets for insert with check (public.wh_is_admin() or (warehouse_id is not null and public.wh_can_write(warehouse_id)));
create policy wh_assets_upd on public.wh_assets for update using (public.wh_is_admin() or (warehouse_id is not null and public.wh_can_write(warehouse_id))) with check (public.wh_can_write_any());
create policy wh_assets_del on public.wh_assets for delete using (public.wh_is_admin());
create policy wh_alog_sel on public.wh_asset_log for select using (exists (select 1 from public.wh_assets a where a.id = asset_id));
create policy wh_alog_ins on public.wh_asset_log for insert with check (public.wh_can_write_any());

create policy wh_log_sel on public.wh_log for select using (public.wh_role() in ('admin','auditor') or (warehouse_id is not null and public.wh_can_see(warehouse_id)));
create policy wh_log_ins on public.wh_log for insert with check (public.wh_active());

create policy wh_set_sel on public.wh_settings for select using (public.wh_active());
create policy wh_set_all on public.wh_settings for all using (public.wh_is_admin()) with check (public.wh_is_admin());

-- ---------- به‌روزرسانی زنده (Realtime) ----------
do $$ begin
  begin alter publication supabase_realtime add table public.wh_docs; exception when others then null; end;
  begin alter publication supabase_realtime add table public.wh_items; exception when others then null; end;
  begin alter publication supabase_realtime add table public.wh_assets; exception when others then null; end;
  begin alter publication supabase_realtime add table public.wh_warehouses; exception when others then null; end;
end $$;

-- انبارها، کالاها و کاربران را مدیر از داخل برنامه تعریف می‌کند.
