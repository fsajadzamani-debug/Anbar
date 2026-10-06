-- عکس پروفایل کاربران — یک‌بار در SQL Editor اجرا کنید (اجرای دوباره بی‌خطر است)
alter table public.wh_profiles add column if not exists avatar_url text;
grant update (full_name, avatar_url) on public.wh_profiles to authenticated;

-- فضای فایل عمومی برای عکس‌ها (فقط خواندن عمومی؛ هر کس فقط عکس خودش را می‌گذارد)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wh-avatars', 'wh-avatars', true, 524288, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 524288, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists wh_av_sel on storage.objects;
drop policy if exists wh_av_ins on storage.objects;
drop policy if exists wh_av_upd on storage.objects;
drop policy if exists wh_av_del on storage.objects;
create policy wh_av_sel on storage.objects for select using (bucket_id = 'wh-avatars');
create policy wh_av_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'wh-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy wh_av_upd on storage.objects for update to authenticated
  using (bucket_id = 'wh-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy wh_av_del on storage.objects for delete to authenticated
  using (bucket_id = 'wh-avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.wh_is_admin()));

do $$ begin begin alter publication supabase_realtime add table public.wh_profiles; exception when others then null; end; end $$;

notify pgrst, 'reload schema';
