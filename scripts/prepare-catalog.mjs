import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { classifyProduct } from './lib/catalog-classification.mjs';

const require=createRequire(import.meta.url);
const XLSX=require('xlsx');

const root=process.cwd();
const input=path.resolve(root,process.env.CATALOG_XLSX || 'data/lista-articulos.xlsx');
const scraperPath=path.resolve(root,process.env.SCRAPER_PRODUCTS_JSON || 'data/productos-scraper.json');
const output=path.resolve(root,'data/catalogo-normalizado.json');
const report=path.resolve(root,'data/informe-importacion.json');

const slugify=(value='')=>value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' y ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const clean=(v)=>String(v??'').trim().replace(/\s+/g,' ');
const normalize=(v)=>slugify(clean(v)).replace(/\b(vino|botella|unidad|unidades|x\d+|\d+ml|\d+l)\b/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'');
const volume=(name)=>{const m=clean(name).match(/(?:^|\s)(\d{2,4})\s*ml\b/i);return m?Number(m[1]):null};

if(!fs.existsSync(input)){
  throw new Error(`No se encontró el Excel del catálogo en: ${input}. Verificá CATALOG_XLSX en .env.local o copiá el archivo como data/lista-articulos.xlsx.`);
}

const wb=XLSX.readFile(input,{cellDates:false});
const rows=[];
for(const sheetName of ['INCLUIDOS','NO INCLUIDOS']){
  const sheet=wb.Sheets[sheetName];
  if(!sheet) continue;
  const data=XLSX.utils.sheet_to_json(sheet,{defval:null});
  for(const row of data){
    const articleName=clean(row['Nombre del Artículo']);
    if(!articleName) continue;
    const sourceCategory=clean(row['Categoría']);
    const sourceSubcategory=clean(row['Subcategoría']);
    const mapped=classifyProduct(articleName,sourceCategory,sourceSubcategory);
    const brandName=clean(row.Marca)||articleName;
    rows.push({
      external_key:crypto.createHash('sha1').update(`${sheetName}|${articleName}|${brandName}`).digest('hex'),
      name:articleName,article_name:articleName,slug:slugify(`${brandName}-${articleName}`),stock:0,price:Number(row['Precio de Venta']||0),currency:'ARS',
      category:mapped.category,subcategory:mapped.subcategory||'Otros',brand:brandName,supplier:clean(row.Proveedor),
      source_sheet:sheetName,source_category:sourceCategory,source_subcategory:sourceSubcategory,
      volume_ml:volume(articleName),units_per_box:1,enabled:true,image_url:null,image_path:null,image_pending:true,
      winery:['Vinos','Espumantes'].includes(mapped.category)?clean(row.Proveedor)||null:null,
      varietal:['Vinos','Espumantes'].includes(mapped.category)?mapped.varietal:null,description:''
    });
  }
}

let scraper=[];
if(fs.existsSync(scraperPath)) scraper=JSON.parse(fs.readFileSync(scraperPath,'utf8'));
const byName=new Map();
for(const p of scraper){
  const keys=[normalize(p.nombre),normalize(p.slug),normalize(`${p.bodega} ${p.nombre}`)].filter(Boolean);
  for(const key of keys) if(!byName.has(key)) byName.set(key,p);
}

let matched=0;
for(const p of rows){
  const candidates=[normalize(p.article_name),normalize(`${p.brand} ${p.article_name}`),normalize(p.name)];
  const found=candidates.map(k=>byName.get(k)).find(Boolean);
  if(found){
    if(!p.winery) p.winery=clean(found.bodega)||null;
    p.varietal=clean(found.varietal)||p.varietal;
    p.description=clean(found.descripcion);
    p.image_path=clean(found.imagen_local)||null;
    p.image_url=clean(found.imagen_origen)||null;
    p.image_pending=!p.image_path && !p.image_url;
    matched++;
  }
}

const unique=[]; const seen=new Set();
for(const p of rows){
  let slug=p.slug; let i=2;
  while(seen.has(slug)) slug=`${p.slug}-${i++}`;
  p.slug=slug; seen.add(slug); unique.push(p);
}
fs.writeFileSync(output,JSON.stringify(unique,null,2));
fs.writeFileSync(report,JSON.stringify({generated_at:new Date().toISOString(),total:unique.length,included:unique.filter(x=>x.source_sheet==='INCLUIDOS').length,not_included:unique.filter(x=>x.source_sheet==='NO INCLUIDOS').length,matched_images:matched,pending_images:unique.filter(x=>x.image_pending).length,categories:Object.fromEntries([...new Set(unique.map(x=>x.category))].map(c=>[c,unique.filter(x=>x.category===c).length]))},null,2));
console.log(`Catálogo preparado: ${unique.length} productos`);
console.log(`Coincidencias con scraper: ${matched}`);
console.log(`Sin imagen: ${unique.filter(x=>x.image_pending).length}`);
console.log(`Salida: ${output}`);
