-- =====================================================================
--  اعلان (نوتیفیکیشن) پیام‌های چت حتی وقتی سایت بسته است
--  ۱) اول تابع push را در Supabase → Edge Functions بسازید (راهنما در README)
--  ۲) بعد این فایل را یک‌بار در SQL Editor اجرا کنید (اجرای دوباره بی‌خطر است)
-- =====================================================================
create extension if not exists pg_net;

-- تنظیمات محرمانه (کلیدهای VAPID و رمز داخلی) — هیچ کاربری دسترسی خواندن ندارد
create table if not exists public.wh_private (key text primary key, value text not null);
alter table public.wh_private enable row level security;
revoke all on public.wh_private from anon, authenticated;
insert into public.wh_private (key, value) values
  ('push_secret', encode(gen_random_bytes(24), 'hex')),
  ('push_url', 'https://mettjxzwkkegxyfhoahh.supabase.co/functions/v1/push')
on conflict (key) do nothing;

-- اشتراک اعلان هر دستگاه
create table if not exists public.wh_push_subs (
  endpoint    text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  p256dh      text not null,
  auth        text not null,
  ua          text,
  created_at  timestamptz not null default now()
);
create index if not exists wh_push_subs_user_idx on public.wh_push_subs(user_id);
alter table public.wh_push_subs enable row level security;
drop policy if exists wh_push_own on public.wh_push_subs;
create policy wh_push_own on public.wh_push_subs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.wh_push_subs to authenticated;

-- بعد از هر پیام جدید، تابع push صدا زده می‌شود
create or replace function public.wh_chat_push() returns trigger
language plpgsql security definer set search_path = public, net, extensions as $$
declare u text := (select value from public.wh_private where key = 'push_url');
        s text := (select value from public.wh_private where key = 'push_secret');
begin
  if u is not null then
    perform net.http_post(url := u, body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s));
  end if;
  return new;
exception when others then return new;   -- خطای اعلان هرگز جلوی ثبت پیام را نگیرد
end $$;
drop trigger if exists wh_chat_push on public.wh_chat;
create trigger wh_chat_push after insert on public.wh_chat for each row execute function public.wh_chat_push();

notify pgrst, 'reload schema';
