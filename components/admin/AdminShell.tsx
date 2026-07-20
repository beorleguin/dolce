'use client';
import Link from 'next/link';
import { BarChart3, Building2, FileDown, ImagePlus, LogOut, Settings, Users, Wine } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

const links=[
  {href:'/admin/vinos',label:'Gestión de vinos',icon:Wine},
  {href:'/admin',label:'Dashboard',icon:BarChart3},
  {href:'/admin/bodegas',label:'Bodegas',icon:Building2},
  {href:'/admin/banners',label:'Banners',icon:ImagePlus},
  {href:'/admin/catalogo',label:'Catálogo PDF',icon:FileDown},
  {href:'/admin/usuarios',label:'Usuarios',icon:Users},
  {href:'/admin/configuracion',label:'Configuración',icon:Settings},
];
export default function AdminShell({children,title,subtitle}:{children:React.ReactNode;title:string;subtitle?:string}){
 const pathname=usePathname(); const router=useRouter(); const [busy,setBusy]=useState(false);
 async function logout(){setBusy(true);await createClient().auth.signOut();router.replace('/admin/login');router.refresh();}
 return <div className="admin-shell"><aside className="admin-sidebar">
  <Link href="/" className="admin-brand admin-brand-text"><strong>DOLCE</strong><span>VINO</span></Link>
  <nav>{links.map(({href,label,icon:Icon})=><Link key={href} href={href} className={pathname===href?'active':''}><Icon/>{label}</Link>)}</nav>
  <button type="button" onClick={logout} disabled={busy}><LogOut/>{busy?'Cerrando...':'Cerrar sesión'}</button>
 </aside><main className="admin-main"><div className="admin-topbar"><div><span className="kicker">Dolce Vino</span><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div><div className="role-pill">Admin</div></div>{children}</main></div>
}
