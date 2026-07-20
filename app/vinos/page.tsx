'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Menu, Minus, Package, Plus, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatPrice, getCartFromStorage, saveCartToStorage, type CartItem } from '@/lib/featuredWines';

const groups:Record<string,string[]>={
  Malbec:['malbec'],
  Cabernet:['cabernet sauvignon','cabernet franc','carmenere'],
  Blend:['blend','red blend','corte','assemblage','assamblage'],
  Dulces:['dulce','cosecha tardia','late harvest'],
  Blancos:['chardonnay','sauvignon blanc','chenin','torrontes','semillon','riesling','viognier','gewurztraminer','albarino'],
  Tintos:['bonarda','merlot','pinot noir','syrah','tempranillo','petit verdot','sangiovese','ancellotta'],
  Rosados:['rose','rosado'],
};

const normalize=(value:string)=>value.toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const isEstuche=(value:string)=>/\bestuche\b/.test(normalize(value));
const cleanWinery=(value:string)=>value.replace(/\s+(s\.?\s*a\.?|s\.?\s*r\.?\s*l\.?)$/i,'').trim();

type Wine={
  id:string; name:string; description:string; winery:string; varietal:string; image:string;
  pricePerUnit:number; unitsPerBox:number; detail?:string;
};

export default function WinesPage(){
  const [menuOpen,setMenuOpen]=useState(false);
  const [mobileDropdown,setMobileDropdown]=useState('');
  const [group,setGroup]=useState('');
  const [query,setQuery]=useState('');
  const [winery,setWinery]=useState('');
  const [varietal,setVarietal]=useState('');
  const [wines,setWines]=useState<Wine[]>([]);
  const [selected,setSelected]=useState<Wine|null>(null);
  const [cart,setCart]=useState<CartItem[]>([]);
  const [headerCompact,setHeaderCompact]=useState(false);
  const [headerSearchOpen,setHeaderSearchOpen]=useState(false);
  const [cartOpen,setCartOpen]=useState(false);

  useEffect(()=>{
    setGroup(new URLSearchParams(window.location.search).get('grupo')||'');
    setCart(getCartFromStorage());
    const supabase=createClient();
    void (async()=>{
      const rows:any[]=[];
      for(let from=0;;from+=700){
        const {data,error}=await supabase.from('products')
          .select('id,name,article_name,description,price,units_per_box,image_url,enabled,categories(name),wineries(name),varietals(name)')
          .eq('enabled',true).order('name').range(from,from+699);
        if(error){console.error(error);break;}
        rows.push(...(data||[]));
        if((data||[]).length<700) break;
      }
      setWines(rows.filter(row=>{
        const category=normalize(row.categories?.name||'');
        return category.includes('vino')&&!category.includes('espumante');
      }).map(row=>({
        id:row.id,
        name:(row.article_name||row.name||'Producto').trim(),
        detail:row.name||undefined,
        description:(row.description||'').trim(),
        winery:cleanWinery(row.wineries?.name||''),
        varietal:(row.varietals?.name||'').trim(),
        image:row.image_url||'',
        pricePerUnit:Number(row.price)||0,
        unitsPerBox:Math.max(1,Number(row.units_per_box)||6),
      })));
    })();
  },[]);


  useEffect(()=>{
    const updateHeader=()=>setHeaderCompact(window.scrollY>120);
    updateHeader();
    window.addEventListener('scroll',updateHeader,{passive:true});
    return()=>window.removeEventListener('scroll',updateHeader);
  },[]);

  useEffect(()=>{
    document.body.style.overflow=(selected||cartOpen||menuOpen)?'hidden':'';
    return()=>{document.body.style.overflow='';};
  },[selected,cartOpen,menuOpen]);

  const wineries=useMemo(()=>Array.from(new Set(wines.map(w=>w.winery).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es')),[wines]);
  const varietals=useMemo(()=>Array.from(new Set(wines.map(w=>w.varietal).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es')),[wines]);

  const filtered=useMemo(()=>{
    const terms=(groups[group]||[]).map(normalize);
    const q=normalize(query);
    return wines.filter(w=>{
      const haystack=normalize(`${w.name} ${w.winery} ${w.varietal}`);
      return (!terms.length||terms.some(term=>haystack.includes(term)))
        &&(!q||haystack.includes(q))
        &&(!winery||w.winery===winery)
        &&(!varietal||w.varietal===varietal);
    });
  },[wines,group,query,winery,varietal]);

  const addBox=(wine:Wine)=>{
    const next=cart.some(item=>item.id===wine.id)
      ?cart.map(item=>item.id===wine.id?{...item,boxes:item.boxes+1,...wine}:item)
      :[...cart,{...wine,boxes:1}];
    setCart(next as CartItem[]);
    saveCartToStorage(next as CartItem[]);
  };

  const cartCount=cart.reduce((sum,item)=>sum+item.boxes,0);
  const cartTotal=cart.reduce((sum,item)=>{
    const linePrice=isEstuche(item.name)?item.pricePerUnit:item.pricePerUnit*item.unitsPerBox;
    return sum+linePrice*item.boxes;
  },0);
  const changeBoxes=(id:string,amount:number)=>{
    const next=cart.map(item=>item.id===id?{...item,boxes:Math.max(0,item.boxes+amount)}:item).filter(item=>item.boxes>0);
    setCart(next);
    saveCartToStorage(next);
  };

  return <main className="wine-listing-page">
    <header className={`site-header${headerCompact?' is-compact':''}`}><div className="header-shell">
      <Link href="/" className="brand" aria-label="Dolce Vino - Inicio">
        <img src="/assets/logo_dolce_vino.png" alt="Dolce Vino" />
      </Link>
      <nav className={menuOpen?'main-nav is-open':'main-nav'}>
        <div className="nav-dropdown"><button className="nav-dropdown-trigger" onClick={()=>setMobileDropdown(value=>value==='vinos'?'':'vinos')}>Vinos <ChevronDown size={13}/></button><div className={`nav-dropdown-panel grouped-menu-panel${mobileDropdown==='vinos'?' is-mobile-open':''}`}>{Object.keys(groups).map(label=><Link key={label} href={`/vinos?grupo=${encodeURIComponent(label)}`} onClick={()=>{setGroup(label);setMenuOpen(false);setMobileDropdown('')}}>{label}</Link>)}</div></div>
        <Link href="/#bodegas">Bodegas</Link><Link href="/#categorias">Categorías</Link><Link href="/#colecciones">Colecciones</Link><Link href="/#nosotros">Sobre nosotros</Link>
      </nav>
      <div className="header-actions">
        <button className="icon-action search-trigger" aria-label="Buscar" onClick={()=>setHeaderSearchOpen(value=>!value)}><Search size={19}/></button>
        <Link className="icon-action desktop-action" href="/admin"><UserRound size={19}/></Link>
        <button className="icon-action cart-trigger" aria-label="Pedido" onClick={()=>setCartOpen(true)}><ShoppingBag size={19}/>{cartCount>0&&<span>{cartCount}</span>}</button>
        <button className="mobile-menu-button" aria-label="Abrir menú" onClick={()=>{setMenuOpen(value=>!value);if(menuOpen)setMobileDropdown('')}}>{menuOpen?<X/>:<Menu/>}</button>
      </div>
      {menuOpen&&<button className="mobile-nav-backdrop" aria-label="Cerrar menú" onClick={()=>{setMenuOpen(false);setMobileDropdown('')}}/>}
      <div className={`header-search-panel${headerSearchOpen?' is-open':''}`}>
        <Search size={18}/>
        <input
          autoFocus={headerSearchOpen}
          value={query}
          onChange={event=>setQuery(event.target.value)}
          onKeyDown={event=>{if(event.key==='Enter'){document.querySelector('.wine-listing-content')?.scrollIntoView({behavior:'smooth'});setHeaderSearchOpen(false);}}}
          placeholder="Buscar vino, bodega o varietal"
        />
        {query&&<button type="button" onClick={()=>setQuery('')} aria-label="Limpiar búsqueda"><X size={16}/></button>}
      </div>
    </div></header>

    <section className="wine-listing-hero">
      <div><span>Catálogo Dolce Vino</span><h1>{group||'Todos los vinos'}</h1><p>Explorá nuestra selección, filtrá por bodega o varietal y encontrá la etiqueta indicada para cada ocasión.</p></div>
    </section>

    <section className="wine-listing-content">
      <div className="wine-listing-toolbar">
        <label><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar vino, bodega o varietal"/></label>
        <select value={group} onChange={e=>setGroup(e.target.value)}><option value="">Todos los vinos</option>{Object.keys(groups).map(label=><option key={label}>{label}</option>)}</select>
        <select value={winery} onChange={e=>setWinery(e.target.value)}><option value="">Todas las bodegas</option>{wineries.map(value=><option key={value}>{value}</option>)}</select>
        <select value={varietal} onChange={e=>setVarietal(e.target.value)}><option value="">Todos los varietales</option>{varietals.map(value=><option key={value}>{value}</option>)}</select>
        {(query||group||winery||varietal)&&<button onClick={()=>{setQuery('');setGroup('');setWinery('');setVarietal('')}}>Limpiar</button>}
      </div>
      <p className="wine-listing-count">{filtered.length} productos encontrados</p>
      <div className="wine-listing-grid">
        {filtered.map(wine=><article className="catalog-product-card" key={wine.id}>
          <div className="box-badge"><Package size={15}/><strong>x{isEstuche(wine.name)?1:wine.unitsPerBox}</strong></div>
          <button className="product-card-open catalog-product-image" onClick={()=>setSelected(wine)}>{wine.image?<img src={wine.image} alt={wine.name}/>:<div className="image-empty-state"><Package/><span>Sin imagen</span></div>}</button>
          <div className="catalog-product-info">
            <button className="product-title-button" onClick={()=>setSelected(wine)}><h3>{wine.name}</h3></button>
            {wine.winery&&<p className="featured-wine-winery">{wine.winery}</p>}
            <div className="featured-price">{formatPrice(wine.pricePerUnit)} {!isEstuche(wine.name)&&<small>c/botella</small>}</div>
            <button className="add-box-button" onClick={()=>addBox(wine)}>{isEstuche(wine.name)?'Agregar estuche':'Agregar caja'}</button>
          </div>
        </article>)}
      </div>
    </section>

    <div className={cartOpen?'cart-overlay is-open':'cart-overlay'} onClick={()=>setCartOpen(false)}/>
    <aside className={cartOpen?'cart-drawer is-open':'cart-drawer'} aria-label="Tu pedido">
      <div className="cart-head">
        <div><span>Dolce Vino</span><h2>Tu pedido</h2></div>
        <button type="button" onClick={()=>setCartOpen(false)} aria-label="Cerrar pedido"><X/></button>
      </div>
      <div className="cart-items">
        {!cart.length&&<p className="empty-cart">Todavía no agregaste cajas.</p>}
        {cart.map(item=>{
          const estuche=isEstuche(item.name);
          const lineTotal=(estuche?item.pricePerUnit:item.pricePerUnit*item.unitsPerBox)*item.boxes;
          return <article className="cart-item" key={item.id}>
            {item.image?<img src={item.image} alt={item.name}/>:<div className="cart-image-empty"><Package size={20}/></div>}
            <div><h3>{item.name}</h3><p>{estuche?'1 estuche por unidad':`${item.unitsPerBox} botellas por caja`}</p><strong>{formatPrice(lineTotal)}</strong></div>
            <div className="cart-qty"><button onClick={()=>changeBoxes(item.id,-1)}><Minus size={14}/></button><span>{item.boxes}</span><button onClick={()=>changeBoxes(item.id,1)}><Plus size={14}/></button></div>
          </article>;
        })}
      </div>
      <div className="cart-footer"><div><span>Total estimado</span><strong>{formatPrice(cartTotal)}</strong></div><button disabled={!cart.length}>Solicitar pedido</button></div>
    </aside>

    {selected&&<div className="product-detail-backdrop" onMouseDown={()=>setSelected(null)}>
      <section className="product-detail-modal" onMouseDown={e=>e.stopPropagation()}>
        <button className="product-detail-close" onClick={()=>setSelected(null)}><X/></button>
        <div className="product-detail-image">{selected.image?<img src={selected.image} alt={selected.name}/>:<div className="image-empty-state"><Package size={48}/><span>Sin imagen</span></div>}</div>
        <div className="product-detail-copy"><span className="product-detail-eyebrow">{selected.varietal||'Selección Dolce Vino'}</span><h2>{selected.name}</h2>{selected.winery&&<p className="product-detail-winery">{selected.winery}</p>}<p className="product-detail-description">{selected.description||'Una etiqueta seleccionada por Dolce Vino para disfrutar y compartir.'}</p><div className="product-detail-meta"><strong>{formatPrice(selected.pricePerUnit)}</strong><span>{isEstuche(selected.name)?'Precio total del estuche':`Caja x${selected.unitsPerBox}`}</span></div><button className="product-detail-add" onClick={()=>addBox(selected)}>{isEstuche(selected.name)?'Agregar estuche':'Agregar caja'}</button></div>
      </section>
    </div>}
  </main>;
}
