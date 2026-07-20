import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes('--apply');

if (!url || !key) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY en .env.local');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const normalize = (value = '') => String(value)
  .toLocaleLowerCase('es-AR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function inferUnitsPerBox(...values) {
  const text = normalize(values.filter(Boolean).join(' '));
  if (/\bestuche\b/.test(text)) return 1;
  const patterns = [
    /\b(?:caja|estuche|pack|mix|set)\s*(?:de\s*)?x?\s*(\d{1,2})\b/,
    /\b(\d{1,2})\s*x\s*\d{3,4}\s*(?:ml|cc)\b/,
    /\bx\s*(\d{1,2})\b/,
    /\b(\d{1,2})\s*(?:botellas|unidades)\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const units = match ? Number(match[1]) : 0;
    if (units >= 1 && units <= 24) return units;
  }

  return 6;
}

async function getAllProducts() {
  const rows = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,article_name,units_per_box')
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

const products = await getAllProducts();
const changes = products
  .map((product) => ({
    ...product,
    expected: inferUnitsPerBox(product.article_name, product.name),
  }))
  .filter((product) => Number(product.units_per_box) !== product.expected);

console.log(`Productos revisados: ${products.length}`);
console.log(`Productos a corregir: ${changes.length}`);

for (const product of changes.slice(0, 30)) {
  console.log(`- ${product.article_name || product.name}: x${product.units_per_box ?? '-'} → x${product.expected}`);
}
if (changes.length > 30) console.log(`... y ${changes.length - 30} productos más.`);

if (!apply) {
  console.log('Vista previa solamente. Para aplicar: npm run supabase:units:apply');
  process.exit(0);
}

let updated = 0;
for (const product of changes) {
  const { error } = await supabase
    .from('products')
    .update({ units_per_box: product.expected })
    .eq('id', product.id);

  if (error) throw new Error(`${product.article_name || product.name}: ${error.message}`);
  updated += 1;
  if (updated % 50 === 0 || updated === changes.length) {
    console.log(`Actualizados: ${updated}/${changes.length}`);
  }
}

console.log(`Unidades por caja corregidas: ${updated}.`);
console.log('Regla aplicada: todo ESTUCHE = x1; cajas o packs con cantidad explícita = ese valor; resto = x6.');
