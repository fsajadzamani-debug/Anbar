-- =====================================================================
--  چت سازمانی انباریار — یک‌بار در SQL Editor اجرا کنید (اجرای دوباره بی‌خطر است)
--  اتاق‌ها: 'general' = گروه عمومی همه کاربران · 'dm:<uuid>:<uuid>' = پیام خصوصی دو نفر
-- =====================================================================

-- سکوت کاربر (فقط مدیر تعیین می‌کند)
alter table public.wh_users add column if not exists muted boolean not null default false;

create or replace function public.wh_is_muted() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select muted from public.wh_users where user_id = auth.uid()), false);
$$;

create or replace function public.wh_admin_set_mute(target uuid, mute boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.wh_is_admin() then raise exception 'فقط مدیر انبار'; end if;
  if target = auth.uid() then raise exception 'نمی‌توانید خودتان را ساکت کنید'; end if;
  insert into public.wh_users (user_id, role, muted) values (target, 'none', mute)
  on conflict (user_id) do update set muted = excluded.muted;
end $$;

-- عضویت در اتاق
create or replace function public.wh_in_room(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.wh_active() and (r = 'general' or (r like 'dm:%' and position(auth.uid()::text in r) > 0));
$$;

create table if not exists public.wh_chat (
  id          bigserial primary key,
  room        text not null default 'general' check (room = 'general' or room ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$'),
  user_id     uuid default auth.uid() references auth.users(id) on delete set null,
  username    text,
  body        text not null check (length(body) between 1 and 4000),
  reply_to    bigint references public.wh_chat(id) on delete set null,
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);
create index if not exists wh_chat_room_idx on public.wh_chat(room, id desc);

-- فرستنده و زمان قابل جعل نیست؛ ویرایش زمان می‌خورد
create or replace function public.wh_chat_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid(); new.created_at := now(); new.edited_at := null;
    new.username := (select coalesce(full_name, username) from public.wh_profiles where id = auth.uid());
  else
    new.user_id := old.user_id; new.created_at := old.created_at; new.username := old.username; new.room := old.room;
    if new.body is distinct from old.body then new.edited_at := now(); end if;
  end if;
  return new;
end $$;
drop trigger if exists wh_chat_guard on public.wh_chat;
create trigger wh_chat_guard before insert or update on public.wh_chat
  for each row execute function public.wh_chat_guard();

alter table public.wh_chat enable row level security;
drop policy if exists wh_chat_sel on public.wh_chat;
drop policy if exists wh_chat_ins on public.wh_chat;
drop policy if exists wh_chat_upd on public.wh_chat;
drop policy if exists wh_chat_del on public.wh_chat;
create policy wh_chat_sel on public.wh_chat for select using (public.wh_in_room(room));
create policy wh_chat_ins on public.wh_chat for insert with check (public.wh_in_room(room) and not public.wh_is_muted());
-- ویرایش: صاحب پیام (اگر ساکت نباشد) یا مدیر
create policy wh_chat_upd on public.wh_chat for update
  using ((user_id = auth.uid() and not public.wh_is_muted()) or (public.wh_is_admin() and public.wh_in_room(room)))
  with check (public.wh_in_room(room));
-- حذف: صاحب پیام یا مدیر
create policy wh_chat_del on public.wh_chat for delete using (user_id = auth.uid() or (public.wh_is_admin() and public.wh_in_room(room)));

-- فهرست وضعیت سکوت کاربران (برای نمایش به مدیر)
create or replace function public.wh_muted_list() returns setof uuid
language sql stable security definer set search_path = public as $$
  select user_id from public.wh_users where muted and public.wh_is_admin();
$$;

grant select, insert, update, delete on public.wh_chat to authenticated;
grant usage, select on sequence public.wh_chat_id_seq to authenticated;
grant execute on function public.wh_is_muted(), public.wh_in_room(text), public.wh_muted_list() to authenticated;
revoke all on function public.wh_admin_set_mute(uuid, boolean) from public, anon;
grant execute on function public.wh_admin_set_mute(uuid, boolean) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.wh_chat; exception when others then null; end;
  begin alter publication supabase_realtime add table public.wh_users; exception when others then null; end;
end $$;

notify pgrst, 'reload schema';
