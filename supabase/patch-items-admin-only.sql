-- فقط مدیر انبار بتواند کد کالا تعریف کند (یک‌بار در SQL Editor اجرا کنید)
drop policy if exists wh_items_ins on public.wh_items;
create policy wh_items_ins on public.wh_items for insert with check (public.wh_is_admin());
