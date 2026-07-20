# Fase 2 - CRM funcional y sitio conectado

## Instalación

1. Conservá tu archivo `.env.local`.
2. Reemplazá el proyecto por esta versión.
3. Ejecutá:

```bat
npm install
npm run dev
```

No hace falta volver a importar el Excel ni subir las imágenes.

## Funciones incluidas

- Sitio público conectado a `products`, `wineries`, `site_banners` y `site_settings` de Supabase.
- Solo se muestran productos con `enabled = true`.
- Los productos sin imagen usan un placeholder y siguen apareciendo.
- Botón "Ver más" carga cinco productos adicionales mientras queden registros.
- Gestión de vinos con filtros por categoría, bodega y varietal.
- Edición de precio, stock, disponibilidad, botellas por caja, destacado e imagen.
- Alta y eliminación de productos.
- Gestión de bodegas, logos, visibilidad y destacadas.
- Gestión de 3 banners del hero y banner central.
- Medidas recomendadas: desktop 1920 x 820 px y mobile 1080 x 1500 px.
- Catálogo PDF manual y catálogo automático.
- El PDF automático se regenera al guardar o eliminar un producto desde el panel.

## Catálogo PDF

La primera vez, entrá a:

`/admin/catalogo`

Y presioná "Regenerar ahora". Se guardará en el bucket `site`, ruta:

`catalogos/catalogo-automatico.pdf`

La generación automática depende de la variable privada `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` y Vercel.

## Vercel

Al publicar, agregá las mismas variables de `.env.local` en Vercel > Settings > Environment Variables. Nunca uses prefijo `NEXT_PUBLIC_` para claves privadas.
