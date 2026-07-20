# Dolce Vino

Sitio público y CRM en Next.js conectado a Supabase.

## Inicio local

1. Copiar `.env.local` en la raíz.
2. Instalar y ejecutar:

```bat
npm install
npm run dev
```

## Catálogo

- El catálogo se lee desde Supabase.
- Los productos sin fotografía utilizan un placeholder.
- Las imágenes de producto y logos de bodegas se cargarán en forma progresiva, bodega por bodega.
- El Excel fuente permanece en `data/lista-articulos.xlsx`.

## Limpieza de imágenes

Consultar `LIMPIEZA_IMAGENES_SUPABASE.md`.
