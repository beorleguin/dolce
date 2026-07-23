-- Mixes y promociones de productos
alter table public.products
  add column if not exists is_mix boolean not null default false;

create index if not exists products_is_mix_idx
  on public.products(is_mix);

create table if not exists public.product_mix_items (
  id uuid primary key default gen_random_uuid(),
  mix_product_id uuid not null references public.products(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(mix_product_id, product_id),
  check (mix_product_id <> product_id)
);

create index if not exists product_mix_items_mix_idx
  on public.product_mix_items(mix_product_id);

create index if not exists product_mix_items_product_idx
  on public.product_mix_items(product_id);

alter table public.product_mix_items enable row level security;

drop policy if exists "public read enabled mix items" on public.product_mix_items;
create policy "public read enabled mix items"
on public.product_mix_items
for select
using (
  exists (
    select 1
    from public.products mix
    where mix.id = mix_product_id
      and mix.enabled = true
      and mix.is_mix = true
  )
);

drop policy if exists "admins manage product mix items" on public.product_mix_items;
create policy "admins manage product mix items"
on public.product_mix_items
for all
using (public.is_admin())
with check (public.is_admin());

insert into public.categories (name, slug, original_name, sort_order, enabled)
values ('Promociones', 'promociones', 'Promociones', 90, true)
on conflict (name) do update
set enabled = true;
