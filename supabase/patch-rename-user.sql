-- افزودن امکان تغییر نام کاربری (یک‌بار در SQL Editor اجرا کنید)
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

revoke all on function public.wh_admin_rename_user(uuid, text, text) from public, anon;
grant execute on function public.wh_admin_rename_user(uuid, text, text) to authenticated;
