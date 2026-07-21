# Catálogo PDF - Diseño V2

Archivo modificado:

- `app/api/catalog/generate/route.ts`

El nuevo catálogo incluye:

- Carátula gris oscura con logo, año y fecha de actualización.
- Separadores visuales por categoría.
- Vinos y espumantes agrupados alfabéticamente por bodega.
- Productos ordenados alfabéticamente dentro de cada bodega.
- Dos columnas por página para reducir la cantidad total de hojas.
- Footer en todas las páginas con logo, web, ubicación, fecha y número de página.
- Tratamiento especial de estuches como unidad x1.

El PDF se vuelve a guardar en:

`site/catalogos/catalogo-automatico.pdf`
