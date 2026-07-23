'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Gift, ImagePlus, Pencil, Plus, Search, Trash2, UploadCloud, X } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { createClient } from '@/lib/supabase/client';
import styles from './mixes-admin.module.css';

type RelationName = { name: string } | null;

type ProductOption = {
  id: string;
  name: string;
  article_name: string | null;
  price: string;
  enabled: boolean;
  categories?: RelationName;
  wineries?: RelationName;
  varietals?: RelationName;
};

type MixRow = ProductOption & {
  description: string | null;
  featured: boolean;
  image_url: string | null;
  image_path?: string | null;
  created_at?: string;
};

type MixItem = {
  product_id: string;
  quantity: number;
  product?: ProductOption;
};

type Draft = {
  id: string;
  name: string;
  description: string;
  price: number;
  enabled: boolean;
  featured: boolean;
  image_url: string;
  image_path: string;
  items: MixItem[];
};

const EMPTY_DRAFT: Draft = {
  id: '',
  name: '',
  description: '',
  price: '',
  enabled: true,
  featured: false,
  image_url: '',
  image_path: '',
  items: [],
};

function formatPrice(value: number) {
  return `$ ${Number(value || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parsePriceInput(value: string) {
  const cleaned = value.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPriceInput(value: string) {
  if (!value.trim()) return '';
  return parsePriceInput(value).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function MixesAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [mixes, setMixes] = useState<MixRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [draggingImage, setDraggingImage] = useState(false);

  const loadData = useCallback(async () => {
    const [mixResult, productResult, itemsResult] = await Promise.all([
      supabase
        .from('products')
        .select('id,name,article_name,description,price,enabled,featured,image_url,image_path,categories(name),wineries(name),varietals(name),created_at')
        .eq('is_mix', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('products')
        .select('id,name,article_name,price,enabled,categories(name),wineries(name),varietals(name)')
        .eq('is_mix', false)
        .order('name'),
      supabase.from('product_mix_items').select('mix_product_id,quantity'),
    ]);

    const error = mixResult.error || productResult.error || itemsResult.error;
    if (error) {
      alert(error.message);
      return;
    }

    setMixes((mixResult.data || []) as unknown as MixRow[]);
    setProducts((productResult.data || []) as unknown as ProductOption[]);

    const counts: Record<string, number> = {};
    for (const item of itemsResult.data || []) {
      counts[item.mix_product_id] = (counts[item.mix_product_id] || 0) + Number(item.quantity || 0);
    }
    setItemCounts(counts);
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es-AR');
    if (!term) return products;
    return products.filter((product) =>
      `${product.name} ${product.article_name || ''} ${product.wineries?.name || ''} ${product.varietals?.name || ''}`
        .toLocaleLowerCase('es-AR')
        .includes(term),
    );
  }, [products, query]);

  const selectedTotal = useMemo(() => {
    if (!draft) return 0;
    return draft.items.reduce((total, item) => {
      const product = products.find((option) => option.id === item.product_id);
      return total + Number(product?.price || 0) * item.quantity;
    }, 0);
  }, [draft, products]);

  function openNew() {
    setQuery('');
    setDraft({ ...EMPTY_DRAFT, items: [] });
  }

  async function openEdit(mix: MixRow) {
    setBusy(true);
    const { data, error } = await supabase
      .from('product_mix_items')
      .select('product_id,quantity')
      .eq('mix_product_id', mix.id)
      .order('sort_order');

    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }

    setQuery('');
    setDraft({
      id: mix.id,
      name: mix.name,
      description: mix.description || '',
      price: Number(mix.price || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      enabled: mix.enabled,
      featured: mix.featured,
      image_url: mix.image_url || '',
      image_path: mix.image_path || '',
      items: (data || []).map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity) || 1,
      })),
    });
  }

  function toggleItem(productId: string) {
    if (!draft) return;
    const exists = draft.items.some((item) => item.product_id === productId);
    setDraft({
      ...draft,
      items: exists
        ? draft.items.filter((item) => item.product_id !== productId)
        : [...draft.items, { product_id: productId, quantity: 1 }],
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    if (!draft) return;
    setDraft({
      ...draft,
      items: draft.items.map((item) =>
        item.product_id === productId ? { ...item, quantity: Math.max(1, quantity || 1) } : item,
      ),
    });
  }

  function validateImage(file: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowed.includes(file.type)) throw new Error('Usá una imagen JPG, PNG, WEBP o AVIF.');
    if (file.size > 8 * 1024 * 1024) throw new Error('La imagen no puede superar los 8 MB.');
  }

  async function deleteStorageImage(path?: string | null) {
    if (!path) return;
    const { error } = await supabase.storage.from('products').remove([path]);
    if (error) throw error;
  }

  async function uploadMixImage(file: File) {
    if (!draft) return;
    setBusy(true);

    try {
      validateImage(file);
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `manual-mixes/${draft.id || 'nuevo'}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(path, file, {
          upsert: false,
          contentType: file.type,
          cacheControl: '31536000',
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('products').getPublicUrl(path);
      const previousPath = draft.image_path || '';

      if (draft.id) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            image_url: data.publicUrl,
            image_path: path,
            image_pending: false,
          })
          .eq('id', draft.id);

        if (updateError) {
          await deleteStorageImage(path);
          throw updateError;
        }
      }

      setDraft({
        ...draft,
        image_url: data.publicUrl,
        image_path: path,
      });

      if (previousPath && previousPath !== path) {
        try {
          await deleteStorageImage(previousPath);
        } catch {
          // La nueva imagen ya quedó cargada; no interrumpimos por una limpieza fallida.
        }
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo subir la imagen.');
    } finally {
      setDraggingImage(false);
      setBusy(false);
    }
  }

  async function removeMixImage() {
    if (!draft?.image_url) return;
    if (!confirm('¿Eliminar la imagen del mix?')) return;

    setBusy(true);
    try {
      if (draft.id) {
        const { error } = await supabase
          .from('products')
          .update({ image_url: null, image_path: null, image_pending: true })
          .eq('id', draft.id);
        if (error) throw error;
      }

      if (draft.image_path) await deleteStorageImage(draft.image_path);
      setDraft({ ...draft, image_url: '', image_path: '' });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo eliminar la imagen.');
    } finally {
      setBusy(false);
    }
  }

  function handleImageDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDraggingImage(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadMixImage(file);
  }

  async function saveMix() {
    if (!draft?.name.trim()) {
      alert('Ingresá un nombre para el mix.');
      return;
    }
    if (!draft.items.length) {
      alert('Seleccioná al menos un producto.');
      return;
    }

    setBusy(true);
    try {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', 'promociones')
        .single();
      if (categoryError) throw categoryError;

      const payload = {
        name: draft.name.trim(),
        article_name: draft.name.trim(),
        description: draft.description.trim() || null,
        price: parsePriceInput(draft.price),
        stock: 0,
        units_per_box: 1,
        enabled: draft.enabled,
        featured: draft.featured,
        category_id: category.id,
        winery_id: null,
        varietal_id: null,
        brand_id: null,
        image_url: draft.image_url.trim() || null,
        image_path: draft.image_path.trim() || null,
        image_pending: !draft.image_url.trim(),
        is_mix: true,
      };

      let mixId = draft.id;
      if (mixId) {
        const { error } = await supabase.from('products').update(payload).eq('id', mixId);
        if (error) throw error;
      } else {
        const timestamp = Date.now();
        const { data, error } = await supabase
          .from('products')
          .insert({
            ...payload,
            slug: `${slugify(draft.name)}-${timestamp}`,
            external_key: `manual-mix-${timestamp}`,
          })
          .select('id')
          .single();
        if (error) throw error;
        mixId = data.id;
      }

      const { error: deleteError } = await supabase
        .from('product_mix_items')
        .delete()
        .eq('mix_product_id', mixId);
      if (deleteError) throw deleteError;

      const { error: itemsError } = await supabase.from('product_mix_items').insert(
        draft.items.map((item, index) => ({
          mix_product_id: mixId,
          product_id: item.product_id,
          quantity: item.quantity,
          sort_order: index,
        })),
      );
      if (itemsError) throw itemsError;

      await fetch('/api/catalog/generate', { method: 'POST' });
      setDraft(null);
      await loadData();
    } catch (error: any) {
      alert(error?.message || 'No se pudo guardar el mix.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleVisibility(mix: MixRow) {
    const { error } = await supabase
      .from('products')
      .update({ enabled: !mix.enabled })
      .eq('id', mix.id);
    if (error) alert(error.message);
    else await loadData();
  }

  async function deleteMix(mix: MixRow) {
    if (!confirm(`¿Eliminar “${mix.name}”?`)) return;
    const { error } = await supabase.from('products').delete().eq('id', mix.id);
    if (error) alert(error.message);
    else {
      await fetch('/api/catalog/generate', { method: 'POST' });
      await loadData();
    }
  }

  return (
    <AdminShell
      title="Mixes y promociones"
      subtitle="Armá combos con vinos, espumantes, aceites, destilados y otros productos."
    >
      <section className={styles.toolbar}>
        <div>
          <h2>Promociones disponibles</h2>
          <p>Cada mix se publica como un producto x1 con precio propio.</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={openNew}>
          <Plus size={17} /> Nuevo mix
        </button>
      </section>

      <section className={styles.grid}>
        {mixes.map((mix) => (
          <article key={mix.id} className={styles.card}>
            <div className={styles.cardImage}>
              {mix.image_url ? <img src={mix.image_url} alt={mix.name} /> : <Gift size={38} />}
            </div>
            <div className={styles.cardBody}>
              <span className={mix.enabled ? styles.statusOn : styles.statusOff}>
                {mix.enabled ? 'Visible' : 'Oculto'}
              </span>
              <h3>{mix.name}</h3>
              <p>{mix.description || 'Sin descripción.'}</p>
              <div className={styles.cardMeta}>
                <strong>{formatPrice(mix.price)}</strong>
                <span>{itemCounts[mix.id] || 0} unidades incluidas</span>
              </div>
            </div>
            <div className={styles.cardActions}>
              <button type="button" onClick={() => void toggleVisibility(mix)}>
                {mix.enabled ? <EyeOff size={16} /> : <Eye size={16} />}
                {mix.enabled ? 'Ocultar' : 'Mostrar'}
              </button>
              <button type="button" onClick={() => void openEdit(mix)}>
                <Pencil size={16} /> Editar
              </button>
              <button type="button" className={styles.dangerButton} onClick={() => void deleteMix(mix)}>
                <Trash2 size={16} /> Eliminar
              </button>
            </div>
          </article>
        ))}
        {!mixes.length && (
          <div className={styles.emptyState}>
            <Gift size={38} />
            <h3>Todavía no hay mixes</h3>
            <p>Creá la primera promoción combinando productos del catálogo.</p>
          </div>
        )}
      </section>

      {draft && (
        <div className={styles.backdrop} role="presentation" onMouseDown={() => !busy && setDraft(null)}>
          <section className={styles.modal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <div>
                <span>Promoción</span>
                <h2>{draft.id ? 'Editar mix' : 'Nuevo mix'}</h2>
              </div>
              <button type="button" onClick={() => setDraft(null)} aria-label="Cerrar">
                <X size={20} />
              </button>
            </header>

            <div className={styles.formGrid}>
              <label>
                <span>Nombre</span>
                <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Mix Julio" />
              </label>
              <label>
                <span>Precio promocional</span>
                <div className={styles.currencyInput}>
                  <span>$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draft.price}
                    placeholder="0,00"
                    onChange={(event) => {
                      const value = event.target.value;
                      if (/^[0-9.,]*$/.test(value)) setDraft({ ...draft, price: value });
                    }}
                    onBlur={() => setDraft({ ...draft, price: formatPriceInput(draft.price) })}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </div>
              </label>
              <label className={styles.wideField}>
                <span>Descripción</span>
                <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Detalle de la promoción..." />
              </label>
              <div className={`${styles.wideField} ${styles.imageUploadField}`}>
                <span className={styles.fieldLabel}>Imagen del mix</span>
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
                    <img src={draft.image_url} alt={draft.name || 'Mix'} />
                  ) : (
                    <div className={styles.dropzoneEmpty}>
                      <UploadCloud size={34} />
                      <strong>Arrastrá una imagen aquí</strong>
                      <span>o hacé clic para seleccionarla</span>
                      <small>JPG, PNG, WEBP o AVIF · máximo 8 MB</small>
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
                      if (file) void uploadMixImage(file);
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
                        if (file) void uploadMixImage(file);
                      }}
                    />
                  </label>
                  {draft.image_url && (
                    <button type="button" className={styles.removeImageButton} disabled={busy} onClick={() => void removeMixImage()}>
                      <Trash2 size={16} /> Eliminar imagen
                    </button>
                  )}
                </div>
              </div>
              <label className={styles.checkField}>
                <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
                Visible en el sitio
              </label>
              <label className={styles.checkField}>
                <input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} />
                Destacado
              </label>
            </div>

            <div className={styles.mixSummary}>
              <div>
                <span>Precio individual estimado</span>
                <strong>{formatPrice(selectedTotal)}</strong>
              </div>
              <div>
                <span>Precio del mix</span>
                <strong>{formatPrice(parsePriceInput(draft.price))}</strong>
              </div>
              <div>
                <span>Ahorro</span>
                <strong>{formatPrice(Math.max(0, selectedTotal - parsePriceInput(draft.price)))}</strong>
              </div>
            </div>

            <div className={styles.productPicker}>
              <div className={styles.pickerHeader}>
                <div>
                  <h3>Productos incluidos</h3>
                  <p>Seleccioná productos de cualquier categoría y definí la cantidad.</p>
                </div>
                <label className={styles.searchBox}>
                  <Search size={16} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto, bodega o varietal" />
                </label>
              </div>

              <div className={styles.productList}>
                {availableProducts.map((product) => {
                  const item = draft.items.find((entry) => entry.product_id === product.id);
                  return (
                    <div key={product.id} className={`${styles.productRow} ${item ? styles.productSelected : ''}`}>
                      <label>
                        <input type="checkbox" checked={Boolean(item)} onChange={() => toggleItem(product.id)} />
                        <div>
                          <strong>{product.article_name || product.name}</strong>
                          <span>
                            {[product.wineries?.name, product.varietals?.name, product.categories?.name].filter(Boolean).join(' · ') || 'Sin clasificación'}
                          </span>
                        </div>
                      </label>
                      <strong>{formatPrice(product.price)}</strong>
                      {item && (
                        <label className={styles.quantityField}>
                          <span>Cantidad</span>
                          <input type="number" min="1" value={item.quantity} onChange={(event) => updateQuantity(product.id, Number(event.target.value))} />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <footer className={styles.modalFooter}>
              <button type="button" onClick={() => setDraft(null)} disabled={busy}>Cancelar</button>
              <button type="button" className={styles.primaryButton} onClick={() => void saveMix()} disabled={busy}>
                {busy ? 'Guardando...' : 'Guardar mix'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
