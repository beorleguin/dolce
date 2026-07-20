import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y una clave privada en .env.local');

const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

async function collectObjects(bucket,prefix=''){
  const objects=[];
  let offset=0;
  const limit=1000;
  while(true){
    const {data,error}=await supabase.storage.from(bucket).list(prefix,{limit,offset,sortBy:{column:'name',order:'asc'}});
    if(error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    const batch=data||[];
    for(const item of batch){
      const objectPath=prefix?`${prefix}/${item.name}`:item.name;
      if(item.id) objects.push(objectPath);
      else objects.push(...await collectObjects(bucket,objectPath));
    }
    if(batch.length<limit) break;
    offset+=limit;
  }
  return objects;
}

async function clearBucket(bucket){
  const objects=await collectObjects(bucket);
  let removed=0;
  for(let i=0;i<objects.length;i+=100){
    const chunk=objects.slice(i,i+100);
    const {error}=await supabase.storage.from(bucket).remove(chunk);
    if(error) throw new Error(`No se pudieron borrar objetos de ${bucket}: ${error.message}`);
    removed+=chunk.length;
  }
  return removed;
}

const productFiles=await clearBucket('products');
const wineryFiles=await clearBucket('wineries');

const siteObjects=await collectObjects('site');
const siteImageFiles=siteObjects.filter(path=>/\.(jpe?g|png|webp|gif|svg|avif)$/i.test(path));
let siteImagesRemoved=0;
for(let i=0;i<siteImageFiles.length;i+=100){
  const chunk=siteImageFiles.slice(i,i+100);
  const {error}=await supabase.storage.from('site').remove(chunk);
  if(error) throw new Error(`No se pudieron borrar imágenes de site: ${error.message}`);
  siteImagesRemoved+=chunk.length;
}

const {error:productsError}=await supabase
  .from('products')
  .update({image_url:null,image_path:null,image_pending:true})
  .not('id','is',null);
if(productsError) throw new Error(`No se pudieron limpiar productos: ${productsError.message}`);

const {error:wineriesError}=await supabase
  .from('wineries')
  .update({logo_url:null})
  .not('id','is',null);
if(wineriesError) throw new Error(`No se pudieron limpiar bodegas: ${wineriesError.message}`);

const {error:bannersError}=await supabase
  .from('site_banners')
  .update({desktop_image_url:null,mobile_image_url:null})
  .not('id','is',null);
if(bannersError) throw new Error(`No se pudieron limpiar banners: ${bannersError.message}`);

console.log(`Imágenes eliminadas de Storage: products=${productFiles}, wineries=${wineryFiles}, site=${siteImagesRemoved}`);
console.log('Productos: image_url e image_path en null; image_pending en true.');
console.log('Bodegas: logo_url en null.');
console.log('Banners: desktop_image_url y mobile_image_url en null. Los PDF del bucket site se conservaron.');
