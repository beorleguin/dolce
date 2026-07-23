-- Dolce Vino · Bloque A
-- 1) Fuerza unidades x1 para destilados, whisky, ron y ginebra.
-- 2) Crea la función segura para aumentos masivos de precios.

update public.products p
set units_per_box = 1
from public.categories c
where p.category_id = c.id
  and (
    lower(unaccent(c.name)) ~ '(destilado|whisk(y|ey)|ron|ginebra|gin)'
    or lower(unaccent(coalesce(p.name, '') || ' ' || coalesce(p.article_name, ''))) ~ '(destilado|whisk(y|ey)|ron|ginebra|gin)'
  );

create or replace function public.bulk_increase_product_prices(
  product_ids uuid[],
  percentage numeric,
  round_to numeric default 100
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected integer;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  if product_ids is null or array_length(product_ids, 1) is null then
    return 0;
  end if;

  if percentage is null or percentage <= 0 then
    raise exception 'El porcentaje debe ser mayor a cero';
  end if;

  update public.products
  set price = case
    when coalesce(round_to, 0) > 0 then
      round((price * (1 + percentage / 100)) / round_to) * round_to
    else
      round(price * (1 + percentage / 100), 2)
  end
  where id = any(product_ids);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

grant execute on function public.bulk_increase_product_prices(uuid[], numeric, numeric) to authenticated;
