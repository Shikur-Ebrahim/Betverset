import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { name, type, logoUrl } = await req.json();
    if (!name || !type) {
      return NextResponse.json({ message: 'Name and type are required' }, { status: 400 });
    }

    // Check for duplicates
    const { data: existing } = await supabaseAdmin.from('withdrawal_methods').select('id, is_active').eq('name', name);
    const activeDuplicate = (existing || []).some((m: any) => m.is_active === true);
    if (activeDuplicate) {
      return NextResponse.json({ message: 'This method already exists' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('withdrawal_methods')
      .insert({
        name,
        type,
        logo_url: logoUrl,
        is_active: true,
        active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Error adding withdrawal method:', err);
    return NextResponse.json({ message: 'Failed to add withdrawal method' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('withdrawal_methods')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('Fetch withdrawal methods error:', err);
    return NextResponse.json({ message: 'Failed to fetch withdrawal methods' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
