'use client';

import Link from 'next/link';
import { Menu, Search, UserRound, ShoppingBag, X, Package, Minus, Plus, ChevronDown, ChevronRight, MessageCircle, Truck, ShieldCheck, Sparkles, Globe2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatPrice, getCartFromStorage, saveCartToStorage, type CartItem, type FeaturedWine } from '@/lib/featuredWines';
import { createClient } from '@/lib/supabase/client';

const fallbackHeroSlides = [
  { eyebrow:'Pasión · tradición · excelencia', title:'Vinos que cuentan historias únicas', description:'Una selección cuidada de vinos y etiquetas elegidas para quienes valoran cada detalle.', cta:'Descubrir selección', desktopImage:'', mobileImage:'' },
  { eyebrow:'Momentos extraordinarios', title:'Vinos, espumantes y delicatessen', description:'Una experiencia selecta para regalar, descubrir y disfrutar.', cta:'Explorar categorías', desktopImage:'', mobileImage:'' },
  { eyebrow:'Selección privada', title:'Etiquetas icónicas, curadas para vos', description:'Descubrí bodegas, varietales y colecciones elegidas con criterio experto.', cta:'Ver colección', desktopImage:'', mobileImage:'' },
];

type PublicBanner = {
  id?: string;
  type: 'hero' | 'middle';
  title: string;
  subtitle: string;
  desktop_image_url: string;
  mobile_image_url: string;
  enabled: boolean;
  sort_order: number;
};

const categoryCards = [
  { title:'Vinos', action:'Ver selección', href:'#vinos' },
  { title:'Espumantes', action:'Ver colección', href:'#catalogo' },
  { title:'Delicatessen', action:'Ver productos', href:'#catalogo' },
  { title:'Destilados', action:'Ver colección', href:'#catalogo' },
];

const serviceBenefits = [
  { icon:Truck, title:'Envíos a todo el país', description:'Envíos seguros y garantizados' },
  { icon:ShieldCheck, title:'Pagos 100% seguros', description:'Protegemos tu información' },
  { icon:Sparkles, title:'Experiencia premium', description:'Curaduría y asesoramiento experto' },
  { icon:Globe2, title:'Miembro exclusivo', description:'Beneficios y experiencias únicas' },
];

const normalizeLabel=(value:string)=>value
  .toLocaleLowerCase('es-AR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,' ')
  .trim();

const isEstucheProduct=(...values:Array<string|undefined|null>)=>/\bestuche\b/.test(normalizeLabel(values.filter(Boolean).join(' ')));

const inferUnitsPerBox=(...values:Array<string|undefined|null>)=>{
  const text=normalizeLabel(values.filter(Boolean).join(' '));
  if(/\bestuche\b/.test(text)) return 1;
  const patterns=[
    /\b(?:caja|estuche|pack|mix|set)\s*(?:de\s*)?x?\s*(\d{1,2})\b/,
    /\b(\d{1,2})\s*x\s*\d{3,4}\s*(?:ml|cc)\b/,
    /\bx\s*(\d{1,2})\b/,
    /\b(\d{1,2})\s*(?:botellas|unidades)\b/,
  ];
  for(const pattern of patterns){
    const match=text.match(pattern);
    const units=match?Number(match[1]):0;
    if(units>=1&&units<=24) return units;
  }
  return 6;
};

const shuffleProducts=<T,>(items:T[])=>{
  const copy=[...items];
  for(let index=copy.length-1;index>0;index--){
    const swap=Math.floor(Math.random()*(index+1));
    [copy[index],copy[swap]]=[copy[swap],copy[index]];
  }
  return copy;
};

const wineGroups:Record<string,string[]> = {
  'Malbec':['malbec','malbec organico','malbec fortificado','malbec rose','blanc de malbec','noir de malbec'],
  'Cabernet':['cabernet sauvignon','cabernet franc','carmenere'],
  'Blend':['blend','red blend','corte de autor','assamblage','assemblage','mix varietales','mix de varietales'],
  'Dulces':['dulce','dulce natural','chardonnay dulce','chenin dulce','moscatel dulce','sauvignon blanc dulce','cosecha tardia blanco','cosecha tardia tinto'],
  'Blancos':['chardonnay','sauvignon blanc','chenin','torrontes','semillon','riesling','viognier','gewurztraminer','albarino'],
  'Tintos':['bonarda','merlot','pinot noir','syrah','tempranillo','petit verdot','sangiovese','ancellotta'],
  'Rosados':['rose','rosado'],
};

const sparklingGroups:Record<string,string[]> = {
  'Nature':['nature','brut nature'],
  'Extra Brut':['extra brut','extra brut rose'],
  'Brut':['brut','brut rose'],
  'Demi Sec':['demi sec'],
  'Espumantes':['espumante','espumantes','champenoise','pet nat'],
};

const categoryGroups:Record<string,string[]> = {
  'Destilados':['destilado','destilados','whisky','whiskey','gin','vodka','ron','licor','aperitivo','vermut','vermouth','tequila','cognac','brandy','pisco'],
  'Delicatessen':['delicatessen','delice'],
  'Cristalería':['cristaleria','copa cerveza','copa vino','vaso'],
  'Pimienta':['pimienta'],
  'Aceites':['aceite','aceite de oliva'],
  'Condimentos':['condimento','especia'],
  'Accesorios varios':['accesorio','cuchara tenedor','sacacorchos','estuche especial'],
  'Otros':['otros'],
};

const hiddenPublicWineries=['alma del sur','deposito','dolce vino'];

const cleanWineryName=(value:string)=>value
  .replace(/\s+(s\.?\s*a\.?|s\.?\s*r\.?\s*l\.?|s\.?\s*a\.?\s*s\.?)$/i,'')
  .replace(/\s{2,}/g,' ')
  .trim();

type PublicProduct = FeaturedWine & {
  category: string;
  sourceCategory: string;
  brand: string;
  description: string;
};

type ModalState =
  | { type:'group'; value:string; terms:string[]; eyebrow:string }
  | { type:'winery'; value:string }
  | null;

const isWineProduct=(product:PublicProduct)=>{
  const category=normalizeLabel(`${product.category} ${product.sourceCategory}`);
  return category.includes('vino') && !category.includes('espumante');
};

export default function Home() {
  const [activeSlide,setActiveSlide] = useState(0);
  const [menuOpen,setMenuOpen] = useState(false);
  const [mobileDropdown,setMobileDropdown] = useState('');
  const [wines,setWines] = useState<PublicProduct[]>([]);
  const [catalogLoading,setCatalogLoading] = useState(true);
  const [catalogError,setCatalogError] = useState('');
  const [featuredWineries,setFeaturedWineries] = useState<Array<{name:string;image:string}>>([]);
  const [cart,setCart] = useState<CartItem[]>([]);
  const [cartOpen,setCartOpen] = useState(false);
  const [modal,setModal] = useState<ModalState>(null);
  const [selectedProduct,setSelectedProduct] = useState<PublicProduct|null>(null);
  const [visibleWineCount,setVisibleWineCount] = useState(10);
  const [catalogQuery,setCatalogQuery] = useState('');
  const [catalogVarietal,setCatalogVarietal] = useState('');
  const [headerCompact,setHeaderCompact] = useState(false);
  const [headerSearchOpen,setHeaderSearchOpen] = useState(false);
  const [catalogPdfUrl,setCatalogPdfUrl] = useState('/catalogo.pdf');
  const [heroBanners,setHeroBanners] = useState(fallbackHeroSlides);
  const [middleBanner,setMiddleBanner] = useState<PublicBanner|null>(null);

  useEffect(() => {
    const supabase=createClient();
    let cancelled=false;

    const loadCatalogPdf=async()=>{
      const {data,error}=await supabase
        .from('site_settings')
        .select('key,value')
        .in('key',['generated_catalog_pdf','catalog_pdf']);

      if(error){
        console.error('No se pudo cargar la URL del catálogo:',error);
        return;
      }

      const generated=(data||[]).find((row:any)=>row.key==='generated_catalog_pdf')?.value?.url;
      const manual=(data||[]).find((row:any)=>row.key==='catalog_pdf')?.value?.url;
      if(!cancelled) setCatalogPdfUrl(generated||manual||'/catalogo.pdf');
    };

    void loadCatalogPdf();

    const loadCatalog=async()=>{
      setCatalogLoading(true);
      setCatalogError('');
      try{
        const rows:any[]=[];
        const pageSize=750;
        for(let from=0;;from+=pageSize){
          const {data,error}=await supabase
            .from('products')
            .select('id,name,article_name,description,price,units_per_box,image_url,featured,featured_order,enabled,source_category,categories(name),brands(name),wineries(name),varietals(name)')
            .eq('enabled',true)
            .order('name',{ascending:true})
            .range(from,from+pageSize-1);
          if(error) throw error;
          const batch=data||[];
          rows.push(...batch);
          if(batch.length<pageSize) break;
        }

        const {data:wineryRows,error:wineryError}=await supabase
          .from('wineries')
          .select('name,logo_url,featured,enabled,sort_order')
          .eq('enabled',true)
          .eq('featured',true)
          .order('sort_order',{ascending:true})
          .limit(6);
        if(wineryError) throw wineryError;

        const {data:bannerRows,error:bannerError}=await supabase
          .from('site_banners')
          .select('id,type,title,subtitle,desktop_image_url,mobile_image_url,enabled,sort_order')
          .eq('enabled',true)
          .in('type',['hero','middle'])
          .order('sort_order',{ascending:true});
        if(bannerError) throw bannerError;

        const mapped:PublicProduct[]=rows.map((row:any,index)=>({
          id:row.id,
          name:(row.article_name||row.name||'Producto sin nombre').trim(),
          detail:row.article_name&&row.article_name!==row.name?row.name:undefined,
          winery:(row.wineries?.name||'').trim(),
          brand:(row.brands?.name||'').trim(),
          varietal:(row.varietals?.name||row.categories?.name||'Otros').trim(),
          image:row.image_url||'',
          featured:!!row.featured,
          order:Number(row.featured_order)||index+1,
          pricePerUnit:Number(row.price)||0,
          unitsPerBox:Math.max(1,Number(row.units_per_box)||inferUnitsPerBox(row.article_name,row.name)),
          category:(row.categories?.name||'').trim(),
          sourceCategory:(row.source_category||'').trim(),
          description:(row.description||'').trim(),
        }));

        if(!cancelled){
          setWines(shuffleProducts(mapped));
          setFeaturedWineries((wineryRows||[])
            .filter((w:any)=>!hiddenPublicWineries.includes(normalizeLabel(w.name||'')))
            .map((w:any)=>({name:cleanWineryName(w.name),image:w.logo_url||''})));

          const publicHeroBanners=(bannerRows||[])
            .filter((banner:any)=>banner.type==='hero'&&banner.desktop_image_url)
            .slice(0,3)
            .map((banner:any,index)=>({
              eyebrow:(banner.subtitle||'').trim(),
              title:(banner.title||'').trim(),
              description:'',
              cta:'',
              desktopImage:banner.desktop_image_url||'',
              mobileImage:banner.mobile_image_url||banner.desktop_image_url||'',
              key:banner.id||`hero-${index}`,
            }));

          setHeroBanners(publicHeroBanners.length?publicHeroBanners:fallbackHeroSlides);
          setMiddleBanner(
            ((bannerRows||[]).find((banner:any)=>banner.type==='middle'&&banner.desktop_image_url)||null) as PublicBanner|null,
          );
        }
      }catch(error:any){
        console.error('No se pudo cargar el catálogo público:',error);
        if(!cancelled){
          setCatalogError(error?.message||'No se pudo cargar el catálogo.');
          setWines([]);
          setFeaturedWineries([]);
        }
      }finally{
        if(!cancelled) setCatalogLoading(false);
      }
    };

    const syncCart=()=>setCart(getCartFromStorage());
    syncCart();
    loadCatalog();
    window.addEventListener('dolce-vino-cart-updated',syncCart);
    return()=>{
      cancelled=true;
      window.removeEventListener('dolce-vino-cart-updated',syncCart);
    };
  },[]);


  useEffect(()=>{
    const updateHeader=()=>setHeaderCompact(window.scrollY>120);
    updateHeader();
    window.addEventListener('scroll',updateHeader,{passive:true});
    return()=>window.removeEventListener('scroll',updateHeader);
  },[]);

  useEffect(()=>{
    setActiveSlide(0);
    if(heroBanners.length<=1) return;
    const timer=window.setInterval(
      ()=>setActiveSlide(value=>(value+1)%heroBanners.length),
      6500,
    );
    return()=>window.clearInterval(timer);
  },[heroBanners.length]);

  useEffect(()=>{
    document.body.style.overflow=(modal||selectedProduct||cartOpen)?'hidden':'';
    return()=>{document.body.style.overflow='';};
  },[modal,selectedProduct,cartOpen]);

  const wineCatalog=useMemo(()=>wines.filter(isWineProduct),[wines]);
  const featuredWines=useMemo(()=>{
    const selected=wineCatalog.filter(w=>w.featured).sort((a,b)=>a.order-b.order);
    return (selected.length?selected:wineCatalog).slice(0,5);
  },[wineCatalog]);
  const wineryNames=useMemo(()=>Array.from(new Set(
    wineCatalog
      .map(w=>cleanWineryName(w.winery))
      .filter(Boolean)
  ))
    .filter(name=>!hiddenPublicWineries.includes(normalizeLabel(name)))
    .sort((a,b)=>a.localeCompare(b,'es')),[wineCatalog]);

  const modalWines=useMemo(()=>{
    if(!modal) return [];
    if(modal.type==='winery') return wineCatalog.filter(
      w=>normalizeLabel(cleanWineryName(w.winery))===normalizeLabel(modal.value)
    );
    const terms=modal.terms.map(normalizeLabel);
    return wines.filter(w=>{
      const haystack=`${normalizeLabel(w.varietal)} ${normalizeLabel(w.name)} ${normalizeLabel(w.category)} ${normalizeLabel(w.sourceCategory)}`;
      const termMatch=terms.some(term=>haystack.includes(term));
      if(!termMatch) return false;
      if(modal.eyebrow==='Vinos') return isWineProduct(w);
      if(modal.eyebrow==='Espumantes') return /espumante|brut|nature|demi sec|pet nat|champenoise/.test(haystack);
      if(modal.eyebrow==='Categoría'){
        const databaseCategory=normalizeLabel(`${w.category} ${w.sourceCategory}`);
        if(modal.value==='Destilados'){
          return /destilado|whisky|whiskey|gin|vodka|ron|licor|aperitivo|vermut|vermouth|tequila|cognac|brandy|pisco/.test(databaseCategory)
            || /destilado|whisky|whiskey|gin|vodka|ron|licor|aperitivo|vermut|vermouth|tequila|cognac|brandy|pisco/.test(haystack);
        }
        return termMatch;
      }
      return true;
    });
  },[modal,wines]);

  const catalogVarietals=useMemo(()=>Array.from(new Set(wineCatalog.map(w=>w.varietal).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es')),[wineCatalog]);
  const filteredWineCatalog=useMemo(()=>{
    const query=normalizeLabel(catalogQuery);
    const selectedVarietal=normalizeLabel(catalogVarietal);
    return wineCatalog.filter(wine=>{
      const matchesVarietal=!selectedVarietal||normalizeLabel(wine.varietal)===selectedVarietal;
      const haystack=normalizeLabel(`${wine.name} ${wine.brand} ${wine.winery} ${wine.varietal}`);
      return matchesVarietal&&(!query||haystack.includes(query));
    });
  },[wineCatalog,catalogQuery,catalogVarietal]);

  useEffect(()=>{setVisibleWineCount(10)},[catalogQuery,catalogVarietal]);

  const visibleCatalog=filteredWineCatalog.slice(0,visibleWineCount);
  const hasMoreWines=visibleWineCount<filteredWineCatalog.length;
  const showNextWines=()=>setVisibleWineCount(current=>Math.min(current+5,filteredWineCatalog.length));

  const cartBoxes=cart.reduce((t,i)=>t+i.boxes,0);
  const cartTotal=cart.reduce((total,item)=>{
    const isEstuche=isEstucheProduct(item.name,item.detail);
    return total+(isEstuche?item.pricePerUnit:item.pricePerUnit*item.unitsPerBox)*item.boxes;
  },0);
  const addBox=(wine:FeaturedWine)=>{
    const next=cart.some(i=>i.id===wine.id)?cart.map(i=>i.id===wine.id?{...i,boxes:i.boxes+1,...wine}:i):[...cart,{...wine,boxes:1}];
    setCart(next); saveCartToStorage(next); setCartOpen(true);
  };
  const changeBoxes=(id:string,amount:number)=>{
    const next=cart.map(i=>i.id===id?{...i,boxes:Math.max(0,i.boxes+amount)}:i).filter(i=>i.boxes>0);
    setCart(next); saveCartToStorage(next);
  };

  const openGroup=(value:string,terms:string[],eyebrow:string)=>{setModal({type:'group',value,terms,eyebrow});setMenuOpen(false);};
  const openWinery=(value:string)=>{setModal({type:'winery',value});setMenuOpen(false);};

  const ProductCard=({wine,compact=false}:{wine:PublicProduct;compact?:boolean})=>{
    const isEstuche=isEstucheProduct(wine.name,wine.detail);
    return <article className={compact?'catalog-product-card':'featured-wine-card'}>
      <div className="box-badge" aria-label={isEstuche?'Estuche, una unidad comercial':`Caja de ${wine.unitsPerBox} botellas`}><Package size={15}/><strong>x{isEstuche?1:wine.unitsPerBox}</strong></div>
      <button type="button" className={`product-card-open ${compact?'catalog-product-image':'featured-bottle'}`} onClick={()=>setSelectedProduct(wine)} aria-label={`Ver detalle de ${wine.name}`}>{wine.image?<img src={wine.image} alt={`${wine.winery} ${wine.name}`} loading="lazy"/>:<div className="image-empty-state"><Package size={34}/><span>Sin imagen</span></div>}</button>
      <div className={compact?'catalog-product-info':'featured-wine-copy'}>
        <button type="button" className="product-title-button" onClick={()=>setSelectedProduct(wine)}><h3>{wine.name}</h3></button>
        {wine.winery&&<p className="featured-wine-winery">{cleanWineryName(wine.winery)}</p>}
        <div className="featured-price">{formatPrice(wine.pricePerUnit)} {!isEstuche&&<small>c/botella</small>}</div>
        <button className="add-box-button" onClick={()=>addBox(wine)}>{isEstuche?'Agregar estuche':'Agregar caja'}</button>
      </div>
    </article>;
  };

  return <main className="home-page">
    <header className={`site-header${headerCompact?' is-compact':''}`}><div className="header-shell">
      <Link href="/" className="brand" aria-label="Dolce Vino - Inicio">
        <img src="/assets/logo_dolce_vino.png" alt="Dolce Vino" />
      </Link>
      <nav className={menuOpen?'main-nav is-open':'main-nav'} aria-label="Navegación principal">
        <button
          type="button"
          className="mobile-nav-close"
          aria-label="Cerrar menú"
          onClick={()=>{setMenuOpen(false);setMobileDropdown('')}}
        >
          <X size={22}/>
        </button>
        <div className="nav-dropdown">
          <button className="nav-dropdown-trigger" onClick={()=>setMobileDropdown(value=>value==='vinos'?'':'vinos')}>Vinos <ChevronDown size={13}/></button>
          <div className={`nav-dropdown-panel grouped-menu-panel${mobileDropdown==='vinos'?' is-mobile-open':''}`}>{Object.entries(wineGroups).map(([label])=><Link key={label} href={`/vinos?grupo=${encodeURIComponent(label)}`} onClick={()=>{setMenuOpen(false);setMobileDropdown('')}}>{label}</Link>)}</div>
        </div>
        <div className="nav-dropdown">
          <button className="nav-dropdown-trigger" onClick={()=>setMobileDropdown(value=>value==='espumantes'?'':'espumantes')}>Espumantes <ChevronDown size={13}/></button>
          <div className={`nav-dropdown-panel grouped-menu-panel${mobileDropdown==='espumantes'?' is-mobile-open':''}`}>{Object.entries(sparklingGroups).map(([label,terms])=><button key={label} onClick={()=>{openGroup(label,terms,'Espumantes');setMenuOpen(false);setMobileDropdown('')}}>{label}</button>)}</div>
        </div>
        <div className="nav-dropdown">
          <button className="nav-dropdown-trigger" onClick={()=>setMobileDropdown(value=>value==='bodegas'?'':'bodegas')}>Bodegas <ChevronDown size={13}/></button>
          <div className={`nav-dropdown-panel winery-panel${mobileDropdown==='bodegas'?' is-mobile-open':''}`}>{wineryNames.map(w=><button key={w} onClick={()=>{openWinery(w);setMenuOpen(false);setMobileDropdown('')}}>{w}</button>)}</div>
        </div>
        <div className="nav-dropdown">
          <button className="nav-dropdown-trigger" onClick={()=>setMobileDropdown(value=>value==='categorias'?'':'categorias')}>Categorías <ChevronDown size={13}/></button>
          <div className={`nav-dropdown-panel category-menu-panel${mobileDropdown==='categorias'?' is-mobile-open':''}`}>{Object.entries(categoryGroups).map(([label,terms])=><button key={label} onClick={()=>{openGroup(label,terms,'Categoría');setMenuOpen(false);setMobileDropdown('')}}>{label}</button>)}</div>
        </div>
        <a href="#colecciones" onClick={()=>{setMenuOpen(false);setMobileDropdown('')}}>Colecciones</a>
        <a href="#nosotros" onClick={()=>{setMenuOpen(false);setMobileDropdown('')}}>Sobre nosotros</a>
        <Link href="/admin" className="mobile-crm-link" onClick={()=>{setMenuOpen(false);setMobileDropdown('')}}>
          <UserRound size={16}/>
          Acceso al CRM
        </Link>
      </nav>
      <div className="header-actions">
        <button className="icon-action search-trigger" aria-label="Buscar" onClick={()=>setHeaderSearchOpen(value=>!value)}><Search size={19}/></button>
        <Link className="icon-action desktop-action" href="/admin" aria-label="Mi cuenta"><UserRound size={19}/></Link>
        <button className="icon-action cart-trigger" aria-label="Pedido" onClick={()=>setCartOpen(true)}><ShoppingBag size={19}/>{cartBoxes>0&&<span>{cartBoxes}</span>}</button>
        <a className="catalog-button" href="#catalogo">Catálogo</a>
        <button className="mobile-menu-button" aria-label="Abrir menú" onClick={()=>{setMenuOpen(v=>!v);if(menuOpen)setMobileDropdown('')}}>{menuOpen?<X/>:<Menu/>}</button>
      </div>
      {menuOpen&&<button className="mobile-nav-backdrop" aria-label="Cerrar menú" onClick={()=>{setMenuOpen(false);setMobileDropdown('')}}/>}
      <div className={`header-search-panel${headerSearchOpen?' is-open':''}`}>
        <Search size={18}/>
        <input
          autoFocus={headerSearchOpen}
          value={catalogQuery}
          onChange={event=>setCatalogQuery(event.target.value)}
          onKeyDown={event=>{if(event.key==='Enter'){document.getElementById('nuestros-vinos')?.scrollIntoView({behavior:'smooth'});setHeaderSearchOpen(false);}}}
          placeholder="Buscar vino, bodega o varietal"
        />
        {catalogQuery&&<button type="button" onClick={()=>setCatalogQuery('')} aria-label="Limpiar búsqueda"><X size={16}/></button>}
      </div>
    </div></header>

    <section id="inicio" className="hero">
      {heroBanners.map((slide,index)=><div
        key={(slide as any).key||slide.desktopImage||slide.title||index}
        className={`hero-slide hero-slide--${index+1} ${index===activeSlide?'is-active':''}`}
      >
        {slide.desktopImage&&<picture className="hero-banner-picture">
          <source media="(max-width: 700px)" srcSet={slide.mobileImage||slide.desktopImage}/>
          <img src={slide.desktopImage} alt={slide.title||`Banner Dolce Vino ${index+1}`}/>
        </picture>}
      </div>)}
      <div className="hero-shade"/>
      {(heroBanners[activeSlide]?.title||heroBanners[activeSlide]?.eyebrow)&&<div className="hero-inner">
        <div className="hero-copy" key={activeSlide}>
          {heroBanners[activeSlide]?.eyebrow&&<p className="hero-eyebrow">{heroBanners[activeSlide].eyebrow}</p>}
          {heroBanners[activeSlide]?.title&&<h1>{heroBanners[activeSlide].title}</h1>}
          {heroBanners[activeSlide]?.description&&<p className="hero-description">{heroBanners[activeSlide].description}</p>}
          {heroBanners[activeSlide]?.cta&&<a href="#vinos" className="hero-button">{heroBanners[activeSlide].cta}</a>}
        </div>
      </div>}
    </section>

    <section id="bodegas" className="prestige-strip"><div className="prestige-inner"><div className="featured-section-title"><span/><h2>Bodegas destacadas</h2><span/></div><div className="winery-marks">{featuredWineries.length?featuredWineries.map(w=><article className="winery-mark" key={w.name}>{w.image?<img className="winery-logo" src={w.image} alt={`Logo de ${w.name}`}/>:<span className="winery-name-fallback">{w.name}</span>}</article>):<p className="public-empty-message">Las bodegas destacadas se administran desde el CRM.</p>}</div></div></section>

    <section id="vinos" className="featured-wines-section"><div className="featured-section-title"><span/><h2>Vinos destacados</h2><span/></div>{catalogLoading?<p className="catalog-state">Cargando catálogo...</p>:<div className="featured-wines-grid">{featuredWines.map(w=><ProductCard key={w.id} wine={w}/>)}</div>}{catalogError&&<p className="catalog-warning">Se mostró un catálogo de respaldo porque Supabase respondió: {catalogError}</p>}</section>

    <section
      id="catalogo"
      className={`premium-banner${middleBanner?.desktop_image_url?' premium-banner--uploaded':''}`}
    >
      {middleBanner?.desktop_image_url&&<picture className="premium-banner-picture">
        <source media="(max-width: 700px)" srcSet={middleBanner.mobile_image_url||middleBanner.desktop_image_url}/>
        <img src={middleBanner.desktop_image_url} alt={middleBanner.title||'Descargar catálogo Dolce Vino'}/>
      </picture>}
      <div className="premium-banner-shade"/>
      {(middleBanner?.title||middleBanner?.subtitle||!middleBanner?.desktop_image_url)&&<div className="premium-banner-copy">
        <span>Selección Dolce Vino</span>
        <h2>{middleBanner?.title||'Vinos de alta gama para momentos únicos'}</h2>
        <p>{middleBanner?.subtitle||'Etiquetas seleccionadas de bodegas destacadas, reunidas en un catálogo pensado para descubrir, elegir y compartir.'}</p>
        <a href={catalogPdfUrl} target="_blank" rel="noreferrer" download>Descargar catálogo actual</a>
      </div>}
      {middleBanner?.desktop_image_url&&!middleBanner.title&&!middleBanner.subtitle&&
        <a
          className="premium-banner-full-link"
          href={catalogPdfUrl}
          target="_blank"
          rel="noreferrer"
          download
          aria-label="Descargar catálogo actual"
        />
      }
    </section>

    <section id="nuestros-vinos" className="catalog-grid-section"><div className="featured-section-title"><span/><h2>Nuestros vinos</h2><span/></div><div className="catalog-inline-filters"><label><Search size={17}/><input value={catalogQuery} onChange={event=>setCatalogQuery(event.target.value)} placeholder="Buscar vino o bodega"/></label><select value={catalogVarietal} onChange={event=>setCatalogVarietal(event.target.value)}><option value="">Todos los varietales</option>{catalogVarietals.map(varietal=><option key={varietal} value={varietal}>{varietal}</option>)}</select>{(catalogQuery||catalogVarietal)&&<button type="button" onClick={()=>{setCatalogQuery('');setCatalogVarietal('')}}>Limpiar filtros</button>}</div>{catalogLoading?<p className="catalog-state">Cargando productos desde Supabase...</p>:visibleCatalog.length?<><p className="catalog-results-count">{filteredWineCatalog.length} vinos encontrados</p><div className="catalog-products-grid">{visibleCatalog.map(w=><ProductCard key={w.id} wine={w} compact/>)}</div>{hasMoreWines&&<button className="show-more-button" onClick={showNextWines}>Ver más vinos</button>}</>:<p className="catalog-state">No encontramos vinos con esos filtros.</p>}</section>

    <section className="post-catalog-cta" aria-label="Categorías y servicios Dolce Vino">
      <div className="post-catalog-cta-shell">
        <div id="categorias" className="category-grid">
          {categoryCards.map((card)=><a key={card.title} href={card.href} className="category-card">
            <div>
              <h3>{card.title}</h3>
              <span>{card.action} <ChevronRight size={12}/></span>
            </div>
          </a>)}
        </div>

        <div className="cta-strip-grid">
          <a href="/catalogo.pdf" download className="cta-strip-card cta-strip-card--catalog">
            <div className="cta-strip-book" aria-hidden="true">
              <span>DOLCE VINO</span>
            </div>
            <div className="cta-strip-copy">
              <small>Descargá nuestro catálogo</small>
              <h3>Edición 2024</h3>
              <p>Una selección exclusiva, detallada para los verdaderos amantes del vino.</p>
            </div>
            <div className="cta-strip-action">
              <span>Descargar catálogo</span>
              <ChevronRight size={16}/>
            </div>
          </a>

          <a href="https://wa.me/5490000000000" className="cta-strip-card cta-strip-card--whatsapp" target="_blank" rel="noreferrer">
            <div className="cta-strip-icon" aria-hidden="true"><MessageCircle size={34}/></div>
            <div className="cta-strip-copy">
              <small>Atención personalizada por WhatsApp</small>
              <p>Nuestro equipo de expertos está listo para asesorarte en tu próxima elección.</p>
            </div>
            <div className="cta-strip-action cta-strip-action--button">
              <span>Escribir por WhatsApp</span>
            </div>
          </a>
        </div>

        <div className="benefits-strip">
          {serviceBenefits.map((benefit)=><article key={benefit.title} className="benefit-item">
            <benefit.icon size={18}/>
            <div>
              <h4>{benefit.title}</h4>
              <p>{benefit.description}</p>
            </div>
          </article>)}
        </div>
      </div>
    </section>

    {modal&&<div className="catalog-modal-backdrop" onMouseDown={()=>setModal(null)}><section className="catalog-modal catalog-modal--compact" onMouseDown={e=>e.stopPropagation()}>
      <button className="modal-close" onClick={()=>setModal(null)}><X/></button>
      <div className="modal-title"><span>{modal.type==='winery'?'Bodega':modal.eyebrow}</span><h2>{modal.value}</h2></div>
      {modalWines.length?<div className="modal-products-grid">{modalWines.map(w=><ProductCard key={w.id} wine={w} compact/>)}</div>:<p className="modal-empty">Todavía no hay productos visibles en esta selección.</p>}
    </section></div>}


    {selectedProduct&&<div className="product-detail-backdrop" onMouseDown={()=>setSelectedProduct(null)}>
      <section className="product-detail-modal" onMouseDown={event=>event.stopPropagation()}>
        <button type="button" className="product-detail-close" onClick={()=>setSelectedProduct(null)} aria-label="Cerrar detalle"><X/></button>
        <div className="product-detail-image">
          {selectedProduct.image?<img src={selectedProduct.image} alt={selectedProduct.name}/>:<div className="image-empty-state"><Package size={48}/><span>Sin imagen</span></div>}
        </div>
        <div className="product-detail-copy">
          <span className="product-detail-eyebrow">{selectedProduct.varietal||'Selección Dolce Vino'}</span>
          <h2>{selectedProduct.name}</h2>
          {selectedProduct.winery&&<p className="product-detail-winery">{cleanWineryName(selectedProduct.winery)}</p>}
          <p className="product-detail-description">{selectedProduct.description||'Una etiqueta seleccionada por Dolce Vino para disfrutar y compartir en ocasiones especiales.'}</p>
          <div className="product-detail-meta">
            <strong>{formatPrice(selectedProduct.pricePerUnit)}</strong>
            <span>{isEstucheProduct(selectedProduct.name,selectedProduct.detail)?'Precio total del estuche':'Compra mínima: caja cerrada'}</span>
          </div>
          <button
            type="button"
            className="product-detail-add"
            onClick={()=>{
              const product=selectedProduct;
              setSelectedProduct(null);
              addBox(product);
            }}
          >
            {isEstucheProduct(selectedProduct.name,selectedProduct.detail)?'Agregar estuche':'Agregar caja'}
          </button>
        </div>
      </section>
    </div>}

    <div className={cartOpen?'cart-overlay is-open':'cart-overlay'} onClick={()=>setCartOpen(false)}/>
    <aside className={cartOpen?'cart-drawer is-open':'cart-drawer'}><div className="cart-head"><div><span>Dolce Vino</span><h2>Tu pedido</h2></div><button onClick={()=>setCartOpen(false)}><X/></button></div><div className="cart-items">{!cart.length&&<p className="empty-cart">Todavía no agregaste cajas.</p>}{cart.map(i=>{const isEstuche=isEstucheProduct(i.name,i.detail);const lineTotal=(isEstuche?i.pricePerUnit:i.pricePerUnit*i.unitsPerBox)*i.boxes;return <article className="cart-item" key={i.id}>{i.image?<img src={i.image} alt={i.name}/>:<div className="cart-image-empty"><Package size={20}/></div>}<div><h3>{i.name}</h3><p>{isEstuche?'1 estuche por unidad':`${i.unitsPerBox} botellas por caja`}</p><strong>{formatPrice(lineTotal)}</strong></div><div className="cart-qty"><button onClick={()=>changeBoxes(i.id,-1)}><Minus size={14}/></button><span>{i.boxes}</span><button onClick={()=>changeBoxes(i.id,1)}><Plus size={14}/></button></div></article>})}</div><div className="cart-footer"><div><span>Total estimado</span><strong>{formatPrice(cartTotal)}</strong></div><button disabled={!cart.length}>Solicitar pedido</button></div></aside>
  </main>;
}
