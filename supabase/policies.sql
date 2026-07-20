alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.brands enable row level security;
alter table public.wineries enable row level security;
alter table public.varietals enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.site_banners enable row level security;
alter table public.site_settings enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role='admin');
$$;

-- lectura pública del catálogo
create policy "public read categories" on public.categories for select using (enabled);
create policy "public read subcategories" on public.subcategories for select using (true);
create policy "public read brands" on public.brands for select using (true);
create policy "public read wineries" on public.wineries for select using (enabled);
create policy "public read varietals" on public.varietals for select using (true);
create policy "public read enabled products" on public.products for select using (enabled);
create policy "public read banners" on public.site_banners for select using (enabled);
create policy "public read settings" on public.site_settings for select using (true);

-- administración
create policy "admins manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage subcategories" on public.subcategories for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage brands" on public.brands for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage wineries" on public.wineries for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage varietals" on public.varietals for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage banners" on public.site_banners for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage settings" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "users read own profile" on public.profiles for select using (id=auth.uid() or public.is_admin());
create policy "admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
