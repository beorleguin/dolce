import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import {
  PDFDocument,
  PDFImage,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const FOOTER_HEIGHT = 38;
const CONTENT_TOP = PAGE_HEIGHT - 76;
const CONTENT_BOTTOM = FOOTER_HEIGHT + 24;
const COLUMN_GAP = 18;
const COLUMN_WIDTH = (PAGE_WIDTH - MARGIN * 2 - COLUMN_GAP) / 2;
const ROW_HEIGHT = 53;

const COLORS = {
  ink: rgb(0.08, 0.09, 0.07),
  paper: rgb(0.97, 0.97, 0.95),
  gray: rgb(0.22, 0.21, 0.2),
  muted: rgb(0.42, 0.44, 0.4),
  line: rgb(0.83, 0.84, 0.8),
  lime: rgb(0.78, 0.83, 0.06),
  white: rgb(1, 1, 1),
};

const CATEGORY_ORDER = [
  'Promociones',
  'Vinos',
  'Espumantes',
  'Destilados',
  'Delicatessen',
  'Cristalería',
  'Aceites',
  'Accesorios',
  'Otros',
];

type RawProduct = {
  id: string;
  name: string;
  article_name: string | null;
  description: string | null;
  price: number | string;
  units_per_box: number | string;
  is_mix: boolean | null;
  categories: { name?: string } | { name?: string }[] | null;
  wineries: { name?: string } | { name?: string }[] | null;
  varietals: { name?: string } | { name?: string }[] | null;
};

type CatalogProduct = {
  id: string;
  name: string;
  detail: string;
  description: string;
  category: string;
  winery: string;
  varietal: string;
  price: number;
  unitsPerBox: number;
  isMix: boolean;
};

function relatedName(value: RawProduct['categories']) {
  if (Array.isArray(value)) return String(value[0]?.name || '').trim();
  return String(value?.name || '').trim();
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function publicCategory(rawCategory: string, productName: string) {
  const value = normalize(`${rawCategory} ${productName}`);

  if (value.includes('promocion') || value.includes('promoción') || value.includes(' mix ') || value.startsWith('mix ')) return 'Promociones';
  if (value.includes('espumante')) return 'Espumantes';
  if (value.includes('vino')) return 'Vinos';
  if (
    ['destilado', 'whisky', 'whiskey', 'gin', 'vodka', 'ron', 'licor', 'aperitivo', 'cognac', 'brandy', 'tequila'].some(
      (term) => value.includes(term),
    )
  ) return 'Destilados';
  if (value.includes('aceite')) return 'Aceites';
  if (['cristaleria', 'copa', 'vaso', 'decantador'].some((term) => value.includes(term))) return 'Cristalería';
  if (['accesorio', 'sacacorcho', 'cuchara', 'tenedor', 'destapador'].some((term) => value.includes(term))) return 'Accesorios';
  if (
    ['delicatessen', 'chocolate', 'queso', 'conserva', 'snack', 'aceituna', 'mermelada', 'pate', 'paté'].some(
      (term) => value.includes(term),
    )
  ) return 'Delicatessen';

  return 'Otros';
}

function cleanWinery(value: string) {
  return value.replace(/\s+(s\.?\s*a\.?|s\.?\s*r\.?\s*l\.?)$/i, '').trim();
}

function formatPrice(value: number) {
  return `$ ${Math.round(value).toLocaleString('es-AR')}`;
}

function dateParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    date: new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Argentina/Mendoza',
    }).format(now),
  };
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function fitText(text: string, font: PDFFont, maxWidth: number, initialSize: number, minimumSize = 6.5) {
  let size = initialSize;
  while (size > minimumSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.25;
  return size;
}

async function loadLogo(pdf: PDFDocument) {
  try {
    const logoBytes = await readFile(path.join(process.cwd(), 'public', 'assets', 'logo_dolce_vino.png'));
    return await pdf.embedPng(logoBytes);
  } catch {
    return null;
  }
}

function drawLogo(page: PDFPage, logo: PDFImage | null, x: number, y: number, maxWidth: number, maxHeight: number) {
  if (!logo) return;
  const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height);
  page.drawImage(logo, {
    x,
    y,
    width: logo.width * scale,
    height: logo.height * scale,
  });
}

function drawFooter(
  page: PDFPage,
  pageNumber: number,
  logo: PDFImage | null,
  regular: PDFFont,
  bold: PDFFont,
  updatedDate: string,
) {
  page.drawLine({
    start: { x: MARGIN, y: 43 },
    end: { x: PAGE_WIDTH - MARGIN, y: 43 },
    thickness: 0.6,
    color: COLORS.line,
  });

  drawLogo(page, logo, MARGIN, 16, 24, 24);
  page.drawText('www.dolcevino.com.ar', {
    x: MARGIN + 34,
    y: 29,
    size: 7.5,
    font: bold,
    color: COLORS.ink,
  });
  page.drawText('Carril Urquiza 368, Local 1-2 · Villa Nueva, Mendoza', {
    x: MARGIN + 34,
    y: 18,
    size: 6.6,
    font: regular,
    color: COLORS.muted,
  });
  page.drawText(`Precios actualizados al ${updatedDate}`, {
    x: PAGE_WIDTH - MARGIN - 176,
    y: 25,
    size: 7,
    font: regular,
    color: COLORS.muted,
  });
  page.drawText(String(pageNumber), {
    x: PAGE_WIDTH - MARGIN - 8,
    y: 25,
    size: 7.5,
    font: bold,
    color: COLORS.ink,
  });
}

function addMainCover(
  pdf: PDFDocument,
  logo: PDFImage | null,
  regular: PDFFont,
  bold: PDFFont,
  year: number,
  updatedDate: string,
) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLORS.gray });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 12, width: PAGE_WIDTH, height: 12, color: COLORS.lime });

  const heading = `CATÁLOGO DE PRODUCTOS ${year}`;
  const headingSize = fitText(heading, bold, PAGE_WIDTH - MARGIN * 2, 20, 15);
  const headingWidth = bold.widthOfTextAtSize(heading, headingSize);
  page.drawText(heading, {
    x: (PAGE_WIDTH - headingWidth) / 2,
    y: 690,
    size: headingSize,
    font: bold,
    color: COLORS.white,
  });

  if (logo) {
    const scale = Math.min(210 / logo.width, 210 / logo.height);
    page.drawImage(logo, {
      x: (PAGE_WIDTH - logo.width * scale) / 2,
      y: 350,
      width: logo.width * scale,
      height: logo.height * scale,
    });
  }

  const dateText = `PRECIOS ACTUALIZADOS AL ${updatedDate}`;
  const dateWidth = bold.widthOfTextAtSize(dateText, 11);
  page.drawText(dateText, {
    x: (PAGE_WIDTH - dateWidth) / 2,
    y: 285,
    size: 11,
    font: bold,
    color: COLORS.lime,
  });

  const note = 'Valores vigentes a la fecha indicada y sujetos a modificación.';
  const noteWidth = regular.widthOfTextAtSize(note, 8.5);
  page.drawText(note, {
    x: (PAGE_WIDTH - noteWidth) / 2,
    y: 262,
    size: 8.5,
    font: regular,
    color: rgb(0.78, 0.78, 0.75),
  });

  const website = 'www.dolcevino.com.ar';
  const websiteWidth = bold.widthOfTextAtSize(website, 10);
  page.drawText(website, {
    x: (PAGE_WIDTH - websiteWidth) / 2,
    y: 95,
    size: 10,
    font: bold,
    color: COLORS.white,
  });

  const location = 'Carril Urquiza 368, Local 1-2 · Villa Nueva, Mendoza';
  const locationWidth = regular.widthOfTextAtSize(location, 8.5);
  page.drawText(location, {
    x: (PAGE_WIDTH - locationWidth) / 2,
    y: 75,
    size: 8.5,
    font: regular,
    color: rgb(0.76, 0.77, 0.72),
  });
}

function addCategoryCover(
  pdf: PDFDocument,
  category: string,
  logo: PDFImage | null,
  regular: PDFFont,
  bold: PDFFont,
  updatedDate: string,
) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLORS.ink });
  page.drawRectangle({ x: 0, y: 0, width: 14, height: PAGE_HEIGHT, color: COLORS.lime });
  page.drawText('DOLCE VINO', {
    x: 60,
    y: 712,
    size: 9,
    font: bold,
    color: COLORS.lime,
  });

  const title = category.toLocaleUpperCase('es-AR');
  const titleSize = fitText(title, bold, PAGE_WIDTH - 120, 45, 28);
  page.drawText(title, {
    x: 60,
    y: 555,
    size: titleSize,
    font: bold,
    color: COLORS.white,
  });

  page.drawLine({
    start: { x: 60, y: 525 },
    end: { x: 245, y: 525 },
    thickness: 3,
    color: COLORS.lime,
  });

  const description =
    category === 'Promociones'
      ? 'Mixes y promociones preparados especialmente por Dolce Vino.'
      : category === 'Vinos'
      ? 'Etiquetas organizadas por bodega y ordenadas alfabéticamente.'
      : category === 'Espumantes'
        ? 'Una selección para brindar, celebrar y compartir.'
        : `Selección de ${category.toLocaleLowerCase('es-AR')} disponible en Dolce Vino.`;

  page.drawText(description, {
    x: 60,
    y: 485,
    size: 11,
    font: regular,
    color: rgb(0.72, 0.74, 0.69),
  });

  if (logo) {
    const scale = Math.min(120 / logo.width, 120 / logo.height);
    page.drawImage(logo, {
      x: PAGE_WIDTH - 60 - logo.width * scale,
      y: 78,
      width: logo.width * scale,
      height: logo.height * scale,
      opacity: 0.8,
    });
  }

  drawFooter(page, pdf.getPageCount(), logo, regular, bold, updatedDate);
}

function addProductsPage(
  pdf: PDFDocument,
  category: string,
  logo: PDFImage | null,
  regular: PDFFont,
  bold: PDFFont,
  updatedDate: string,
) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLORS.paper });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 9, width: PAGE_WIDTH, height: 9, color: COLORS.lime });
  page.drawText(category.toLocaleUpperCase('es-AR'), {
    x: MARGIN,
    y: PAGE_HEIGHT - 48,
    size: 14,
    font: bold,
    color: COLORS.ink,
  });
  page.drawText('CATÁLOGO DOLCE VINO', {
    x: PAGE_WIDTH - MARGIN - 111,
    y: PAGE_HEIGHT - 44,
    size: 7.5,
    font: bold,
    color: COLORS.muted,
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - 60 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 60 },
    thickness: 0.8,
    color: COLORS.line,
  });
  drawFooter(page, pdf.getPageCount(), logo, regular, bold, updatedDate);
  return page;
}

function drawGroupHeading(page: PDFPage, text: string, x: number, y: number, bold: PDFFont) {
  page.drawRectangle({ x, y: y - 4, width: COLUMN_WIDTH, height: 22, color: rgb(0.91, 0.92, 0.88) });
  page.drawRectangle({ x, y: y - 4, width: 4, height: 22, color: COLORS.lime });
  page.drawText(truncate(text.toLocaleUpperCase('es-AR'), 38), {
    x: x + 10,
    y: y + 3,
    size: 8.2,
    font: bold,
    color: COLORS.ink,
  });
}

function isSingleUnitCatalogProduct(product: CatalogProduct) {
  const value = normalize(`${product.category} ${product.name} ${product.detail}`);
  return product.isMix || product.unitsPerBox === 1 || [
    'destilado',
    'whisky',
    'whiskey',
    'gin',
    'ginebra',
    'ron',
    'vodka',
    'licor',
    'aperitivo',
    'vermut',
    'vermouth',
    'tequila',
    'cognac',
    'brandy',
    'pisco',
    'estuche',
  ].some((term) => value.includes(term));
}

function drawProduct(
  page: PDFPage,
  product: CatalogProduct,
  x: number,
  y: number,
  regular: PDFFont,
  bold: PDFFont,
) {
  const productName = truncate(product.detail || product.name, 54);
  const titleSize = fitText(productName, bold, COLUMN_WIDTH - 16, 8.4, 6.8);
  page.drawText(productName, {
    x,
    y,
    size: titleSize,
    font: bold,
    color: COLORS.ink,
  });

  const metadata = product.isMix
    ? product.description
    : [product.varietal, product.name !== product.detail ? product.name : '']
        .filter(Boolean)
        .join(' · ');
  page.drawText(truncate(metadata, 62), {
    x,
    y: y - 13,
    size: 6.8,
    font: regular,
    color: COLORS.muted,
  });

  const isSingleUnit = isSingleUnitCatalogProduct(product);

  if (isSingleUnit) {
    const estucheLabel = product.isMix ? 'Precio promocional del mix' : 'Precio por unidad';
    page.drawText(estucheLabel, {
      x,
      y: y - 28,
      size: 6.6,
      font: regular,
      color: COLORS.muted,
    });

    page.drawText(formatPrice(product.price), {
      x,
      y: y - 40,
      size: 8.2,
      font: bold,
      color: COLORS.ink,
    });

    const unitsLabel = product.isMix ? 'Mix x1' : 'Unidad x1';
    const unitWidth = regular.widthOfTextAtSize(unitsLabel, 6.8);
    page.drawText(unitsLabel, {
      x: x + COLUMN_WIDTH - unitWidth,
      y: y - 39,
      size: 6.8,
      font: regular,
      color: COLORS.muted,
    });
  } else {
    const bottlePrice = product.price;
    const boxPrice = product.price * product.unitsPerBox;

    page.drawText('Valor por botella', {
      x,
      y: y - 27,
      size: 6.4,
      font: regular,
      color: COLORS.muted,
    });

    page.drawText(formatPrice(bottlePrice), {
      x,
      y: y - 39,
      size: 8,
      font: bold,
      color: COLORS.ink,
    });

    const boxLabel = `Caja cerrada x${product.unitsPerBox}`;
    const boxPriceText = formatPrice(boxPrice);
    const boxLabelWidth = regular.widthOfTextAtSize(boxLabel, 6.4);
    const boxPriceWidth = bold.widthOfTextAtSize(boxPriceText, 8);

    page.drawText(boxLabel, {
      x: x + COLUMN_WIDTH - boxLabelWidth,
      y: y - 27,
      size: 6.4,
      font: regular,
      color: COLORS.muted,
    });

    page.drawText(boxPriceText, {
      x: x + COLUMN_WIDTH - boxPriceWidth,
      y: y - 39,
      size: 8,
      font: bold,
      color: COLORS.ink,
    });
  }

  page.drawLine({
    start: { x, y: y - 50 },
    end: { x: x + COLUMN_WIDTH, y: y - 50 },
    thickness: 0.45,
    color: COLORS.line,
  });
}

function addCategoryProducts(
  pdf: PDFDocument,
  category: string,
  products: CatalogProduct[],
  logo: PDFImage | null,
  regular: PDFFont,
  bold: PDFFont,
  updatedDate: string,
) {
  const grouped = new Map<string, CatalogProduct[]>();
  for (const product of products) {
    const group = product.winery || (category === 'Vinos' || category === 'Espumantes' ? 'Otras etiquetas' : category);
    const values = grouped.get(group) || [];
    values.push(product);
    grouped.set(group, values);
  }

  const groups = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b, 'es'));
  let page = addProductsPage(pdf, category, logo, regular, bold, updatedDate);
  let column = 0;
  let y = CONTENT_TOP;

  const nextColumnOrPage = () => {
    if (column === 0) {
      column = 1;
      y = CONTENT_TOP;
    } else {
      page = addProductsPage(pdf, category, logo, regular, bold, updatedDate);
      column = 0;
      y = CONTENT_TOP;
    }
  };

  for (const [groupName, groupProducts] of groups) {
    if (y - 28 < CONTENT_BOTTOM) nextColumnOrPage();
    const x = MARGIN + column * (COLUMN_WIDTH + COLUMN_GAP);
    drawGroupHeading(page, groupName, x, y, bold);
    y -= 32;

    for (const product of groupProducts.sort((a, b) => (a.detail || a.name).localeCompare(b.detail || b.name, 'es'))) {
      if (y - ROW_HEIGHT < CONTENT_BOTTOM) {
        nextColumnOrPage();
        const newX = MARGIN + column * (COLUMN_WIDTH + COLUMN_GAP);
        drawGroupHeading(page, `${groupName} (continuación)`, newX, y, bold);
        y -= 32;
      }

      const productX = MARGIN + column * (COLUMN_WIDTH + COLUMN_GAP);
      drawProduct(page, product, productX, y, regular, bold);
      y -= ROW_HEIGHT;
    }

    y -= 8;
  }
}

export async function POST() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('products')
      .select(
        'id,name,article_name,description,price,units_per_box,is_mix,categories(name),wineries(name),varietals(name)',
      )
      .eq('enabled', true)
      .order('name');

    if (error) throw error;

    const mixIds = ((data || []) as unknown as RawProduct[])
      .filter((product) => Boolean(product.is_mix))
      .map((product) => product.id);

    const mixDescriptions = new Map<string, string>();
    if (mixIds.length) {
      const { data: mixItems, error: mixItemsError } = await supabase
        .from('product_mix_items')
        .select('mix_product_id,quantity,products:product_id(name,article_name)')
        .in('mix_product_id', mixIds)
        .order('sort_order', { ascending: true });

      if (mixItemsError) throw mixItemsError;

      for (const item of mixItems || []) {
        const productRelation = Array.isArray((item as any).products)
          ? (item as any).products[0]
          : (item as any).products;
        const productName = String(productRelation?.article_name || productRelation?.name || 'Producto').trim();
        const quantity = Math.max(1, Number((item as any).quantity) || 1);
        const current = mixDescriptions.get(String((item as any).mix_product_id)) || '';
        const nextItem = `${quantity} x ${productName}`;
        mixDescriptions.set(String((item as any).mix_product_id), current ? `${current} · ${nextItem}` : nextItem);
      }
    }

    const products: CatalogProduct[] = ((data || []) as unknown as RawProduct[])
      .map((product) => {
        const detail = String(product.article_name || product.name || 'Producto').trim();
        const rawCategory = relatedName(product.categories);
        return {
          id: String(product.id),
          name: String(product.name || detail).trim(),
          detail,
          description: product.is_mix
            ? [String(product.description || '').trim(), mixDescriptions.get(String(product.id)) || ''].filter(Boolean).join(' — ')
            : String(product.description || '').trim(),
          category: product.is_mix ? 'Promociones' : publicCategory(rawCategory, detail),
          winery: cleanWinery(relatedName(product.wineries)),
          varietal: relatedName(product.varietals),
          price: Number(product.price) || 0,
          unitsPerBox: product.is_mix || publicCategory(rawCategory, detail) === 'Destilados'
            ? 1
            : Math.max(1, Number(product.units_per_box) || 6),
          isMix: Boolean(product.is_mix),
        };
      })
      .sort((a, b) => {
        const categoryDifference = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
        if (categoryDifference) return categoryDifference;
        const wineryDifference = a.winery.localeCompare(b.winery, 'es');
        if (wineryDifference) return wineryDifference;
        return (a.detail || a.name).localeCompare(b.detail || b.name, 'es');
      });

    const pdf = await PDFDocument.create();
    pdf.setTitle('Dolce Vino - Catálogo de productos');
    pdf.setAuthor('Dolce Vino');
    pdf.setSubject('Catálogo actualizado de productos');
    pdf.setCreator('Dolce Vino CRM');

    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const logo = await loadLogo(pdf);
    const { year, date } = dateParts();

    addMainCover(pdf, logo, regular, bold, year, date);

    for (const category of CATEGORY_ORDER) {
      const categoryProducts = products.filter((product) => product.category === category);
      if (!categoryProducts.length) continue;

      addCategoryCover(pdf, category, logo, regular, bold, date);
      addCategoryProducts(pdf, category, categoryProducts, logo, regular, bold, date);
    }

    const bytes = await pdf.save({ useObjectStreams: true });
    const storagePath = 'catalogos/catalogo-automatico.pdf';
    const { error: uploadError } = await supabase.storage
      .from('site')
      .upload(storagePath, Buffer.from(bytes), {
        contentType: 'application/pdf',
        upsert: true,
        cacheControl: '0',
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('site').getPublicUrl(storagePath);
    const url = `${urlData.publicUrl}?v=${Date.now()}`;

    await supabase.from('site_settings').upsert({
      key: 'generated_catalog_pdf',
      value: {
        url,
        generated_at: new Date().toISOString(),
        products: products.length,
        pages: pdf.getPageCount(),
        design_version: 3,
        address: 'Carril Urquiza 368, Local 1-2, M5521 Villa Nueva, Mendoza',
      },
    });

    return NextResponse.json(
      {
        url,
        products: products.length,
        pages: pdf.getPageCount(),
        generatedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
  } catch (error: any) {
    console.error('Catalog PDF generation failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Error generando PDF' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
  }
}
