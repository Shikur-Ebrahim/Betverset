import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { error } = await supabaseAdmin.from('withdrawal_methods').update({ is_active: false, active: false, updated_at: new Date().toISOString() }).eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ message: 'Method deleted successfully' });
  } catch (err: any) {
    console.error('Delete withdrawal method error:', err);
    return NextResponse.json({ message: 'Failed to delete withdrawal method' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
