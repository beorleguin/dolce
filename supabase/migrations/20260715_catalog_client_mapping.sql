-- Ejecutar una sola vez en Supabase SQL Editor antes de volver a importar.
alter table public.products add column if not exists article_name text;
update public.products set article_name=name where article_name is null;
create index if not exists products_article_name_idx on public.products using gin (to_tsvector('simple', coalesce(article_name,'')));
