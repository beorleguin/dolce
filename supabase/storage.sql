insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('products','products',true,10485760,array['image/jpeg','image/png','image/webp']),
 ('wineries','wineries',true,10485760,array['image/jpeg','image/png','image/webp','image/svg+xml']),
 ('site','site',true,15728640,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=excluded.public;

create policy "public read storage" on storage.objects for select using (bucket_id in ('products','wineries','site'));
create policy "admins insert storage" on storage.objects for insert with check (bucket_id in ('products','wineries','site') and public.is_admin());
create policy "admins update storage" on storage.objects for update using (bucket_id in ('products','wineries','site') and public.is_admin()) with check (bucket_id in ('products','wineries','site') and public.is_admin());
create policy "admins delete storage" on storage.objects for delete using (bucket_id in ('products','wineries','site') and public.is_admin());
