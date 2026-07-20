'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ExternalLink,
  FileDown,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  Warehouse,
  Wine,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import styles from './AdminShell.module.css';

type AdminShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

const navigation = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/vinos', label: 'Gestión de vinos', icon: Wine },
  { href: '/admin/bodegas', label: 'Bodegas', icon: Warehouse },
  { href: '/admin/banners', label: 'Banners', icon: ImagePlus },
  { href: '/admin/catalogo', label: 'Catálogo PDF', icon: FileDown },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
];

export default function AdminShell({ title, subtitle, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace('/admin/login');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const isActive = (href: string) =>
    href === '/admin'
      ? pathname === '/admin'
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className={styles.shell}>
      <button
        type="button"
        className={styles.mobileMenuButton}
        onClick={() => setMenuOpen(true)}
        aria-label="Abrir menú del CRM"
        aria-expanded={menuOpen}
      >
        <Menu size={22} />
      </button>

      {menuOpen && (
        <button
          type="button"
          className={styles.backdrop}
          onClick={() => setMenuOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link href="/admin" className={styles.logoLink} aria-label="Ir al dashboard">
            <img src="/assets/logo_dolce_vino.png" alt="Dolce Vino" />
          </Link>

          <button
            type="button"
            className={styles.mobileCloseButton}
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={22} />
          </button>
        </div>

        <nav className={styles.navigation} aria-label="Navegación del CRM">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${isActive(href) ? styles.navItemActive : ''}`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={styles.signOutButton}
            onClick={() => void signOut()}
            disabled={signingOut}
          >
            <LogOut size={20} />
            <span>{signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}</span>
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.pageHeader}>
          <div className={styles.pageHeading}>
            <span className={styles.eyebrow}>Dolce Vino</span>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <div className={styles.headerActions}>
            <span className={styles.roleBadge}>Admin</span>
            <Link href="/" className={styles.siteButton}>
              <ExternalLink size={15} />
              Ir al sitio
            </Link>
          </div>
        </header>

        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
