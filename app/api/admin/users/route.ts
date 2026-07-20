import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  const ids = authData.users.map((user) => user.id);
  const { data: profiles, error: profileError } = ids.length
    ? await admin.from('profiles').select('id,full_name,role,active,created_at').in('id', ids)
    : { data: [], error: null };

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

  const users = authData.users.map((user) => {
    const profile = profileMap.get(user.id);
    return {
      id: user.id,
      email: user.email || '',
      full_name: profile?.full_name || user.user_metadata?.full_name || '',
      role: profile?.role || 'user',
      active: profile?.active ?? true,
      created_at: profile?.created_at || user.created_at,
      last_sign_in_at: user.last_sign_in_at || null,
    };
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.full_name || '').trim();
  const role = body.role === 'admin' ? 'admin' : 'user';

  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Ingresá un correo válido.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });
  if (!fullName) return NextResponse.json({ error: 'Ingresá el nombre del usuario.' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: profileError } = await admin.from('profiles').upsert({
    id: data.user.id,
    full_name: fullName,
    role,
    active: true,
  }, { onConflict: 'id' });

  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: data.user.id });
}
