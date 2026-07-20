import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { clean, normalized, classifyProduct } from './lib/catalog-classification.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en .env.local');
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const input = path.resolve(process.cwd(), process.env.CATALOG_XLSX || 'data/lista-articulos.xlsx');
if (!fs.existsSync(input)) throw new Error(`No se encontró el Excel: ${input}`);

const APPLY = process.argv.includes('--apply');
const slugify = (value) => normalized(value).replace(/\s+/g, '-');
const chunks = (arr, size = 150) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

async function fetchAll(table, select = '*') {
  const rows = [];
  const pageSize = 750;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < pageSize) break;
  }
  return rows;
}
async function upsertRows(table, rows, onConflict) {
  for (const batch of chunks(rows)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

const wb = XLSX.readFile(input, { cellDates: false });
const excelRows = [];
for (const sheetName of ['INCLUIDOS', 'NO INCLUIDOS']) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) continue;
  for (const row of XLSX.utils.sheet_to_json(sheet, { defval: null })) {
    const articleName = clean(row['Nombre del Artículo']);
    if (!articleName) continue;
    const brand = clean(row.Marca) || articleName;
    const mapped = classifyProduct(articleName, clean(row['Categoría']), clean(row['Subcategoría']));
    excelRows.push({
      external_key: crypto.createHash('sha1').update(`${sheetName}|${articleName}|${brand}`).digest('hex'),
      article_name: articleName,
      brand,
      source_sheet: sheetName,
      source_category: clean(row['Categoría']),
      source_subcategory: clean(row['Subcategoría']),
      category: mapped.category,
      subcategory: mapped.subcategory,
      varietal: mapped.varietal,
    });
  }
}

const [products, categoriesNow, varietalsNow, subcategoriesNow] = await Promise.all([
  fetchAll('products', 'id,external_key,article_name,name,category_id,subcategory_id,varietal_id,image_url,image_path,image_pending'),
  fetchAll('categories', 'id,name,slug'),
  fetchAll('varietals', 'id,name,slug'),
  fetchAll('subcategories', 'id,name,slug,category_id'),
]);
const productByKey = new Map(products.map((row) => [row.external_key, row]));
const categoryById = new Map(categoriesNow.map((row) => [row.id, row]));
const varietalById = new Map(varietalsNow.map((row) => [row.id, row]));
const subcategoryById = new Map(subcategoriesNow.map((row) => [row.id, row]));

const changes = [];
const missing = [];
for (const expected of excelRows) {
  const current = productByKey.get(expected.external_key);
  if (!current) { missing.push(expected.article_name); continue; }
  const currentCategory = categoryById.get(current.category_id)?.name || '';
  const currentSubcategory = subcategoryById.get(current.subcategory_id)?.name || '';
  const currentVarietal = varietalById.get(current.varietal_id)?.name || '';
  if (currentCategory !== expected.category || currentSubcategory !== expected.subcategory || currentVarietal !== (expected.varietal || '')) {
    changes.push({ current, expected, currentCategory, currentSubcategory, currentVarietal });
  }
}

fs.mkdirSync(path.resolve(process.cwd(), 'data/classification-report'), { recursive: true });
const csvRows = [[
  'Nombre del artículo', 'Categoría actual', 'Categoría correcta', 'Subcategoría actual', 'Subcategoría correcta', 'Varietal actual', 'Varietal correcto', 'Acción'
]];
for (const row of changes) {
  csvRows.push([
    row.expected.article_name, row.currentCategory, row.expected.category,
    row.currentSubcategory, row.expected.subcategory,
    row.currentVarietal, row.expected.varietal || '', APPLY ? 'CORREGIDO' : 'PENDIENTE',
  ]);
}
const reportCsv = csvRows.map((row) => row.map(csvCell).join(',')).join('\n');
fs.writeFileSync(path.resolve(process.cwd(), 'data/classification-report/vista-previa.csv'), `\uFEFF${reportCsv}`);
fs.writeFileSync(path.resolve(process.cwd(), 'data/classification-report/vista-previa.json'), JSON.stringify({
  generated_at: new Date().toISOString(), apply: APPLY, products_in_excel: excelRows.length,
  changes: changes.length, missing: missing.length, missing_products: missing,
}, null, 2));

if (!APPLY) {
  console.log(`Vista previa generada. Productos con cambios: ${changes.length}`);
  console.log('Informe: data/classification-report/vista-previa.csv');
  console.log('No se modificó Supabase. Para aplicar: npm run supabase:classification:apply');
  process.exit(0);
}

const categoryRows = [...new Map(excelRows.map((row) => [slugify(row.category), { name: row.category, slug: slugify(row.category), original_name: row.category }])).values()];
await upsertRows('categories', categoryRows, 'slug');
const categories = await fetchAll('categories', 'id,name,slug');
const categoryIds = new Map(categories.map((row) => [row.slug, row.id]));

const varietalRows = [...new Map(excelRows.filter((row) => row.varietal).map((row) => [slugify(row.varietal), { name: row.varietal, slug: slugify(row.varietal) }])).values()];
if (varietalRows.length) await upsertRows('varietals', varietalRows, 'slug');
const varietals = await fetchAll('varietals', 'id,name,slug');
const varietalIds = new Map(varietals.map((row) => [row.slug, row.id]));

const subcategoryRows = [];
for (const row of excelRows) {
  const categoryId = categoryIds.get(slugify(row.category));
  if (!categoryId) continue;
  subcategoryRows.push({ category_id: categoryId, name: row.subcategory, slug: slugify(row.subcategory), original_name: row.source_subcategory || row.subcategory });
}
const uniqueSubs = [...new Map(subcategoryRows.map((row) => [`${row.category_id}|${row.slug}`, row])).values()];
await upsertRows('subcategories', uniqueSubs, 'category_id,slug');
const subcategories = await fetchAll('subcategories', 'id,category_id,slug');
const subcategoryIds = new Map(subcategories.map((row) => [`${row.category_id}|${row.slug}`, row.id]));

const updates = changes.map(({ current, expected }) => {
  const categoryId = categoryIds.get(slugify(expected.category));
  return {
    id: current.id,
    category_id: categoryId,
    subcategory_id: subcategoryIds.get(`${categoryId}|${slugify(expected.subcategory)}`) || null,
    varietal_id: expected.varietal ? varietalIds.get(slugify(expected.varietal)) || null : null,
  };
});
let updatedCount = 0;
for (const batch of chunks(updates, 25)) {
  const results = await Promise.all(batch.map(async (row) => {
    const { id, ...classification } = row;
    const { error } = await supabase
      .from('products')
      .update(classification)
      .eq('id', id);
    if (error) throw new Error(`products ${id}: ${error.message}`);
    return id;
  }));
  updatedCount += results.length;
  console.log(`Productos actualizados: ${updatedCount}/${updates.length}`);
}

console.log(`Clasificación corregida en Supabase: ${updatedCount} productos.`);
console.log('No se modificaron nombres, precios, stock, imágenes ni estados.');
