import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// POST /api/admin/deposit-methods - Add deposit method
export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { name, logoUrl, minAmount, accountDetails, accountName } = await req.json();
    const { data, error } = await supabaseAdmin
      .from('deposit_methods')
      .insert({
        name,
        logo_url: logoUrl,
        min_amount: minAmount,
        account_details: accountDetails,
        account_name: accountName,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Error adding deposit method:', err);
    return NextResponse.json({ message: 'Failed to add deposit method' }, { status: 500 });
  }
}

// GET /api/admin/deposit-methods - Get all active deposit methods
export async function GET(req: Request) {
  try {
    const { data, error } = await supabaseAdmin
      .from('deposit_methods')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json([], { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
