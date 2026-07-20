import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en .env.local');
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const catalogPath=path.resolve(process.cwd(),'data/catalogo-normalizado.json');
if(!fs.existsSync(catalogPath)){
  throw new Error(`No se encontró ${catalogPath}. Ejecutá primero: npm run catalog:prepare`);
}
const data=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const slugify=(value='')=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const chunks=(arr,size=200)=>Array.from({length:Math.ceil(arr.length/size)},(_,i)=>arr.slice(i*size,(i+1)*size));
const uniqueBy=(rows,keyFn)=>[...new Map(rows.map(row=>[keyFn(row),row])).values()];
async function upsert(table,rows,onConflict){
  for(const batch of chunks(rows)){
    const {error}=await supabase.from(table).upsert(batch,{onConflict});
    if(error) throw new Error(`${table}: ${error.message}`);
  }
}
async function mapIds(table){
  const {data,error}=await supabase.from(table).select('id,slug'); if(error) throw error;
  return new Map(data.map(x=>[x.slug,x.id]));
}

const categories=uniqueBy(data.map(x=>x.category).filter(Boolean).map((name,i)=>({name,slug:slugify(name),original_name:name,sort_order:i})),row=>row.slug);
await upsert('categories',categories,'slug');
const categoryIds=await mapIds('categories');
const subcategories=uniqueBy(data.map(x=>{const c=slugify(x.category),s=slugify(x.subcategory||'Otros');return {category_id:categoryIds.get(c),name:x.subcategory||'Otros',slug:s,original_name:x.source_subcategory||x.subcategory};}).filter(x=>x.category_id&&x.slug),row=>`${row.category_id}|${row.slug}`);
await upsert('subcategories',subcategories,'category_id,slug');
const {data:subs,error:subErr}=await supabase.from('subcategories').select('id,category_id,slug'); if(subErr) throw subErr;
const subIds=new Map(subs.map(x=>[`${x.category_id}|${x.slug}`,x.id]));
const brands=uniqueBy(data.map(x=>x.brand).filter(Boolean).map(name=>({name,slug:slugify(name)})).filter(x=>x.slug),row=>row.slug);
await upsert('brands',brands,'slug');
const brandIds=await mapIds('brands');
const wineries=uniqueBy(data.map(x=>x.winery).filter(Boolean).map(name=>({name,slug:slugify(name),brand_id:brandIds.get(slugify(name))||null})).filter(x=>x.slug),row=>row.slug);
await upsert('wineries',wineries,'slug');
const wineryIds=await mapIds('wineries');
const varietals=uniqueBy(data.map(x=>x.varietal).filter(Boolean).map(name=>({name,slug:slugify(name)})).filter(x=>x.slug),row=>row.slug);
await upsert('varietals',varietals,'slug');
const varietalIds=await mapIds('varietals');

const products=data.map(p=>{
  const categoryId=categoryIds.get(slugify(p.category));
  return {external_key:p.external_key,name:p.name,slug:p.slug,category_id:categoryId,subcategory_id:subIds.get(`${categoryId}|${slugify(p.subcategory||'Otros')}`)||null,brand_id:brandIds.get(slugify(p.brand))||null,winery_id:p.winery?wineryIds.get(slugify(p.winery))||null:null,varietal_id:p.varietal?varietalIds.get(slugify(p.varietal))||null:null,supplier:p.supplier||null,description:p.description||null,price:p.price||0,currency:p.currency||'ARS',stock:p.stock||0,units_per_box:p.units_per_box||1,volume_ml:p.volume_ml||null,image_url:p.image_url||null,image_path:p.image_path||null,image_pending:Boolean(p.image_pending),enabled:Boolean(p.enabled),source_sheet:p.source_sheet,source_category:p.source_category||null,source_subcategory:p.source_subcategory||null};
});
await upsert('products',products,'external_key');
console.log(`Importación finalizada: ${products.length} productos.`);
