create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  original_name text,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete cascade,
  name text not null,
  slug text not null,
  original_name text,
  created_at timestamptz not null default now(),
  unique(category_id, slug)
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  logo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.wineries (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete set null,
  name text not null unique,
  slug text not null unique,
  logo_url text,
  description text,
  enabled boolean not null default true,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.varietals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  external_key text unique,
  sku text,
  name text not null,
  article_name text,
  slug text not null unique,
  category_id uuid references public.categories(id) on delete set null,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  winery_id uuid references public.wineries(id) on delete set null,
  varietal_id uuid references public.varietals(id) on delete set null,
  supplier text,
  description text,
  price numeric(14,2) not null default 0,
  currency text not null default 'ARS',
  stock integer not null default 0,
  units_per_box integer not null default 1,
  volume_ml integer,
  image_url text,
  image_path text,
  image_pending boolean not null default true,
  enabled boolean not null default true,
  featured boolean not null default false,
  featured_order integer not null default 0,
  source_sheet text,
  source_category text,
  source_subcategory text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_enabled_idx on public.products(enabled);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_brand_idx on public.products(brand_id);
create index if not exists products_winery_idx on public.products(winery_id);
create index if not exists products_varietal_idx on public.products(varietal_id);
create index if not exists products_image_pending_idx on public.products(image_pending);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('admin','user')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_banners (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('hero','middle','category')),
  title text,
  subtitle text,
  desktop_image_url text,
  mobile_image_url text,
  link_url text,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists wineries_updated_at on public.wineries;
create trigger wineries_updated_at before update on public.wineries for each row execute function public.set_updated_at();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists site_banners_updated_at on public.site_banners;
create trigger site_banners_updated_at before update on public.site_banners for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, full_name, role)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'user')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
