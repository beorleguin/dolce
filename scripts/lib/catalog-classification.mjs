export const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
export const normalized = (value) => clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const has = (text, phrase) => {
  const p = normalized(phrase);
  return (` ${text} `).includes(` ${p} `);
};
const hasAny = (text, phrases) => phrases.some((phrase) => has(text, phrase));

const varietalRules = [
  ['Cabernet Sauvignon', ['cabernet sauvignon']],
  ['Cabernet Franc', ['cabernet franc']],
  ['Sauvignon Blanc', ['sauvignon blanc']],
  ['Petit Verdot', ['petit verdot']],
  ['Pinot Noir', ['pinot noir']],
  ['Pinot Gris', ['pinot gris']],
  ['Blanc de Malbec', ['blanc de malbec', 'malbec white', 'white malbec']],
  ['Noir de Malbec', ['noir de malbec']],
  ['Malbec Rosé', ['malbec rose', 'rose de malbec', 'rosado de malbec']],
  ['Malbec Fortificado', ['malbec fortificado']],
  ['Malbec Orgánico', ['malbec organico', 'organico malbec']],
  ['Torrontés', ['torrontes']],
  ['Chardonnay', ['chardonnay']],
  ['Malbec', ['malbec']],
  ['Bonarda', ['bonarda']],
  ['Merlot', ['merlot']],
  ['Syrah', ['syrah']],
  ['Tempranillo', ['tempranillo']],
  ['Carmenere', ['carmenere']],
  ['Sangiovese', ['sangiovese']],
  ['Ancellotta', ['ancellotta']],
  ['Semillón', ['semillon']],
  ['Riesling', ['riesling']],
  ['Viognier', ['viognier']],
  ['Gewürztraminer', ['gewurztraminer', 'gewurstraminer']],
  ['Albariño', ['albarino']],
  ['Chenin', ['chenin']],
  ['Criolla', ['criolla']],
  ['Tannat', ['tannat']],
  ['Garnacha', ['garnacha']],
  ['Moscatel', ['moscatel', 'moscato']],
  ['Naranjo', ['naranjo']],
  ['Rosé', ['rose', 'rosado']],
];

const sourceAliases = new Map([
  ['cabernet sauvignon', 'Cabernet Sauvignon'],
  ['cabernet franc', 'Cabernet Franc'],
  ['sauvignon blanc', 'Sauvignon Blanc'],
  ['petit verdot', 'Petit Verdot'],
  ['pinot noir', 'Pinot Noir'],
  ['pinot gris', 'Pinot Gris'],
  ['malbec', 'Malbec'],
  ['chardonnay', 'Chardonnay'],
  ['torrontes', 'Torrontés'],
  ['bonarda', 'Bonarda'],
  ['merlot', 'Merlot'],
  ['syrah', 'Syrah'],
  ['tempranillo', 'Tempranillo'],
  ['carmenere', 'Carmenere'],
  ['sangiovese', 'Sangiovese'],
  ['ancellotta', 'Ancellotta'],
  ['semillon', 'Semillón'],
  ['riesling', 'Riesling'],
  ['viognier', 'Viognier'],
  ['gewurztraminer', 'Gewürztraminer'],
  ['albarino', 'Albariño'],
  ['chenin', 'Chenin'],
  ['criolla', 'Criolla'],
  ['tannat', 'Tannat'],
  ['red blend', 'Red Blend'],
  ['white blend', 'White Blend'],
  ['blend', 'Blend'],
]);

export function inferSparklingSubtype(articleName, sourceSubcategory = '') {
  const text = normalized(`${articleName} ${sourceSubcategory}`);
  if (hasAny(text, ['brut nature rose', 'brut rose nature'])) return 'Brut Nature Rosé';
  if (has(text, 'brut nature')) return 'Brut Nature';
  if (hasAny(text, ['extra brut rose', 'extra brut rosado'])) return 'Extra Brut Rosé';
  if (has(text, 'extra brut')) return 'Extra Brut';
  if (hasAny(text, ['brut rose', 'brut rosado'])) return 'Brut Rosé';
  if (has(text, 'demi sec')) return 'Demi Sec';
  if (hasAny(text, ['dulce natural', 'extra dulce'])) return 'Dulce Natural';
  if (has(text, 'nature')) return 'Nature';
  if (has(text, 'aperitif')) return 'Aperitif';
  return 'Espumante';
}

export function inferWineVarietal(articleName, sourceSubcategory = '') {
  const text = normalized(articleName);

  // Los nombres que expresan un corte deben ganar frente a las cepas enumeradas.
  if (hasAny(text, ['white blend', 'blend de blancas', 'corte de blancas', 'cruza de blancas'])) return 'White Blend';
  if (hasAny(text, ['red blend', 'blend de tintas', 'corte de tintas', 'corte argentino', 'gran corte', 'corte red', 'co fermentado', 'cofermentado', 'cuatro cepas', 'ensamble'])) return 'Red Blend';
  if (has(text, 'blend')) return 'Blend';

  let base = null;
  for (const [label, phrases] of varietalRules) {
    if (phrases.some((phrase) => has(text, phrase))) {
      base = label;
      break;
    }
  }

  // Para vinos tranquilos dulces conservamos la cepa + estilo cuando ambas aparecen.
  if (base && hasAny(text, ['dulce natural', 'sweet'])) return `${base} Dulce Natural`;
  if (base && hasAny(text, ['cosecha tardia', 'late harvest', 'tardio'])) return `${base} Cosecha Tardía`;
  if (base) return base;

  const source = normalized(sourceSubcategory);
  return sourceAliases.get(source) || null;
}

export function classifyProduct(articleName, sourceCategory = '', sourceSubcategory = '') {
  const name = normalized(articleName);
  const source = normalized(`${sourceCategory} ${sourceSubcategory}`);
  const combined = `${name} ${source}`.trim();

  const isSparkling = hasAny(combined, [
    'espumante', 'espumantes', 'champenoise', 'metodo tradicional', 'pet nat',
    'brut nature', 'extra brut', 'brut rose', 'demi sec', 'cuvee brut',
  ]);
  if (isSparkling) {
    const subtype = inferSparklingSubtype(articleName, sourceSubcategory);
    return { category: 'Espumantes', subcategory: subtype, varietal: subtype };
  }

  if (hasAny(combined, ['whisky', 'whiskey', 'single malt', 'bourbon']))
    return { category: 'Whiskys', subcategory: clean(sourceSubcategory) || 'Whisky', varietal: null };

  if (hasAny(combined, ['gin', 'ginebra', 'vodka', 'ron', 'tequila', 'anis', 'licor', 'vermouth', 'aperitivo', 'destilado', 'cognac', 'conac', 'brandy', 'pisco', 'grappa', 'bitter', 'fernet', 'cachaca']))
    return { category: 'Destilados', subcategory: clean(sourceSubcategory) || clean(sourceCategory) || 'Otros', varietal: null };

  if (hasAny(combined, ['cristaleria', 'copa cerveza', 'copa vino', 'vaso', 'copon', 'decanter']))
    return { category: 'Cristalería', subcategory: clean(sourceSubcategory) || 'Cristalería', varietal: null };
  if (has(combined, 'pimienta')) return { category: 'Pimienta', subcategory: 'Pimienta', varietal: null };
  if (hasAny(combined, ['aceite', 'aceite de oliva'])) return { category: 'Aceites', subcategory: 'Aceites', varietal: null };
  if (hasAny(combined, ['condimento', 'especia', 'sal marina'])) return { category: 'Condimentos', subcategory: 'Condimentos', varietal: null };
  if (hasAny(combined, ['sacacorchos', 'cuchara', 'tenedor', 'bolsa', 'frapera', 'tabla', 'disco metalico', 'fogonero metalico', 'accesorio']))
    return { category: 'Accesorios varios', subcategory: 'Accesorios varios', varietal: null };
  if (hasAny(combined, ['chocolate', 'conserva', 'delicatessen', 'mermelada', 'pate', 'aceto']))
    return { category: 'Delicatessen', subcategory: 'Delicatessen', varietal: null };
  if (hasAny(combined, ['gaseosa', 'agua tonica'])) return { category: 'Gaseosas', subcategory: 'Gaseosas', varietal: null };
  if (has(combined, 'sidra')) return { category: 'Sidras', subcategory: 'Sidras', varietal: null };

  const varietal = inferWineVarietal(articleName, sourceSubcategory);
  const sourceLooksWine = hasAny(source, ['vino', 'vinos', 'malbec', 'cabernet', 'chardonnay', 'torrontes', 'blend', 'bonarda', 'merlot', 'syrah', 'tempranillo', 'pinot', 'sauvignon']);
  if (varietal || sourceLooksWine) {
    return { category: 'Vinos', subcategory: varietal || clean(sourceSubcategory) || 'Otros', varietal };
  }

  return { category: 'Otros', subcategory: clean(sourceSubcategory) || clean(sourceCategory) || 'Otros', varietal: null };
}
