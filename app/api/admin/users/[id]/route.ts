import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const currentAdmin = await requireAdmin();
  if (!currentAdmin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const fullName = String(body.full_name || '').trim();
  const role = body.role === 'admin' ? 'admin' : 'user';
  const active = body.active !== false;
  const password = String(body.password || '');

  if (!fullName) return NextResponse.json({ error: 'Ingresá el nombre del usuario.' }, { status: 400 });
  if (params.id === currentAdmin.id && (!active || role !== 'admin')) {
    return NextResponse.json({ error: 'No podés quitarte tu propio acceso de administrador.' }, { status: 400 });
  }
  if (password && password.length < 8) {
    return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: profileError } = await admin.from('profiles').update({ full_name: fullName, role, active }).eq('id', params.id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

  const authUpdates: Record<string, unknown> = { user_metadata: { full_name: fullName }, ban_duration: active ? 'none' : '876000h' };
  if (password) authUpdates.password = password;
  const { error: authError } = await admin.auth.admin.updateUserById(params.id, authUpdates);
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
