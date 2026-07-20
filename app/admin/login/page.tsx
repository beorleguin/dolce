'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError('Correo o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    router.replace('/admin');
    router.refresh();
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <Link href="/" className="admin-login-logo" aria-label="Volver al sitio">
          <div className="login-brand-text"><strong>DOLCE</strong><span>VINO</span></div>
        </Link>
        <span className="kicker">Panel de administración</span>
        <h1>Panel de administración</h1>

        <form onSubmit={handleSubmit}>
          <label>
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="admin-login-error">{error}</div>}
          <button type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>

        <div className="admin-login-credit">
          <span>Desarrollado por</span>
          <span className="login-powered-text">Pantech</span>
        </div>
      </section>
    </main>
  );
}
