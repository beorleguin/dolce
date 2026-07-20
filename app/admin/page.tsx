'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { Building2,ImagePlus,PackageSearch,Wine } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { createClient } from '@/lib/supabase/client';

export default function Dashboard(){
 const [stats,setStats]=useState({products:0,wineries:0,pending:0,featured:0});
 useEffect(()=>{(async()=>{const s=createClient();const [p,w,i,f]=await Promise.all([
  s.from('products').select('*',{count:'exact',head:true}),s.from('wineries').select('*',{count:'exact',head:true}),
  s.from('products').select('*',{count:'exact',head:true}).eq('image_pending',true),s.from('products').select('*',{count:'exact',head:true}).eq('featured',true)
 ]);setStats({products:p.count||0,wineries:w.count||0,pending:i.count||0,featured:f.count||0});})();},[]);
 return <AdminShell title="Panel de administración" subtitle="Resumen general del catálogo y accesos rápidos.">
  <section className="admin-card admin-priority-card"><div className="admin-card-head"><div><h2>Gestión de vinos</h2><p>Administrá primero el listado real del cliente, precios, disponibilidad, cajas e imágenes.</p></div><Link className="btn btn-primary" href="/admin/vinos"><Wine size={16}/> Abrir gestión</Link></div></section>
  <section className="stats-grid"><div><span>Productos</span><strong>{stats.products}</strong></div><div><span>Bodegas</span><strong>{stats.wineries}</strong></div><div><span>Sin imagen</span><strong>{stats.pending}</strong></div><div><span>Destacados</span><strong>{stats.featured}</strong></div></section>
  <section className="admin-quick-grid"><Link href="/admin/vinos"><PackageSearch/><div><h3>Productos del cliente</h3><p>Editar, filtrar y publicar.</p></div></Link><Link href="/admin/bodegas"><Building2/><div><h3>Bodegas</h3><p>Crear, editar y eliminar.</p></div></Link><Link href="/admin/banners"><ImagePlus/><div><h3>Banners</h3><p>Hero y banner central.</p></div></Link></section>
 </AdminShell>
}
