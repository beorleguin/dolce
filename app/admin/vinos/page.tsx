'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  Check,
  ChevronDown,
  Download,
  Image as ImageIcon,
  ImagePlus,
  Eye,
  EyeOff,
  Package,
  Percent,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  ListChecks,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { createClient } from '@/lib/supabase/client';
import styles from './wines-admin.module.css';

type RelationName = { name: string } | null;

type Product = {
  id: string;
  name: string;
  article_name: string | null;
  description: string | null;
  sku: string | null;
  price: number;
  units_per_box: number;
  enabled: boolean;
  featured: boolean;
  image_url: string | null;
  image_path: string | null;
  image_pending: boolean;
  category_id: string | null;
  brand_id: string | null;
  winery_id: string | null;
  varietal_id: string | null;
  categories?: RelationName;
  brands?: RelationName;
  wineries?: RelationName;
  varietals?: RelationName;
};

type ProductDraft = Omit<Product, 'categories' | 'brands' | 'wineries' | 'varietals' | 'price'> & { price: string };
type Option = { id: string; name: string };


type SelectOption = { value: string; label: string };

type CompactSelectProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
};

function CompactSelect({ value, options, onChange, ariaLabel }: CompactSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  return (
    <div className={styles.compactSelect} ref={rootRef}>
      <button
        type="button"
        className={styles.compactSelectButton}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label || 'Seleccionar'}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className={styles.compactSelectMenu} role="listbox">
          {options.map((option) => (
            <button
              type="button"
              key={option.value || '__all__'}
              className={option.value === value ? styles.compactSelectOptionActive : ''}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;
const UNIT_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12];

const EMPTY_PRODUCT: ProductDraft = {
  id: '',
  name: '',
  article_name: '',
  description: '',
  sku: '',
  price: '',
  units_per_box: 6,
  enabled: true,
  featured: false,
  image_url: '',
  image_path: '',
  image_pending: true,
  category_id: '',
  brand_id: '',
  winery_id: '',
  varietal_id: '',
};

function normalizePackageText(value: string) {
  return value
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isSingleUnitProduct(...values: Array<string | null | undefined>) {
  const text = normalizePackageText(values.filter(Boolean).join(' '));
  return /\bestuche\b|\bdestilados?\b|\bwhisk(?:y|ies)\b|\bwhiskey\b|\bron\b|\bginebra\b|\bgin\b/.test(text);
}

function inferUnitsPerBox(...values: Array<string | null | undefined>) {
  const text = normalizePackageText(values.filter(Boolean).join(' '));
  if (isSingleUnitProduct(text)) return 1;

  const patterns = [
    /\b(?:caja|pack|mix|set)\s*(?:de\s*)?x?\s*(\d{1,2})\b/,
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

function formatPrice(value: number) {
  return `$ ${Number(value || 0).toLocaleString('es-AR', {
    minimumFractionDigits: Number(value) % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function parsePriceInput(value: string) {
  const cleaned = value.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPriceInput(value: string | number) {
  const parsed = typeof value === 'number' ? value : parsePriceInput(value);
  if (!parsed && String(value).trim() === '') return '';
  return parsed.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function WinesAdminPage() {
  const supabase = useMemo(() => createClient(), []);

  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [wineries, setWineries] = useState<Option[]>([]);
  const [varietals, setVarietals] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [wineryId, setWineryId] = useState('');
  const [varietalId, setVarietalId] = useState('');
  const [withImage, setWithImage] = useState(false);
  const [withoutImage, setWithoutImage] = useState(false);
  const [unitsFilter, setUnitsFilter] = useState('');

  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [unitsManual, setUnitsManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [draggingImage, setDraggingImage] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [pricePercentage, setPricePercentage] = useState('');
  const [priceRoundTo, setPriceRoundTo] = useState('100');

  const hasFilters = Boolean(
    query ||
      categoryId ||
      brandId ||
      wineryId ||
      varietalId ||
      withImage ||
      withoutImage ||
      unitsFilter
  );

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const currentPageIds = products.map((product) => product.id);
  const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedSet.has(id));

  const loadProducts = useCallback(async () => {
    let request = supabase
      .from('products')
      .select('*,categories(name),brands(name),wineries(name),varietals(name)', { count: 'exact' })
      .order('name')
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (query.trim()) {
      const term = query.trim().replace(/,/g, ' ');
      request = request.or(`name.ilike.%${term}%,article_name.ilike.%${term}%,sku.ilike.%${term}%`);
    }
    if (categoryId) request = request.eq('category_id', categoryId);
    if (brandId) request = request.eq('brand_id', brandId);
    if (wineryId) request = request.eq('winery_id', wineryId);
    if (varietalId) request = request.eq('varietal_id', varietalId);
    if (withImage && !withoutImage) request = request.eq('image_pending', false);
    if (withoutImage && !withImage) request = request.eq('image_pending', true);
    if (unitsFilter) request = request.eq('units_per_box', Number(unitsFilter));

    const { data, count: total, error } = await request;
    if (error) {
      alert(error.message);
      return;
    }

    setProducts((data || []) as Product[]);
    setCount(total || 0);
  }, [
    supabase,
    page,
    query,
    categoryId,
    brandId,
    wineryId,
    varietalId,
    withImage,
    withoutImage,
    unitsFilter,
  ]);

  useEffect(() => {
    Promise.all([
      supabase.from('brands').select('id,name').order('name'),
      supabase.from('wineries').select('id,name').order('name'),
      supabase.from('varietals').select('id,name').order('name'),
      supabase.from('categories').select('id,name').order('name'),
    ]).then(([brandsResult, wineriesResult, varietalsResult, categoriesResult]) => {
      setBrands(brandsResult.data || []);
      setWineries(wineriesResult.data || []);
      setVarietals(varietalsResult.data || []);
      setCategories(categoriesResult.data || []);
    });
  }, [supabase]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('editar');
    if (!id) return;

    void (async () => {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (error) alert(error.message);
      else if (data) {
        setUnitsManual(false);
        setDraft({ ...(data as Product), price: formatPriceInput(Number(data.price) || 0) });
      }
    })();
  }, [supabase]);

  function clearFilters() {
    setQuery('');
    setCategoryId('');
    setBrandId('');
    setWineryId('');
    setVarietalId('');
    setWithImage(false);
    setWithoutImage(false);
    setUnitsFilter('');
    setPage(0);
  }

  function openNewProduct() {
    setUnitsManual(false);
    setDraft({ ...EMPTY_PRODUCT });
  }

  function openEditProduct(product: Product) {
    setUnitsManual(false);
    setDraft({
      id: product.id,
      name: product.name,
      article_name: product.article_name,
      description: product.description,
      sku: product.sku,
      price: formatPriceInput(product.price),
      units_per_box: isSingleUnitProduct(
        product.categories?.name,
        product.article_name,
        product.name,
      )
        ? 1
        : Math.max(
            1,
            Number(product.units_per_box) ||
              inferUnitsPerBox(product.categories?.name, product.article_name, product.name),
          ),
      enabled: product.enabled,
      featured: product.featured,
      image_url: product.image_url,
      image_path: product.image_path,
      image_pending: product.image_pending,
      category_id: product.category_id,
      brand_id: product.brand_id,
      winery_id: product.winery_id,
      varietal_id: product.varietal_id,
    });
  }

  async function toggleProductVisibility(product: Product) {
    const nextEnabled = !product.enabled;

    setProducts((current) =>
      current.map((item) =>
        item.id === product.id ? { ...item, enabled: nextEnabled } : item,
      ),
    );

    const { error } = await supabase
      .from('products')
      .update({ enabled: nextEnabled })
      .eq('id', product.id);

    if (error) {
      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, enabled: product.enabled } : item,
        ),
      );
      alert(error.message);
    }
  }

  async function saveProduct() {
    if (!draft?.name.trim()) {
      alert('Ingresá el nombre visible del producto.');
      return;
    }

    setBusy(true);
    const payload = {
      name: draft.name.trim(),
      article_name: draft.article_name?.trim() || draft.name.trim(),
      description: draft.description?.trim() || null,
      sku: draft.sku?.trim() || null,
      price: parsePriceInput(draft.price),
      stock: 0,
      units_per_box: isSingleUnitProduct(
        categories.find((category) => category.id === draft.category_id)?.name,
        draft.article_name,
        draft.name,
      )
        ? 1
        : Math.max(
            1,
            Number(draft.units_per_box) || inferUnitsPerBox(draft.article_name, draft.name),
          ),
      enabled: Boolean(draft.enabled),
      featured: Boolean(draft.featured),
      winery_id: draft.winery_id || null,
      varietal_id: draft.varietal_id || null,
      category_id: draft.category_id || null,
      image_url: draft.image_url || null,
      image_path: draft.image_path || null,
      image_pending: !draft.image_url,
    };

    let error: { message: string } | null = null;

    if (draft.id) {
      ({ error } = await supabase.from('products').update(payload).eq('id', draft.id));
    } else {
      const slug = `${draft.name}-${draft.article_name}-${Date.now()}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      ({ error } = await supabase.from('products').insert({
        ...payload,
        slug,
        external_key: `manual-${Date.now()}`,
      }));
    }

    if (error) {
      alert(error.message);
    } else {
      await fetch('/api/catalog/generate', { method: 'POST' });
      setDraft(null);
      await loadProducts();
    }

    setBusy(false);
  }

  function validateImage(file: File) {
    if (!file.type.startsWith('image/')) throw new Error('El archivo seleccionado no es una imagen.');
    if (file.size > 8 * 1024 * 1024) throw new Error('La imagen supera el máximo permitido de 8 MB.');
  }


  async function processProductImage(file: File) {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      bitmap.close();
      throw new Error('No se pudo procesar la imagen.');
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // Calculamos el color predominante del fondo usando únicamente los bordes.
    const borderSize = Math.max(3, Math.round(Math.min(width, height) * 0.025));
    const samples: Array<[number, number, number]> = [];

    const addSample = (x: number, y: number) => {
      const index = (y * width + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      // Priorizamos fondos blancos, grises o beige claros.
      if (max >= 150 && max - min <= 55) samples.push([r, g, b]);
    };

    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < borderSize; x += 2) {
        addSample(x, y);
        addSample(width - 1 - x, y);
      }
    }
    for (let x = 0; x < width; x += 2) {
      for (let y = 0; y < borderSize; y += 2) {
        addSample(x, y);
        addSample(x, height - 1 - y);
      }
    }

    const median = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)] || 245;
    };

    const background = samples.length
      ? {
          r: median(samples.map((sample) => sample[0])),
          g: median(samples.map((sample) => sample[1])),
          b: median(samples.map((sample) => sample[2])),
        }
      : { r: 245, g: 245, b: 245 };

    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let queueStart = 0;
    let queueEnd = 0;

    const colorDistance = (index: number) => {
      const r = pixels[index] - background.r;
      const g = pixels[index + 1] - background.g;
      const b = pixels[index + 2] - background.b;
      return Math.sqrt(r * r + g * g + b * b);
    };

    const isBackgroundPixel = (pixelIndex: number) => {
      const dataIndex = pixelIndex * 4;
      const r = pixels[dataIndex];
      const g = pixels[dataIndex + 1];
      const b = pixels[dataIndex + 2];
      const brightness = (r + g + b) / 3;
      const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
      return brightness >= 142 && channelSpread <= 72 && colorDistance(dataIndex) <= 82;
    };

    const enqueue = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const pixelIndex = y * width + x;
      if (visited[pixelIndex] || !isBackgroundPixel(pixelIndex)) return;
      visited[pixelIndex] = 1;
      queue[queueEnd++] = pixelIndex;
    };

    // Solo eliminamos el fondo conectado a los bordes. Así se conservan
    // etiquetas claras y detalles blancos dentro de la botella.
    for (let x = 0; x < width; x++) {
      enqueue(x, 0);
      enqueue(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      enqueue(0, y);
      enqueue(width - 1, y);
    }

    while (queueStart < queueEnd) {
      const pixelIndex = queue[queueStart++];
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      const dataIndex = pixelIndex * 4;
      const distance = colorDistance(dataIndex);

      // Borde suavizado: el fondo cercano queda transparente, y la transición
      // conserva una pequeña suavidad para evitar contornos recortados.
      pixels[dataIndex + 3] = distance <= 42 ? 0 : Math.round(((distance - 42) / 40) * 255);

      enqueue(x - 1, y);
      enqueue(x + 1, y);
      enqueue(x, y - 1);
      enqueue(x, y + 1);
    }

    context.putImageData(imageData, 0, 0);

    // Recortamos el espacio transparente sobrante y dejamos un margen mínimo.
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] > 18) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    const margin = Math.max(12, Math.round(Math.min(width, height) * 0.035));
    const cropX = Math.max(0, minX - margin);
    const cropY = Math.max(0, minY - margin);
    const cropWidth = Math.min(width - cropX, maxX - minX + 1 + margin * 2);
    const cropHeight = Math.min(height - cropY, maxY - minY + 1 + margin * 2);

    // Reducimos la imagen antes de subirla. Para las tarjetas y el modal no
    // necesitamos conservar archivos de varios miles de píxeles.
    const MAX_OUTPUT_WIDTH = 1000;
    const MAX_OUTPUT_HEIGHT = 1400;
    const outputScale = Math.min(
      1,
      MAX_OUTPUT_WIDTH / Math.max(1, cropWidth),
      MAX_OUTPUT_HEIGHT / Math.max(1, cropHeight),
    );
    const outputWidth = Math.max(1, Math.round(cropWidth * outputScale));
    const outputHeight = Math.max(1, Math.round(cropHeight * outputScale));

    // Todas las imágenes se guardan en una caja visual idéntica. De esta forma,
    // una botella originalmente pequeña no queda más chica en las tarjetas.
    const OUTPUT_WIDTH = 700;
    const OUTPUT_HEIGHT = 900;
    const SAFE_WIDTH = 590;
    const SAFE_HEIGHT = 790;
    const normalizedScale = Math.min(
      SAFE_WIDTH / Math.max(1, cropWidth),
      SAFE_HEIGHT / Math.max(1, cropHeight),
    );
    const normalizedWidth = Math.max(1, Math.round(cropWidth * normalizedScale));
    const normalizedHeight = Math.max(1, Math.round(cropHeight * normalizedScale));
    const destinationX = Math.round((OUTPUT_WIDTH - normalizedWidth) / 2);
    const destinationY = Math.round((OUTPUT_HEIGHT - normalizedHeight) / 2);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = OUTPUT_WIDTH;
    outputCanvas.height = OUTPUT_HEIGHT;
    const outputContext = outputCanvas.getContext('2d');
    if (!outputContext) throw new Error('No se pudo generar la imagen final.');

    outputContext.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = 'high';
    outputContext.drawImage(
      canvas,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      destinationX,
      destinationY,
      normalizedWidth,
      normalizedHeight,
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      outputCanvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('No se pudo convertir la imagen.'))),
        'image/webp',
        0.84,
      );
    });

    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-');
    return new File([blob], `${baseName || 'producto'}-optimizada.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  }

  async function deleteStorageImage(path?: string | null) {
    if (!path) return;
    const { error } = await supabase.storage.from('products').remove([path]);
    if (error) throw error;
  }

  async function uploadImage(file: File) {
    if (!draft) return;

    setBusy(true);
    try {
      validateImage(file);
      const processedFile = await processProductImage(file);
      const previousPath = draft.image_path || null;
      const path = `manual/${draft.id || 'nuevo'}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(path, processedFile, {
          upsert: false,
          contentType: 'image/webp',
          cacheControl: '31536000',
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('products').getPublicUrl(path);
      const nextDraft = {
        ...draft,
        image_url: data.publicUrl,
        image_path: path,
        image_pending: false,
      };

      if (draft.id) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ image_url: data.publicUrl, image_path: path, image_pending: false })
          .eq('id', draft.id);

        if (updateError) {
          await deleteStorageImage(path);
          throw updateError;
        }

        if (previousPath && previousPath !== path) {
          try {
            await deleteStorageImage(previousPath);
          } catch {
            // La imagen nueva ya quedó vinculada; no interrumpimos por una limpieza fallida.
          }
        }

        setProducts((current) =>
          current.map((product) =>
            product.id === draft.id
              ? { ...product, image_url: data.publicUrl, image_path: path, image_pending: false }
              : product,
          ),
        );
      } else if (previousPath && previousPath !== path) {
        try {
          await deleteStorageImage(previousPath);
        } catch {
          // No bloqueamos la carga nueva.
        }
      }

      setDraft(nextDraft);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo subir la imagen.');
    } finally {
      setBusy(false);
      setDraggingImage(false);
    }
  }

  async function removeProductImage() {
    if (!draft?.image_url && !draft?.image_path) return;
    if (!confirm('¿Eliminar la imagen de este producto?')) return;

    setBusy(true);
    try {
      const previousPath = draft.image_path || null;

      if (draft.id) {
        const { error } = await supabase
          .from('products')
          .update({ image_url: null, image_path: null, image_pending: true })
          .eq('id', draft.id);
        if (error) throw error;
      }

      if (previousPath) {
        try {
          await deleteStorageImage(previousPath);
        } catch (error) {
          console.warn('No se pudo borrar el archivo de Storage:', error);
        }
      }

      setDraft((current) =>
        current ? { ...current, image_url: '', image_path: '', image_pending: true } : current,
      );

      if (draft.id) {
        setProducts((current) =>
          current.map((product) =>
            product.id === draft.id
              ? { ...product, image_url: null, image_path: null, image_pending: true }
              : product,
          ),
        );
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo eliminar la imagen.');
    } finally {
      setBusy(false);
    }
  }

  function handleImageDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDraggingImage(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadImage(file);
  }

  async function deleteProduct(id: string) {
    if (!confirm('¿Eliminar este producto del listado?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      alert(error.message);
      return;
    }

    await fetch('/api/catalog/generate', { method: 'POST' });
    await loadProducts();
  }


  function toggleSelectedProduct(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function toggleCurrentPageSelection() {
    setSelectedIds((current) => {
      const currentSet = new Set(current);

      if (allCurrentPageSelected) {
        currentPageIds.forEach((id) => currentSet.delete(id));
      } else {
        currentPageIds.forEach((id) => currentSet.add(id));
      }

      return Array.from(currentSet);
    });
  }

  async function selectAllFilteredProducts() {
    setBulkBusy(true);
    try {
      const ids: string[] = [];
      const batchSize = 700;

      for (let from = 0; ; from += batchSize) {
        let request: any = supabase
          .from('products')
          .select('id')
          .order('name')
          .range(from, from + batchSize - 1);

        if (query.trim()) {
          const term = query.trim().replace(/,/g, ' ');
          request = request.or(`name.ilike.%${term}%,article_name.ilike.%${term}%,sku.ilike.%${term}%`);
        }
        if (categoryId) request = request.eq('category_id', categoryId);
        if (brandId) request = request.eq('brand_id', brandId);
        if (wineryId) request = request.eq('winery_id', wineryId);
        if (varietalId) request = request.eq('varietal_id', varietalId);
        if (withImage && !withoutImage) request = request.eq('image_pending', false);
        if (withoutImage && !withImage) request = request.eq('image_pending', true);
        if (unitsFilter) request = request.eq('units_per_box', Number(unitsFilter));

        const { data, error } = await request;
        if (error) throw error;

        const batch = (data || []).map((row: { id: string }) => row.id);
        ids.push(...batch);
        if (batch.length < batchSize) break;
      }

      setSelectedIds(ids);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudieron seleccionar los productos.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function updateSelectedVisibility(enabled: boolean) {
    if (!selectedIds.length) return;
    setBulkBusy(true);

    try {
      for (let index = 0; index < selectedIds.length; index += 200) {
        const batch = selectedIds.slice(index, index + 200);
        const { error } = await supabase.from('products').update({ enabled }).in('id', batch);
        if (error) throw error;
      }

      setProducts((current) =>
        current.map((product) =>
          selectedSet.has(product.id) ? { ...product, enabled } : product,
        ),
      );
      await fetch('/api/catalog/generate', { method: 'POST' });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo actualizar la visibilidad.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteSelectedProducts() {
    if (!selectedIds.length) return;
    if (!confirm(`¿Eliminar definitivamente ${selectedIds.length} productos seleccionados?`)) return;

    setBulkBusy(true);
    try {
      for (let index = 0; index < selectedIds.length; index += 200) {
        const batch = selectedIds.slice(index, index + 200);
        const { error } = await supabase.from('products').delete().in('id', batch);
        if (error) throw error;
      }

      setSelectedIds([]);
      await fetch('/api/catalog/generate', { method: 'POST' });
      await loadProducts();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudieron eliminar los productos.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function increaseSelectedPrices() {
    const percentage = Number(pricePercentage);
    const roundTo = Math.max(0, Number(priceRoundTo) || 0);

    if (!selectedIds.length) return;
    if (!Number.isFinite(percentage) || percentage <= 0) {
      alert('Ingresá un porcentaje mayor a cero.');
      return;
    }

    if (!confirm(`¿Aumentar ${percentage}% el precio de ${selectedIds.length} productos?`)) return;

    setBulkBusy(true);
    try {
      const { error } = await supabase.rpc('bulk_increase_product_prices', {
        product_ids: selectedIds,
        percentage,
        round_to: roundTo,
      });

      if (error) throw error;

      setPriceModalOpen(false);
      setPricePercentage('');
      await fetch('/api/catalog/generate', { method: 'POST' });
      await loadProducts();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'No se pudo aplicar el aumento. Ejecutá primero la migración SQL incluida.',
      );
    } finally {
      setBulkBusy(false);
    }
  }

  async function exportFilteredProducts() {
    setExporting(true);
    try {
      const exported: Product[] = [];
      const batchSize = 500;

      for (let from = 0; ; from += batchSize) {
        let request: any = supabase
          .from('products')
          .select('*,categories(name),wineries(name),varietals(name)')
          .order('name')
          .range(from, from + batchSize - 1);

        if (query.trim()) {
          const term = query.trim().replace(/,/g, ' ');
          request = request.or(
            `name.ilike.%${term}%,article_name.ilike.%${term}%,sku.ilike.%${term}%`,
          );
        }
        if (categoryId) request = request.eq('category_id', categoryId);
        if (brandId) request = request.eq('brand_id', brandId);
        if (wineryId) request = request.eq('winery_id', wineryId);
        if (varietalId) request = request.eq('varietal_id', varietalId);
        if (withImage && !withoutImage) request = request.eq('image_pending', false);
        if (withoutImage && !withImage) request = request.eq('image_pending', true);
        if (unitsFilter) request = request.eq('units_per_box', Number(unitsFilter));

        const { data, error } = await request;
        if (error) throw error;
        const batch = (data || []) as Product[];
        exported.push(...batch);
        if (batch.length < batchSize) break;
      }

      if (!exported.length) {
        alert('No hay productos para exportar con los filtros seleccionados.');
        return;
      }

      const XLSX = await import('xlsx');
      const rows = exported.map((product) => ({
        Producto: product.name,
        'Nombre del artículo': product.article_name || '',
        Descripción: product.description || '',
        Código: product.sku || '',
        Categoría: product.categories?.name || '',
        Marca: product.brands?.name || '',
        Bodega: product.wineries?.name || '',
        Varietal: product.varietals?.name || '',
        Imagen: product.image_url && !product.image_pending ? 'SI' : 'NO',
        Precio: Number(product.price) || 0,
        Unidades: Math.max(
          1,
          Number(product.units_per_box) || inferUnitsPerBox(product.article_name, product.name),
        ),
        Estado: product.enabled ? 'Visible' : 'Oculto',
        Destacado: product.featured ? 'SI' : 'NO',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 24 },
        { wch: 58 },
        { wch: 70 },
        { wch: 18 },
        { wch: 20 },
        { wch: 30 },
        { wch: 24 },
        { wch: 10 },
        { wch: 14 },
        { wch: 11 },
        { wch: 12 },
        { wch: 12 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `productos-dolce-vino-${date}.xlsx`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo exportar el Excel.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <AdminShell
      title="Gestión de vinos"
      subtitle="Productos del listado del cliente. La marca es el nombre visible y el nombre del artículo queda como detalle."
    >
      <div className={styles.page}>
        <section className={styles.card}>
          <header className={styles.pageHeader}>
            <div>
              <h2>Listado de productos</h2>
              <p>{count} productos encontrados.</p>
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.exportButton}
                onClick={() => void exportFilteredProducts()}
                disabled={exporting}
              >
                <Download size={17} />
                {exporting ? 'Exportando...' : 'Exportar Excel'}
              </button>
              <button type="button" className={styles.primaryButton} onClick={openNewProduct}>
                Nuevo producto
              </button>
            </div>
          </header>

          <section className={styles.filtersPanel} aria-label="Filtros del listado">
            <div className={styles.filtersHeader}>
              <div className={styles.filtersTitle}>
                <SlidersHorizontal size={18} />
                <div>
                  <h3>Filtrar productos</h3>
                  <p>Buscá y refiná el listado sin perder de vista la tabla.</p>
                </div>
              </div>
              {hasFilters && (
                <button type="button" className={styles.clearButton} onClick={clearFilters}>
                  <RotateCcw size={15} />
                  Limpiar filtros
                </button>
              )}
            </div>

            <div className={styles.filtersGrid}>
              <label className={`${styles.field} ${styles.searchField}`}>
                <span>Buscar</span>
                <div className={styles.searchControl}>
                  <Search size={18} />
                  <input
                    value={query}
                    placeholder="Marca, artículo o código"
                    onChange={(event) => {
                      setPage(0);
                      setQuery(event.target.value);
                    }}
                  />
                </div>
              </label>

              <div className={styles.field}>
                <span>Categoría</span>
                <CompactSelect
                  ariaLabel="Filtrar por categoría"
                  value={categoryId}
                  options={[{ value: '', label: 'Todas' }, ...categories.map((option) => ({ value: option.id, label: option.name }))]}
                  onChange={(value) => {
                    setPage(0);
                    setCategoryId(value);
                  }}
                />
              </div>

              <div className={styles.field}>
                <span>Marca</span>
                <CompactSelect
                  ariaLabel="Filtrar por marca"
                  value={brandId}
                  options={[{ value: '', label: 'Todas' }, ...brands.map((option) => ({ value: option.id, label: option.name }))]}
                  onChange={(value) => {
                    setPage(0);
                    setBrandId(value);
                  }}
                />
              </div>

              <div className={styles.field}>
                <span>Bodega</span>
                <CompactSelect
                  ariaLabel="Filtrar por bodega"
                  value={wineryId}
                  options={[{ value: '', label: 'Todas' }, ...wineries.map((option) => ({ value: option.id, label: option.name }))]}
                  onChange={(value) => {
                    setPage(0);
                    setWineryId(value);
                  }}
                />
              </div>

              <div className={`${styles.field} ${styles.varietalField}`}>
                <span>Varietal</span>
                <CompactSelect
                  ariaLabel="Filtrar por varietal"
                  value={varietalId}
                  options={[{ value: '', label: 'Todos' }, ...varietals.map((option) => ({ value: option.id, label: option.name }))]}
                  onChange={(value) => {
                    setPage(0);
                    setVarietalId(value);
                  }}
                />
              </div>

              <div className={`${styles.field} ${styles.imageField}`}>
                <span>
                  <ImageIcon size={14} /> Imagen
                </span>
                <div className={styles.imageOptions}>
                  <label className={withImage ? styles.optionActive : ''}>
                    <input
                      type="checkbox"
                      checked={withImage}
                      onChange={(event) => {
                        setPage(0);
                        setWithImage(event.target.checked);
                      }}
                    />
                    Con imagen
                  </label>
                  <label className={withoutImage ? styles.optionActive : ''}>
                    <input
                      type="checkbox"
                      checked={withoutImage}
                      onChange={(event) => {
                        setPage(0);
                        setWithoutImage(event.target.checked);
                      }}
                    />
                    Sin imagen
                  </label>
                </div>
              </div>

              <div className={`${styles.field} ${styles.unitsField}`}>
                <span>
                  <Package size={14} /> Unidades
                </span>
                <CompactSelect
                  ariaLabel="Filtrar por unidades"
                  value={unitsFilter}
                  options={[{ value: '', label: 'Todas' }, ...UNIT_OPTIONS.map((value) => ({ value: String(value), label: `Caja x${value}` }))]}
                  onChange={(value) => {
                    setPage(0);
                    setUnitsFilter(value);
                  }}
                />
              </div>

            </div>
          </section>

          <section className={styles.bulkBar} aria-label="Acciones masivas">
            <div className={styles.bulkSummary}>
              <ListChecks size={18} />
              <div>
                <strong>{selectedIds.length} seleccionados</strong>
                <span>Podés seleccionar la página actual o todos los resultados filtrados.</span>
              </div>
            </div>

            <div className={styles.bulkActions}>
              <button type="button" onClick={toggleCurrentPageSelection} disabled={!products.length || bulkBusy}>
                {allCurrentPageSelected ? 'Quitar página' : 'Seleccionar página'}
              </button>
              <button type="button" onClick={() => void selectAllFilteredProducts()} disabled={!count || bulkBusy}>
                Seleccionar filtrados ({count})
              </button>
              <button type="button" onClick={() => void updateSelectedVisibility(true)} disabled={!selectedIds.length || bulkBusy}>
                <Eye size={15} /> Mostrar
              </button>
              <button type="button" onClick={() => void updateSelectedVisibility(false)} disabled={!selectedIds.length || bulkBusy}>
                <EyeOff size={15} /> Ocultar
              </button>
              <button type="button" onClick={() => setPriceModalOpen(true)} disabled={!selectedIds.length || bulkBusy}>
                <Percent size={15} /> Aumentar precio
              </button>
              <button type="button" className={styles.bulkDanger} onClick={() => void deleteSelectedProducts()} disabled={!selectedIds.length || bulkBusy}>
                <Trash2 size={15} /> Eliminar
              </button>
              {selectedIds.length > 0 && (
                <button type="button" onClick={() => setSelectedIds([])} disabled={bulkBusy}>
                  Limpiar selección
                </button>
              )}
            </div>
          </section>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.selectColumn}>
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={toggleCurrentPageSelection}
                      aria-label="Seleccionar productos de esta página"
                    />
                  </th>
                  <th>Imagen</th>
                  <th>Marca / producto</th>
                  <th>Categoría</th>
                  <th>Bodega</th>
                  <th>Varietal</th>
                  <th>Precio</th>
                  <th>Caja</th>
                  <th>Ver</th>
                  <th className={styles.actionsHeader}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className={selectedSet.has(product.id) ? styles.selectedRow : ''}>
                    <td className={styles.selectColumn}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(product.id)}
                        onChange={() => toggleSelectedProduct(product.id)}
                        aria-label={`Seleccionar ${product.article_name || product.name}`}
                      />
                    </td>
                    <td>
                      {product.image_url ? (
                        <img
                          className={styles.thumbnail}
                          src={product.image_url}
                          alt={product.article_name || product.name}
                        />
                      ) : (
                        <div className={styles.emptyThumbnail} aria-label="Sin imagen">
                          <ImagePlus size={19} />
                        </div>
                      )}
                    </td>
                    <td>
                      <div className={styles.productCell}>
                        <strong>{product.name}</strong>
                        <span>{product.article_name || product.sku || 'Sin detalle'}</span>
                      </div>
                    </td>
                    <td>{product.categories?.name || '—'}</td>
                    <td>{product.wineries?.name || '—'}</td>
                    <td>{product.varietals?.name || '—'}</td>
                    <td className={styles.priceCell}>{formatPrice(product.price)}</td>
                    <td className={styles.unitsCell}>
                      x
                      {isSingleUnitProduct(
                        product.categories?.name,
                        product.article_name,
                        product.name,
                      )
                        ? 1
                        : Math.max(
                            1,
                            Number(product.units_per_box) ||
                              inferUnitsPerBox(product.article_name, product.name),
                          )}
                    </td>
                    <td>
                      <div className={styles.visibilityCell}>
                        <button
                          type="button"
                          className={product.enabled ? styles.visibilityButton : styles.visibilityButtonOff}
                          title={product.enabled ? 'Ocultar producto del sitio' : 'Mostrar producto en el sitio'}
                          aria-label={product.enabled ? `Ocultar ${product.article_name || product.name}` : `Mostrar ${product.article_name || product.name}`}
                          onClick={() => void toggleProductVisibility(product)}
                        >
                          {product.enabled ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                        {product.featured && <span className={styles.featuredDot} title="Destacado" />}
                      </div>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          title="Editar producto"
                          aria-label={`Editar ${product.article_name || product.name}`}
                          onClick={() => openEditProduct(product)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          title="Eliminar producto"
                          aria-label={`Eliminar ${product.article_name || product.name}`}
                          onClick={() => void deleteProduct(product.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className={styles.pagination}>
            <button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
              Anterior
            </button>
            <span>
              Página {page + 1} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </button>
          </footer>
        </section>

        {priceModalOpen && (
          <div className={styles.modalBackdrop} role="presentation">
            <section className={`${styles.modal} ${styles.priceModal}`} role="dialog" aria-modal="true">
              <header className={styles.modalHeader}>
                <div>
                  <span>Acción masiva</span>
                  <h2>Aumentar precios</h2>
                </div>
                <button type="button" onClick={() => setPriceModalOpen(false)} aria-label="Cerrar">
                  <X size={20} />
                </button>
              </header>

              <div className={styles.priceBulkForm}>
                <p>Se actualizarán <strong>{selectedIds.length} productos</strong>.</p>
                <label>
                  <span>Porcentaje de aumento</span>
                  <div className={styles.percentageInput}>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={pricePercentage}
                      onChange={(event) => setPricePercentage(event.target.value)}
                      placeholder="Ejemplo: 10"
                    />
                    <strong>%</strong>
                  </div>
                </label>
                <label>
                  <span>Redondear al múltiplo de</span>
                  <select value={priceRoundTo} onChange={(event) => setPriceRoundTo(event.target.value)}>
                    <option value="0">Sin redondeo</option>
                    <option value="10">$ 10</option>
                    <option value="100">$ 100</option>
                    <option value="500">$ 500</option>
                    <option value="1000">$ 1.000</option>
                  </select>
                </label>
                <small>Ejemplo: $ 29.000 con aumento del 10% y redondeo a $100 queda en $ 31.900.</small>
                <button type="button" className={styles.primaryButton} onClick={() => void increaseSelectedPrices()} disabled={bulkBusy}>
                  <Percent size={16} /> {bulkBusy ? 'Aplicando...' : 'Aplicar aumento'}
                </button>
              </div>
            </section>
          </div>
        )}

        {draft && (
          <div className={styles.modalBackdrop} role="presentation">
            <section className={styles.modal} role="dialog" aria-modal="true">
              <header className={styles.modalHeader}>
                <div>
                  <span>Producto</span>
                  <h2>{draft.id ? 'Editar producto' : 'Nuevo producto'}</h2>
                </div>
                <button type="button" onClick={() => setDraft(null)} aria-label="Cerrar">
                  <X size={20} />
                </button>
              </header>

              <div className={styles.formGrid}>
                <label className={styles.wideField}>
                  <span>Marca / nombre visible</span>
                  <input
                    value={draft.name || ''}
                    onChange={(event) => {
                      const name = event.target.value;
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              name,
                              units_per_box: unitsManual
                                ? current.units_per_box
                                : inferUnitsPerBox(current.article_name, name),
                            }
                          : current,
                      );
                    }}
                  />
                </label>

                <label className={styles.wideField}>
                  <span>Nombre del artículo / detalle</span>
                  <input
                    value={draft.article_name || ''}
                    onChange={(event) => {
                      const articleName = event.target.value;
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              article_name: articleName,
                              units_per_box: unitsManual
                                ? current.units_per_box
                                : inferUnitsPerBox(articleName, current.name),
                            }
                          : current,
                      );
                    }}
                  />
                </label>

                <label className={styles.wideField}>
                  <span>Descripción breve</span>
                  <textarea
                    rows={4}
                    maxLength={700}
                    placeholder="Descripción del vino, perfil, ocasión recomendada o características principales."
                    value={draft.description || ''}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  />
                  <small>{(draft.description || '').length}/700 caracteres</small>
                </label>

                <label>
                  <span>Código</span>
                  <input
                    value={draft.sku || ''}
                    onChange={(event) => setDraft({ ...draft, sku: event.target.value })}
                  />
                </label>

                <label>
                  <span>Precio de venta</span>
                  <div className={styles.currencyInput}>
                    <span>$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draft.price}
                      placeholder="0,00"
                      onChange={(event) => {
                        const value = event.target.value;
                        if (/^[0-9.,]*$/.test(value)) {
                          setDraft({ ...draft, price: value });
                        }
                      }}
                      onBlur={() => setDraft({ ...draft, price: formatPriceInput(draft.price) })}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </div>
                </label>

                <label>
                  <span>Unidades por caja</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={
                      isSingleUnitProduct(
                        categories.find((category) => category.id === draft.category_id)?.name,
                        draft.article_name,
                        draft.name,
                      )
                        ? 1
                        : draft.units_per_box || 1
                    }
                    disabled={isSingleUnitProduct(
                      categories.find((category) => category.id === draft.category_id)?.name,
                      draft.article_name,
                      draft.name,
                    )}
                    onChange={(event) => {
                      setUnitsManual(true);
                      setDraft({
                        ...draft,
                        units_per_box: Math.max(1, Number(event.target.value) || 1),
                      });
                    }}
                  />
                  <small>
                    Se detecta automáticamente, pero es editable. Estuches, destilados, whisky, ron y ginebra se contabilizan siempre como x1.
                  </small>
                </label>

                <label>
                  <span>Categoría</span>
                  <select
                    value={draft.category_id || ''}
                    onChange={(event) => {
                      const nextCategoryId = event.target.value;
                      const nextCategoryName = categories.find((option) => option.id === nextCategoryId)?.name;
                      const forceSingleUnit = isSingleUnitProduct(
                        nextCategoryName,
                        draft.article_name,
                        draft.name,
                      );

                      setDraft({
                        ...draft,
                        category_id: nextCategoryId,
                        units_per_box: forceSingleUnit ? 1 : draft.units_per_box,
                      });

                      if (forceSingleUnit) setUnitsManual(false);
                    }}
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Marca</span>
                  <select
                    value={draft.brand_id || ''}
                    onChange={(event) => setDraft({ ...draft, brand_id: event.target.value })}
                  >
                    <option value="">Sin marca</option>
                    {brands.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Bodega / proveedor</span>
                  <select
                    value={draft.winery_id || ''}
                    onChange={(event) => setDraft({ ...draft, winery_id: event.target.value })}
                  >
                    <option value="">Sin bodega</option>
                    {wineries.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Varietal / subcategoría</span>
                  <select
                    value={draft.varietal_id || ''}
                    onChange={(event) => setDraft({ ...draft, varietal_id: event.target.value })}
                  >
                    <option value="">Sin varietal</option>
                    {varietals.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className={`${styles.imageEditor} ${styles.wideField}`}>
                  <span>Imagen del producto</span>
                  <label
                    className={`${styles.dropzone} ${draggingImage ? styles.dropzoneActive : ''}`}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDraggingImage(true);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      if (event.currentTarget === event.target) setDraggingImage(false);
                    }}
                    onDrop={handleImageDrop}
                  >
                    {draft.image_url ? (
                      <img src={draft.image_url} alt={draft.article_name || draft.name || 'Producto'} />
                    ) : (
                      <div className={styles.dropzoneEmpty}>
                        <UploadCloud size={34} />
                        <strong>Arrastrá una imagen aquí</strong>
                        <span>o hacé clic para seleccionarla</span>
                        <small>JPG, PNG, WEBP o AVIF · máximo 8 MB · el fondo claro se elimina automáticamente</small>
                      </div>
                    )}
                    <input
                      hidden
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = '';
                        if (file) void uploadImage(file);
                      }}
                    />
                  </label>

                  <div className={styles.imageActions}>
                    <label className={styles.secondaryButton}>
                      <ImagePlus size={16} />
                      {draft.image_url ? 'Cambiar imagen' : 'Seleccionar imagen'}
                      <input
                        hidden
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.currentTarget.value = '';
                          if (file) void uploadImage(file);
                        }}
                      />
                    </label>
                    {draft.image_url && (
                      <button
                        type="button"
                        className={styles.dangerButton}
                        disabled={busy}
                        onClick={() => void removeProductImage()}
                      >
                        <Trash2 size={16} />
                        Eliminar imagen
                      </button>
                    )}
                    <small>
                      {draft.id
                        ? 'La imagen se guarda automáticamente al seleccionarla o arrastrarla.'
                        : 'En productos nuevos, la imagen queda vinculada al guardar el producto.'}
                    </small>
                  </div>
                </div>

                <label className={styles.checkField}>
                  <input
                    type="checkbox"
                    checked={Boolean(draft.enabled)}
                    onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
                  />
                  Mostrar en el sitio
                </label>

                <label className={styles.checkField}>
                  <input
                    type="checkbox"
                    checked={Boolean(draft.featured)}
                    onChange={(event) => setDraft({ ...draft, featured: event.target.checked })}
                  />
                  Destacado
                </label>
              </div>

              <footer className={styles.modalFooter}>
                <button type="button" className={styles.secondaryButton} onClick={() => setDraft(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={busy}
                  onClick={() => void saveProduct()}
                >
                  {busy ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </footer>
            </section>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
