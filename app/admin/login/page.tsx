'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import styles from './login.module.css';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('Correo o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    router.replace('/admin');
    router.refresh();
  };

  return (
    <main className={styles.page}>
      <div className={styles.background} aria-hidden="true" />

      <Link href="/" className={styles.backLink}>
        <ArrowLeft size={16} />
        Volver al sitio
      </Link>

      <section className={styles.card}>
        <div className={styles.brandPanel}>
          <Link href="/" className={styles.logoLink} aria-label="Volver a Dolce Vino">
            <img src="/assets/logo_dolce_vino.png" alt="Dolce Vino" />
          </Link>

          <div className={styles.brandCopy}>
            <span>Almacén Dolce Vino</span>
            <h2>Gestión simple para un catálogo siempre actualizado.</h2>
            <p>
              Administrá productos, precios, bodegas, imágenes, usuarios y el catálogo PDF
              desde un único lugar.
            </p>
          </div>

          <div className={styles.brandFooter}>
            <span>Acceso privado</span>
            <strong>Panel administrativo</strong>
          </div>
        </div>

        <div className={styles.formPanel}>
          <header>
            <span className={styles.eyebrow}>Panel de administración</span>
            <h1>Iniciar sesión</h1>
            <p>Ingresá con tu cuenta autorizada para continuar.</p>
          </header>

          <form onSubmit={handleSubmit}>
            <label>
              Correo electrónico
              <div className={styles.inputWrap}>
                <Mail size={17} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="nombre@correo.com"
                  required
                />
              </div>
            </label>

            <label>
              Contraseña
              <div className={styles.inputWrap}>
                <LockKeyhole size={17} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Ingresá tu contraseña"
                  required
                />
                <button
                  type="button"
                  className={styles.passwordButton}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            {error && <div className={styles.error}>{error}</div>}

            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar al CRM'}
            </button>
          </form>

          <div className={styles.credit}>
            <span>Desarrollado por</span>
            <strong>Pantech</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
