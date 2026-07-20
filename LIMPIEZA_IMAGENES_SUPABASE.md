# Limpieza de imágenes del catálogo

El proyecto conserva las imágenes de diseño del sitio (logo, hero, fondo y banner), pero no contiene fotos locales de productos ni logos de bodegas.

## Borrar imágenes de Supabase

1. Conservá tu `.env.local` en la raíz del proyecto.
2. Ejecutá:

```bat
npm install
npm run supabase:clear-images
```

El comando:

- elimina todos los objetos de los buckets `products` y `wineries`;
- deja intacto el bucket `site`;
- pone `products.image_url` y `products.image_path` en `null`;
- marca `products.image_pending = true`;
- pone `wineries.logo_url` en `null`.

## SQL de verificación

```sql
select count(*) as productos_con_imagen
from public.products
where image_url is not null or image_path is not null;

select count(*) as bodegas_con_logo
from public.wineries
where logo_url is not null;
```
