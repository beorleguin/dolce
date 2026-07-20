# Limpieza total de imágenes

El proyecto no incluye imágenes locales de productos, bodegas, banners ni logos. Las imágenes nuevas se cargan manualmente desde el CRM y se almacenan en Supabase Storage.

## Borrar todas las imágenes existentes en Supabase

Con `.env.local` configurado en la raíz:

```bat
npm install
npm run supabase:clear-images
```

El comando:

- Vacía los buckets `products` y `wineries`.
- Borra los archivos de imagen del bucket `site`, pero conserva los PDF.
- Limpia `products.image_url` y `products.image_path`.
- Marca los productos con `image_pending = true`.
- Limpia `wineries.logo_url`.
- Limpia `site_banners.desktop_image_url` y `site_banners.mobile_image_url`.

## Carga manual desde el CRM

En `Administración > Vinos > Editar producto`:

1. Seleccionar **Subir imagen**.
2. Esperar a que aparezca la vista previa.
3. Presionar **Guardar cambios**.

El archivo queda en el bucket `products` y el producto guarda `image_url` e `image_path` en la base de datos.
