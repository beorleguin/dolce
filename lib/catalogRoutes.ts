export const normalizeCatalogText = (value: string) =>
  value
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const catalogSlug = (value: string) =>
  normalizeCatalogText(value).replace(/\s+/g, '-');

export const titleFromCatalogSlug = (slug: string) =>
  decodeURIComponent(slug)
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase('es-AR') + word.slice(1))
    .join(' ');

export const cleanPublicWineryName = (value: string) =>
  value
    .replace(/\s+(s\.?\s*a\.?|s\.?\s*r\.?\s*l\.?)$/i, '')
    .trim();

export const isWineCategory = (value: string) => {
  const category = normalizeCatalogText(value);
  return category.includes('vino') && !category.includes('espumante');
};

export const isSparklingCategory = (value: string) => {
  const category = normalizeCatalogText(value);
  return category.includes('espumante');
};

export const isEstucheProduct = (...values: Array<string | undefined>) =>
  values.some((value) => /\bestuche\b/.test(normalizeCatalogText(value || '')));

export const preferredWineVarietals = [
  'Malbec',
  'Cabernet Sauvignon',
  'Cabernet Franc',
  'Bonarda',
  'Merlot',
  'Pinot Noir',
  'Syrah',
  'Tempranillo',
  'Petit Verdot',
  'Sangiovese',
  'Ancellotta',
  'Carmenere',
  'Chardonnay',
  'Sauvignon Blanc',
  'Chenin',
  'Torrontes',
  'Semillon',
  'Riesling',
  'Viognier',
  'Gewürztraminer',
  'Albariño',
  'Blanc de Malbec',
  'Blend',
  'Rosado',
  'Dulce Natural',
];

export const publicWineMenuGroups = [
  { label: 'Malbec', slug: 'malbec' },
  { label: 'Cabernet Sauvignon', slug: 'cabernet-sauvignon' },
  { label: 'Cabernet Franc', slug: 'cabernet-franc' },
  { label: 'Blends', slug: 'blends' },
  { label: 'Bonarda', slug: 'bonarda' },
  { label: 'Merlot', slug: 'merlot' },
  { label: 'Pinot Noir', slug: 'pinot-noir' },
  { label: 'Syrah', slug: 'syrah' },
  { label: 'Tempranillo', slug: 'tempranillo' },
  { label: 'Petit Verdot', slug: 'petit-verdot' },
  { label: 'Sangiovese', slug: 'sangiovese' },
  { label: 'Ancellotta', slug: 'ancellotta' },
  { label: 'Carmenere', slug: 'carmenere' },
  { label: 'Chardonnay', slug: 'chardonnay' },
  { label: 'Sauvignon Blanc', slug: 'sauvignon-blanc' },
  { label: 'Chenin', slug: 'chenin' },
  { label: 'Torrontés', slug: 'torrontes' },
  { label: 'Semillón', slug: 'semillon' },
  { label: 'Riesling', slug: 'riesling' },
  { label: 'Viognier', slug: 'viognier' },
  { label: 'Gewürztraminer', slug: 'gewurztraminer' },
  { label: 'Albariño', slug: 'albarino' },
  { label: 'Rosados', slug: 'rosados' },
  { label: 'Dulces', slug: 'dulces' },
] as const;

export const preferredSparklingStyles = [
  'Nature',
  'Brut Nature',
  'Extra Brut',
  'Brut',
  'Brut Rosé',
  'Extra Brut Rosé',
  'Demi Sec',
  'Dulce Natural',
];

export function sortCatalogLabels(values: string[], preferred: string[]) {
  const preferredIndex = new Map(
    preferred.map((value, index) => [catalogSlug(value), index]),
  );

  return [...values].sort((a, b) => {
    const aIndex = preferredIndex.get(catalogSlug(a));
    const bIndex = preferredIndex.get(catalogSlug(b));

    if (aIndex !== undefined || bIndex !== undefined) {
      if (aIndex === undefined) return 1;
      if (bIndex === undefined) return -1;
      return aIndex - bIndex;
    }

    return a.localeCompare(b, 'es');
  });
}

export function matchesCatalogSlug(value: string, slug: string) {
  const normalized = normalizeCatalogText(value);
  const requested = normalizeCatalogText(slug.replace(/-/g, ' '));

  const isBlend = ['blend', 'corte', 'assemblage', 'assamblage', 'ensamble'].some(
    (term) => normalized.includes(term),
  );

  if (slug === 'cabernet-sauvignon') {
    return normalized.includes('cabernet sauvignon');
  }

  if (slug === 'cabernet-franc') {
    return normalized.includes('cabernet franc');
  }

  if (slug === 'malbec') {
    return normalized.includes('malbec') && !isBlend;
  }

  if (slug === 'blend' || slug === 'blends') {
    return isBlend;
  }

  if (slug === 'rosado' || slug === 'rosados' || slug === 'rose') {
    return (
      normalized.includes('rosado') ||
      normalized.includes('rose') ||
      normalized.includes('rosé')
    );
  }

  if (slug === 'dulce-natural' || slug === 'dulces') {
    // Los Malbec dulces siguen agrupados dentro de Malbec.
    if (normalized.includes('malbec')) return false;

    return (
      normalized.includes('dulce') ||
      normalized.includes('cosecha tardia') ||
      normalized.includes('late harvest')
    );
  }

  return (
    catalogSlug(value) === slug ||
    normalized === requested ||
    normalized.includes(requested)
  );
}
