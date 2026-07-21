'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronDown,
  Menu,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  formatPrice,
  getCartFromStorage,
  saveCartToStorage,
  type CartItem,
} from '@/lib/featuredWines';
import {
  catalogSlug,
  cleanPublicWineryName,
  isEstucheProduct,
  isSparklingCategory,
  isWineCategory,
  matchesCatalogSlug,
  normalizeCatalogText,
  preferredSparklingStyles,
  preferredWineVarietals,
  publicWineMenuGroups,
  sortCatalogLabels,
  titleFromCatalogSlug,
} from '@/lib/catalogRoutes';

type CatalogMode = 'all-wines' | 'wine-varietal' | 'sparkling' | 'winery';

type Product = {
  id: string;
  name: string;
  detail?: string;
  description: string;
  winery: string;
  winerySlug: string;
  varietal: string;
  category: string;
  image: string;
  pricePerUnit: number;
  unitsPerBox: number;
};

const hasProductImage=(product:{image?:string|null})=>
  Boolean(product.image?.trim());

const sortProductsImageFirst=<T extends {image?:string|null;name:string}>(
  products:T[],
)=>{
  return [...products].sort((a,b)=>{
    const imageDifference=Number(hasProductImage(b))-Number(hasProductImage(a));

    if(imageDifference!==0) return imageDifference;

    return a.name.localeCompare(b.name,'es');
  });
};

type CatalogListingPageProps = {
  mode: CatalogMode;
  slug?: string;
};

type FilterDropdownProps = {
  id: string;
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
  openId: string;
  setOpenId: (value: string) => void;
};

function FilterDropdown({
  id,
  value,
  placeholder,
  options,
  onChange,
  openId,
  setOpenId,
}: FilterDropdownProps) {
  return (
    <div className={`catalog-filter-dropdown${openId === id ? ' is-open' : ''}`}>
      <button
        type="button"
        className="catalog-filter-trigger"
        onClick={() => setOpenId(openId === id ? '' : id)}
        aria-expanded={openId === id}
      >
        <span>{value || placeholder}</span>
        <ChevronDown size={16} />
      </button>

      {openId === id && (
        <div className="catalog-filter-menu">
          <button
            type="button"
            className={!value ? 'is-selected' : ''}
            onClick={() => {
              onChange('');
              setOpenId('');
            }}
          >
            {placeholder}
          </button>

          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={value === option ? 'is-selected' : ''}
              onClick={() => {
                onChange(option);
                setOpenId('');
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CatalogListingPage({
  mode,
  slug = '',
}: CatalogListingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawer, setDrawer] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [selectedWinery, setSelectedWinery] = useState('');
  const [selectedVarietal, setSelectedVarietal] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [headerCompact, setHeaderCompact] = useState(false);
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState('');
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(24);

  useEffect(() => {
    setCart(getCartFromStorage());

    const supabase = createClient();

    void (async () => {
      const productSelect =
        'id,name,article_name,description,price,units_per_box,image_url,enabled,categories(name),wineries(name,slug),varietals(name)';

      const mapProducts = (rows: any[]): Product[] =>
        rows.map((row) => {
          const wineryName = cleanPublicWineryName(row.wineries?.name || '');
          return {
            id: row.id,
            name: (row.article_name || row.name || 'Producto').trim(),
            detail: row.name || undefined,
            description: (row.description || '').trim(),
            winery: wineryName,
            winerySlug: row.wineries?.slug || catalogSlug(wineryName),
            varietal: (row.varietals?.name || '').trim(),
            category: (row.categories?.name || '').trim(),
            image: row.image_url || '',
            pricePerUnit: Number(row.price) || 0,
            unitsPerBox: Math.max(1, Number(row.units_per_box) || 6),
          };
        });

      // Primer render rápido: traer solamente 24 productos con imagen.
      const { data: initialRows, error: initialError } = await supabase
        .from('products')
        .select(productSelect)
        .eq('enabled', true)
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .order('name', { ascending: true })
        .limit(24);

      if (initialError) {
        console.error(initialError);
      } else {
        setProducts(sortProductsImageFirst(mapProducts(initialRows || [])));
      }

      setLoading(false);

      // Completar todos los productos en segundo plano para conservar filtros,
      // búsquedas y páginas por bodega/varietal sin bloquear la carga inicial.
      try {
        const rows: any[] = [];
        const pageSize = 500;

        for (let from = 0; ; from += pageSize) {
          const { data, error } = await supabase
            .from('products')
            .select(productSelect)
            .eq('enabled', true)
            .order('name', { ascending: true })
            .range(from, from + pageSize - 1);

          if (error) throw error;

          const batch = data || [];
          rows.push(...batch);

          if (batch.length < pageSize) break;
        }

        setProducts(sortProductsImageFirst(mapProducts(rows)));
      } catch (error) {
        console.error('No se pudo completar el catálogo en segundo plano:', error);
      }
    })();
  }, []);

  useEffect(() => {
    const updateHeader = () => setHeaderCompact(window.scrollY > 120);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    return () => window.removeEventListener('scroll', updateHeader);
  }, []);

  useEffect(() => {
    document.body.style.overflow =
      selected || cartOpen || menuOpen || drawer ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [selected, cartOpen, menuOpen, drawer]);

  const wineProducts = useMemo(
    () => products.filter((product) => isWineCategory(product.category)),
    [products],
  );

  const sparklingProducts = useMemo(
    () => products.filter((product) => isSparklingCategory(product.category)),
    [products],
  );

  const sparklingStyles = useMemo(
    () =>
      sortCatalogLabels(
        Array.from(
          new Set(
            sparklingProducts
              .map((product) => product.varietal)
              .filter(Boolean),
          ),
        ),
        preferredSparklingStyles,
      ),
    [sparklingProducts],
  );

  const wineries = useMemo(
    () =>
      Array.from(
        new Map(
          wineProducts
            .filter((product) => product.winery)
            .map((product) => [
              product.winerySlug || catalogSlug(product.winery),
              {
                name: product.winery,
                slug: product.winerySlug || catalogSlug(product.winery),
              },
            ]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [wineProducts],
  );

  const activeWinery = useMemo(() => {
    if (mode !== 'winery') return null;

    return (
      wineries.find((winery) => winery.slug === slug) ||
      wineries.find((winery) => catalogSlug(winery.name) === slug) ||
      null
    );
  }, [mode, slug, wineries]);

  const baseProducts = useMemo(() => {
    if (mode === 'all-wines') return wineProducts;

    if (mode === 'wine-varietal') {
      return wineProducts.filter((product) =>
        matchesCatalogSlug(product.varietal, slug),
      );
    }

    if (mode === 'sparkling') {
      return sparklingProducts.filter((product) =>
        matchesCatalogSlug(product.varietal || product.name, slug),
      );
    }

    return wineProducts.filter((product) => {
      const productSlug = product.winerySlug || catalogSlug(product.winery);
      return productSlug === slug || catalogSlug(product.winery) === slug;
    });
  }, [mode, slug, wineProducts, sparklingProducts]);

  const pageVarietals = useMemo(
    () =>
      sortCatalogLabels(
        Array.from(
          new Set(baseProducts.map((product) => product.varietal).filter(Boolean)),
        ),
        preferredWineVarietals,
      ),
    [baseProducts],
  );

  const pageWineries = useMemo(
    () =>
      Array.from(
        new Set(baseProducts.map((product) => product.winery).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [baseProducts],
  );

  const filtered = useMemo(() => {
    const search = normalizeCatalogText(query);

    const results=baseProducts.filter((product) => {
      const haystack = normalizeCatalogText(
        `${product.name} ${product.winery} ${product.varietal}`,
      );

      return (
        (!search || haystack.includes(search)) &&
        (!selectedWinery || product.winery === selectedWinery) &&
        (!selectedVarietal || product.varietal === selectedVarietal)
      );
    });

    return sortProductsImageFirst(results);
  }, [
    baseProducts,
    query,
    selectedWinery,
    selectedVarietal,
  ]);

  const pageTitle = useMemo(() => {
    if (mode === 'all-wines') return 'Todos los vinos';
    if (mode === 'winery') {
      return activeWinery?.name || titleFromCatalogSlug(slug);
    }
    return (
      baseProducts.find((product) =>
        matchesCatalogSlug(product.varietal, slug),
      )?.varietal || titleFromCatalogSlug(slug)
    );
  }, [mode, slug, activeWinery, baseProducts]);

  const pageEyebrow =
    mode === 'sparkling'
      ? 'Espumantes Dolce Vino'
      : mode === 'winery'
        ? 'Bodega'
        : 'Catálogo Dolce Vino';

  const pageDescription =
    mode === 'winery'
      ? 'Descubrí los vinos asociados a esta bodega y filtrá la selección por varietal.'
      : mode === 'sparkling'
        ? 'Explorá nuestra selección de espumantes y encontrá la etiqueta indicada para cada celebración.'
        : 'Explorá nuestra selección, filtrá por bodega o varietal y encontrá la etiqueta indicada para cada ocasión.';

  useEffect(() => {
    setVisibleCount(24);
  }, [mode, slug, query, selectedWinery, selectedVarietal]);

  const visibleProducts = filtered.slice(0, visibleCount);

  const addBox = (product: Product) => {
    const next = cart.some((item) => item.id === product.id)
      ? cart.map((item) =>
          item.id === product.id
            ? { ...item, boxes: item.boxes + 1, ...product }
            : item,
        )
      : [...cart, { ...product, boxes: 1 }];

    setCart(next as CartItem[]);
    saveCartToStorage(next as CartItem[]);
  };

  const cartCount = cart.reduce((sum, item) => sum + item.boxes, 0);
  const cartTotal = cart.reduce((sum, item) => {
    const linePrice = isEstucheProduct(item.name)
      ? item.pricePerUnit
      : item.pricePerUnit * item.unitsPerBox;
    return sum + linePrice * item.boxes;
  }, 0);

  const changeBoxes = (id: string, amount: number) => {
    const next = cart
      .map((item) =>
        item.id === id
          ? { ...item, boxes: Math.max(0, item.boxes + amount) }
          : item,
      )
      .filter((item) => item.boxes > 0);

    setCart(next);
    saveCartToStorage(next);
  };

  return (
    <main className="wine-listing-page">
      <header className={`site-header${headerCompact ? ' is-compact' : ''}`}>
        <div className="header-shell">
          <Link href="/" className="brand" aria-label="Dolce Vino - Inicio">
            <Image src="/assets/logo_dolce_vino.png" alt="Dolce Vino" width={108} height={108} priority />
          </Link>

          <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'}>
            <button
              type="button"
              className="mobile-nav-close"
              aria-label="Cerrar menú"
              onClick={() => {
                setMenuOpen(false);
                setDrawer('');
              }}
            >
              <X size={22} />
            </button>

            <button
              type="button"
              className="nav-dropdown-trigger"
              onClick={() => setDrawer(drawer === 'vinos' ? '' : 'vinos')}
            >
              Vinos <ChevronDown size={13} />
            </button>

            <button
              type="button"
              className="nav-dropdown-trigger"
              onClick={() =>
                setDrawer(drawer === 'espumantes' ? '' : 'espumantes')
              }
            >
              Espumantes <ChevronDown size={13} />
            </button>

            <button
              type="button"
              className="nav-dropdown-trigger"
              onClick={() => setDrawer(drawer === 'bodegas' ? '' : 'bodegas')}
            >
              Bodegas <ChevronDown size={13} />
            </button>

            <Link href="/#categorias">Categorías</Link>
            <Link href="/#colecciones">Colecciones</Link>
            <Link href="/#nosotros">Sobre nosotros</Link>

            <Link href="/admin" className="mobile-crm-link">
              <UserRound size={16} />
              Acceso al CRM
            </Link>
          </nav>

          <div className="header-actions">
            <button
              className="icon-action search-trigger"
              aria-label="Buscar"
              onClick={() => setHeaderSearchOpen((value) => !value)}
            >
              <Search size={19} />
            </button>

            <Link className="icon-action desktop-action" href="/admin">
              <UserRound size={19} />
            </Link>

            <button
              className="icon-action cart-trigger"
              aria-label="Pedido"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag size={19} />
              {cartCount > 0 && <span>{cartCount}</span>}
            </button>

            <button
              className="mobile-menu-button"
              aria-label="Abrir menú"
              onClick={() => {
                setMenuOpen((value) => !value);
                if (menuOpen) setDrawer('');
              }}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>

          {menuOpen && (
            <button
              className="mobile-nav-backdrop"
              aria-label="Cerrar menú"
              onClick={() => {
                setMenuOpen(false);
                setDrawer('');
              }}
            />
          )}

          <div
            className={`header-search-panel${headerSearchOpen ? ' is-open' : ''}`}
          >
            <Search size={18} />
            <input
              autoFocus={headerSearchOpen}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  document
                    .querySelector('.wine-listing-content')
                    ?.scrollIntoView({ behavior: 'smooth' });
                  setHeaderSearchOpen(false);
                }
              }}
              placeholder="Buscar vino, bodega o varietal"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      {drawer && (
        <>
          <button
            type="button"
            className="nav-drawer-backdrop"
            aria-label="Cerrar desplegable"
            onClick={() => setDrawer('')}
          />

          <aside className="nav-global-drawer" aria-label={`Menú ${drawer}`}>
            <div className="nav-drawer-head">
              <div>
                <span>Explorar</span>
                <strong>
                  {drawer === 'vinos'
                    ? 'Vinos'
                    : drawer === 'espumantes'
                      ? 'Espumantes'
                      : 'Bodegas'}
                </strong>
              </div>

              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setDrawer('')}
              >
                <X size={20} />
              </button>
            </div>

            <div
              className={`nav-drawer-list${
                drawer === 'bodegas' ? ' nav-drawer-list--wineries' : ''
              }`}
            >
              {drawer === 'vinos' &&
                publicWineMenuGroups.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/vinos/${item.slug}`}
                    onClick={() => {
                      setMenuOpen(false);
                      setDrawer('');
                    }}
                  >
                    {item.label}
                  </Link>
                ))}

              {drawer === 'espumantes' &&
                sparklingStyles.map((label) => (
                  <Link
                    key={label}
                    href={`/espumantes/${catalogSlug(label)}`}
                    onClick={() => {
                      setMenuOpen(false);
                      setDrawer('');
                    }}
                  >
                    {label}
                  </Link>
                ))}

              {drawer === 'bodegas' &&
                wineries.map((winery) => (
                  <Link
                    key={winery.slug}
                    href={`/bodegas/${winery.slug}`}
                    onClick={() => {
                      setMenuOpen(false);
                      setDrawer('');
                    }}
                  >
                    {winery.name}
                  </Link>
                ))}
            </div>
          </aside>
        </>
      )}

      <section className="wine-listing-hero">
        <div>
          <span>{pageEyebrow}</span>
          <h1>{pageTitle}</h1>
          <p>{pageDescription}</p>
        </div>
      </section>

      <section className="wine-listing-content">
        <div
          className={`wine-listing-toolbar${
            mode === 'winery' ? ' winery-only-toolbar' : ''
          }`}
        >
          {mode !== 'winery' && (
            <label className="catalog-search-field">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar vino, bodega o varietal"
              />
            </label>
          )}

          {mode !== 'winery' && pageWineries.length > 1 && (
            <FilterDropdown
              id="winery"
              value={selectedWinery}
              placeholder="Todas las bodegas"
              options={pageWineries}
              onChange={setSelectedWinery}
              openId={filterOpen}
              setOpenId={setFilterOpen}
            />
          )}

          <FilterDropdown
            id="varietal"
            value={selectedVarietal}
            placeholder="Todos los varietales"
            options={pageVarietals}
            onChange={setSelectedVarietal}
            openId={filterOpen}
            setOpenId={setFilterOpen}
          />

          {(query || selectedWinery || selectedVarietal) && (
            <button
              type="button"
              className="catalog-clear-filters"
              onClick={() => {
                setQuery('');
                setSelectedWinery('');
                setSelectedVarietal('');
                setFilterOpen('');
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <p className="wine-listing-count">
          {loading ? 'Cargando productos...' : `${filtered.length} productos encontrados`}
        </p>

        <div className="wine-listing-grid">
          {visibleProducts.map((product, index) => (
            <article className="catalog-product-card" key={product.id}>
              <div className="box-badge">
                <Package size={15} />
                <strong>
                  x
                  {isEstucheProduct(product.name, product.detail)
                    ? 1
                    : product.unitsPerBox}
                </strong>
              </div>

              <button
                className="product-card-open catalog-product-image"
                onClick={() => setSelected(product)}
              >
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(max-width: 700px) 50vw, (max-width: 1200px) 33vw, 20vw"
                    priority={index < 4}
                  />
                ) : (
                  <div className="image-empty-state">
                    <Package />
                    <span>Sin imagen</span>
                  </div>
                )}
              </button>

              <div className="catalog-product-info">
                <button
                  className="product-title-button"
                  onClick={() => setSelected(product)}
                >
                  <h3>{product.name}</h3>
                </button>

                {product.winery && (
                  <Link
                    className="featured-wine-winery"
                    href={`/bodegas/${product.winerySlug}`}
                  >
                    {product.winery}
                  </Link>
                )}

                <div className="featured-price">
                  {formatPrice(product.pricePerUnit)}
                  {!isEstucheProduct(product.name, product.detail) && (
                    <small>c/botella</small>
                  )}
                </div>

                <button
                  className="add-box-button"
                  onClick={() => addBox(product)}
                >
                  {isEstucheProduct(product.name, product.detail)
                    ? 'Agregar estuche'
                    : 'Agregar caja'}
                </button>
              </div>
            </article>
          ))}
        </div>

        {visibleProducts.length < filtered.length && (
          <div className="catalog-load-more-wrap">
            <button
              type="button"
              className="catalog-load-more"
              onClick={() => setVisibleCount((current) => current + 24)}
            >
              Ver más productos
            </button>
          </div>
        )}

        {!loading && !filtered.length && (
          <div className="catalog-empty-results">
            No encontramos productos para esta selección.
          </div>
        )}
      </section>

      <div
        className={cartOpen ? 'cart-overlay is-open' : 'cart-overlay'}
        onClick={() => setCartOpen(false)}
      />

      <aside
        className={cartOpen ? 'cart-drawer is-open' : 'cart-drawer'}
        aria-label="Tu pedido"
      >
        <div className="cart-head">
          <div>
            <span>Dolce Vino</span>
            <h2>Tu pedido</h2>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label="Cerrar pedido"
          >
            <X />
          </button>
        </div>

        <div className="cart-items">
          {!cart.length && (
            <p className="empty-cart">Todavía no agregaste cajas.</p>
          )}

          {cart.map((item) => {
            const estuche = isEstucheProduct(item.name);
            const lineTotal =
              (estuche
                ? item.pricePerUnit
                : item.pricePerUnit * item.unitsPerBox) * item.boxes;

            return (
              <article className="cart-item" key={item.id}>
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={68}
                    height={92}
                    sizes="68px"
                  />
                ) : (
                  <div className="cart-image-empty">
                    <Package size={20} />
                  </div>
                )}

                <div>
                  <h3>{item.name}</h3>
                  <p>
                    {estuche
                      ? '1 estuche por unidad'
                      : `${item.unitsPerBox} botellas por caja`}
                  </p>
                  <strong>{formatPrice(lineTotal)}</strong>
                </div>

                <div className="cart-qty">
                  <button onClick={() => changeBoxes(item.id, -1)}>
                    <Minus size={14} />
                  </button>
                  <span>{item.boxes}</span>
                  <button onClick={() => changeBoxes(item.id, 1)}>
                    <Plus size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="cart-footer">
          <div>
            <span>Total estimado</span>
            <strong>{formatPrice(cartTotal)}</strong>
          </div>
          <button disabled={!cart.length}>Solicitar pedido</button>
        </div>
      </aside>

      {selected && (
        <div
          className="product-detail-backdrop"
          onMouseDown={() => setSelected(null)}
        >
          <section
            className="product-detail-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="product-detail-close"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>

            <div className="product-detail-image">
              {selected.image ? (
                <Image
                  src={selected.image}
                  alt={selected.name}
                  fill
                  sizes="(max-width: 700px) 92vw, 44vw"
                  priority
                />
              ) : (
                <div className="image-empty-state">
                  <Package size={48} />
                  <span>Sin imagen</span>
                </div>
              )}
            </div>

            <div className="product-detail-copy">
              <span className="product-detail-eyebrow">
                {selected.varietal || 'Selección Dolce Vino'}
              </span>
              <h2>{selected.name}</h2>

              {selected.winery && (
                <Link
                  className="product-detail-winery"
                  href={`/bodegas/${selected.winerySlug}`}
                  onClick={() => setSelected(null)}
                >
                  {selected.winery}
                </Link>
              )}

              <p className="product-detail-description">
                {selected.description ||
                  'Una etiqueta seleccionada por Dolce Vino para disfrutar y compartir.'}
              </p>

              <div className="product-detail-meta">
                <strong>{formatPrice(selected.pricePerUnit)}</strong>
                <span>
                  {isEstucheProduct(selected.name, selected.detail)
                    ? 'Precio total del estuche'
                    : 'Compra mínima: caja cerrada'}
                </span>
              </div>

              <button
                className="product-detail-add"
                onClick={() => {
                  const product = selected;
                  setSelected(null);
                  addBox(product);
                  setCartOpen(true);
                }}
              >
                {isEstucheProduct(selected.name, selected.detail)
                  ? 'Agregar estuche'
                  : 'Agregar caja'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
