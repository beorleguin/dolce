'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Eye,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Wine,
  X,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { createClient } from '@/lib/supabase/client';
import styles from './wineries-admin.module.css';

type Winery = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  enabled: boolean;
  featured: boolean;
  sort_order: number;
  products?: { count: number }[];
};

type WineryDraft = Partial<Winery> & {
  name: string;
  slug: string;
  logo_url: string;
  enabled: boolean;
  featured: boolean;
  sort_order: number;
};

const emptyDraft: WineryDraft = {
  name: '',
  slug: '',
  logo_url: '',
  enabled: true,
  featured: false,
  sort_order: 0,
};

export default function Wineries() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Winery[]>([]);
  const [edit, setEdit] = useState<WineryDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  async function load() {
    const { data, error } = await supabase.from('wineries').select('*,products(count)').order('name');
    if (error) {
      alert(error.message);
      return;
    }

    setItems((data || []) as Winery[]);
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((winery) => winery.name.toLowerCase().includes(term));
  }, [items, query]);

  async function upload(file: File) {
    const extension = file.name.split('.').pop() || 'png';
    const path = `logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const { error } = await supabase.storage.from('wineries').upload(path, file);

    if (error) {
      alert(error.message);
      return;
    }

    const { data } = supabase.storage.from('wineries').getPublicUrl(path);
    setEdit((current) => (current ? { ...current, logo_url: data.publicUrl } : current));
  }

  async function save() {
    if (!edit?.name.trim()) {
      alert('Ingresá el nombre de la bodega.');
      return;
    }

    setBusy(true);

    const slug = (edit.slug || edit.name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const payload = {
      name: edit.name.trim(),
      slug,
      logo_url: edit.logo_url || null,
      enabled: Boolean(edit.enabled),
      featured: Boolean(edit.featured),
      sort_order: Number(edit.sort_order) || 0,
    };

    const { error } = edit.id
      ? await supabase.from('wineries').update(payload).eq('id', edit.id)
      : await supabase.from('wineries').insert(payload);

    if (error) {
      alert(error.message);
    } else {
      setEdit(null);
      await load();
    }

    setBusy(false);
  }

  async function remove(winery: Winery) {
    const count = winery.products?.[0]?.count || 0;

    if (count) {
      alert(
        `No se puede eliminar: tiene ${count} productos asociados. Entrá a la bodega y reasigná esos productos primero.`,
      );
      return;
    }

    if (!confirm(`¿Eliminar ${winery.name}?`)) return;

    const { error } = await supabase.from('wineries').delete().eq('id', winery.id);
    if (error) alert(error.message);
    else await load();
  }

  return (
    <AdminShell
      title="Bodegas"
      subtitle="Administrá las bodegas y proveedores vinculados a los productos del catálogo."
    >
      <section className={styles.card}>
        <header className={styles.header}>
          <div>
            <h2>Listado de bodegas</h2>
            <p>{filteredItems.length} bodegas encontradas.</p>
          </div>

          <button type="button" className={styles.primaryButton} onClick={() => setEdit({ ...emptyDraft })}>
            <Plus size={17} />
            Nueva bodega
          </button>
        </header>

        <div className={styles.toolbar}>
          <label>
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar bodega"
            />
          </label>
        </div>

        <div className={styles.grid}>
          {filteredItems.map((winery) => {
            const count = winery.products?.[0]?.count || 0;

            return (
              <article key={winery.id} className={styles.wineryCard}>
                <Link href={`/admin/bodegas/${winery.id}`} className={styles.cardMain}>
                  <div className={styles.logo}>
                    {winery.logo_url ? (
                      <img src={winery.logo_url} alt={winery.name} />
                    ) : (
                      <span>{winery.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>

                  <div className={styles.cardCopy}>
                    <h3>{winery.name}</h3>
                    <p>
                      <Wine size={15} />
                      {count} productos asociados
                    </p>

                    <div className={styles.badges}>
                      <span className={winery.enabled ? styles.enabledBadge : styles.disabledBadge}>
                        {winery.enabled ? 'Visible' : 'Deshabilitada'}
                      </span>
                      {winery.featured && (
                        <span className={styles.featuredBadge}>
                          <Star size={12} />
                          Destacada
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                <div className={styles.actions}>
                  <Link href={`/admin/bodegas/${winery.id}`} className={styles.viewButton}>
                    <Eye size={13} />
                    Ver productos
                  </Link>
                  <button type="button" onClick={() => setEdit({ ...winery, logo_url: winery.logo_url || '' })}>
                    <Pencil size={13} />
                    Editar
                  </button>
                  <button type="button" className={styles.deleteButton} onClick={() => void remove(winery)}>
                    <Trash2 size={13} />
                    Eliminar
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {!filteredItems.length && (
          <div className={styles.empty}>No se encontraron bodegas.</div>
        )}
      </section>

      {edit && (
        <div className={styles.modalBackdrop}>
          <section className={styles.modal}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setEdit(null)}
              aria-label="Cerrar"
            >
              <X />
            </button>

            <span>Panel de administración</span>
            <h2>{edit.id ? 'Editar bodega' : 'Nueva bodega'}</h2>

            <div className={styles.form}>
              <label>
                Nombre
                <input
                  value={edit.name}
                  onChange={(event) => setEdit({ ...edit, name: event.target.value })}
                />
              </label>

              <div className={styles.uploadField}>
                <span>Logo</span>
                <div className={styles.uploadArea}>
                  {edit.logo_url ? (
                    <img src={edit.logo_url} alt="" />
                  ) : (
                    <div className={styles.uploadEmpty}>
                      <ImagePlus size={28} />
                      <span>Sin logo</span>
                    </div>
                  )}

                  <label className={styles.uploadButton}>
                    <ImagePlus size={15} />
                    Subir logo
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void upload(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              <label>
                Orden
                <input
                  type="number"
                  value={edit.sort_order || 0}
                  onChange={(event) => setEdit({ ...edit, sort_order: Number(event.target.value) })}
                />
              </label>

              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={Boolean(edit.enabled)}
                  onChange={(event) => setEdit({ ...edit, enabled: event.target.checked })}
                />
                Visible en el sitio
              </label>

              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={Boolean(edit.featured)}
                  onChange={(event) => setEdit({ ...edit, featured: event.target.checked })}
                />
                Destacada
              </label>
            </div>

            <button type="button" className={styles.saveButton} disabled={busy} onClick={() => void save()}>
              {busy ? 'Guardando...' : 'Guardar bodega'}
            </button>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
