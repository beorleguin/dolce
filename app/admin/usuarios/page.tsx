'use client';

import {
  Check,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import styles from './users-admin.module.css';

type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

type FormState = {
  full_name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  active: boolean;
};

const emptyForm: FormState = {
  full_name: '',
  email: '',
  password: '',
  role: 'user',
  active: true,
};

export default function UsersAdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error || 'No se pudieron cargar los usuarios.');
      } else {
        setUsers(payload.users || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) =>
      `${user.full_name} ${user.email} ${user.role}`.toLowerCase().includes(query),
    );
  }, [search, users]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setMessage('');
    setModalOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditing(user);
    setForm({
      full_name: user.full_name,
      email: user.email,
      password: '',
      role: user.role,
      active: user.active,
    });
    setMessage('');
    setModalOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    const endpoint = editing ? `/api/admin/users/${editing.id}` : '/api/admin/users';
    const response = await fetch(endpoint, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error || 'No se pudo guardar el usuario.');
      setSaving(false);
      return;
    }

    setModalOpen(false);
    setSaving(false);
    setMessage(editing ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.');
    await loadUsers();
  };

  return (
    <AdminShell title="Usuarios" subtitle="Creá accesos, asigná roles y activá o desactivá cuentas.">
      <section className={styles.card}>
        <header className={styles.header}>
          <div>
            <h2>Usuarios del CRM</h2>
            <p>{filteredUsers.length} usuarios encontrados.</p>
          </div>

          <button type="button" className={styles.primaryButton} onClick={openCreate}>
            <Plus size={17} />
            Nuevo usuario
          </button>
        </header>

        <div className={styles.toolbar}>
          <label>
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o correo"
            />
          </label>
        </div>

        {message && <div className={styles.message}>{message}</div>}

        {loading ? (
          <div className={styles.loading}>
            <Loader2 className={styles.spin} />
            Cargando usuarios...
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Último acceso</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.identity}>
                        <span className={styles.avatar}>
                          <UserRound size={18} />
                        </span>
                        <div>
                          <strong>{user.full_name || 'Sin nombre'}</strong>
                          <small>{user.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.role} ${user.role === 'admin' ? styles.adminRole : ''}`}>
                        {user.role === 'admin' ? <ShieldCheck size={14} /> : <UserRound size={14} />}
                        {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.status} ${user.active ? styles.activeStatus : ''}`}>
                        {user.active ? <Check size={13} /> : <X size={13} />}
                        {user.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleString('es-AR')
                        : 'Nunca'}
                    </td>
                    <td>
                      <button type="button" className={styles.editButton} onClick={() => openEdit(user)}>
                        <Pencil size={15} />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!filteredUsers.length && (
              <div className={styles.empty}>No se encontraron usuarios.</div>
            )}
          </div>
        )}
      </section>

      {modalOpen && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={() => {
            if (!saving) setModalOpen(false);
          }}
        >
          <section className={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setModalOpen(false)}
              disabled={saving}
              aria-label="Cerrar"
            >
              <X />
            </button>

            <span>Panel de administración</span>
            <h2>{editing ? 'Editar usuario' : 'Nuevo usuario'}</h2>

            <form onSubmit={submit}>
              <label>
                Nombre completo
                <input
                  required
                  value={form.full_name}
                  onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                />
              </label>

              <label>
                Correo electrónico
                <input
                  type="email"
                  required
                  disabled={Boolean(editing)}
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </label>

              <label>
                {editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                <input
                  type="password"
                  required={!editing}
                  minLength={8}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder={editing ? 'Dejar vacío para conservarla' : 'Mínimo 8 caracteres'}
                />
              </label>

              <label>
                Rol
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm({ ...form, role: event.target.value as 'admin' | 'user' })
                  }
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>

              {editing && (
                <label className={styles.activeCheck}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  />
                  <span />
                  Cuenta activa
                </label>
              )}

              {message && <div className={styles.message}>{message}</div>}

              <button type="submit" className={styles.saveButton} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className={styles.spin} size={16} />
                    Guardando...
                  </>
                ) : editing ? (
                  'Guardar cambios'
                ) : (
                  'Crear usuario'
                )}
              </button>
            </form>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
