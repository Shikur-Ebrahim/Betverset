import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// PUT /api/admin/deposit-methods/[id] - Update deposit method
export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { name, logoUrl, minAmount, accountDetails, accountName } = await req.json();
    
    const { data: existing } = await supabaseAdmin.from('deposit_methods').select('id').eq('id', params.id).single();
    if (!existing) return NextResponse.json({ message: 'Method not found' }, { status: 404 });

    const updated = {
      name,
      logo_url: logoUrl,
      min_amount: minAmount,
      account_details: accountDetails,
      account_name: accountName,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseAdmin.from('deposit_methods').update(updated).eq('id', params.id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ message: 'Failed to update deposit method' }, { status: 500 });
  }
}

// DELETE /api/admin/deposit-methods/[id] - Soft delete deposit method
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { data: existing } = await supabaseAdmin.from('deposit_methods').select('id').eq('id', params.id).single();
    if (!existing) return NextResponse.json({ message: 'Method not found' }, { status: 404 });

    await supabaseAdmin.from('deposit_methods').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', params.id);
    return NextResponse.json({ message: 'Method deleted successfully', id: params.id });
  } catch (err: any) {
    return NextResponse.json({ message: 'Failed to delete deposit method' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
