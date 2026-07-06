import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';

// GET /api/admin/users - Get all users
export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');

    let query = supabaseAdmin.from('users').select('*').order('created_at', { ascending: false }).limit(200);

    if (q) {
      query = query.ilike('phone', `%${q}%`);
    }

    const { data: users, error } = await query;
    if (error) throw error;
    
    return NextResponse.json(users || []);
  } catch (err: any) {
    console.error('Error fetching users:', err);
    return NextResponse.json({ message: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST /api/admin/users - Create new user (manual)
export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { phone, password, balance } = await req.json();

    if (!phone || !password) {
      return NextResponse.json({ message: 'Phone and password are required' }, { status: 400 });
    }

    const email = `${phone.replace('+', '')}@betvers.bet`;

    let userRecord;
    try {
      userRecord = await auth.createUser({
        email,
        password,
        phoneNumber: phone,
      });
    } catch (firebaseErr: any) {
      if (firebaseErr.code === 'auth/email-already-exists' || firebaseErr.code === 'auth/phone-number-already-exists') {
         return NextResponse.json({ message: 'User with this phone number already exists' }, { status: 400 });
      }
      throw firebaseErr;
    }

    const uid = userRecord.uid;
    const initialBalance = parseFloat(String(balance)) || 0;

    await supabaseAdmin.from('users').insert({
      id: uid,
      phone,
      role: 'user',
      balance: initialBalance,
      currency: 'ETB',
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ message: 'User created successfully', uid });
  } catch (err: any) {
    console.error('Error creating user:', err);
    return NextResponse.json({ message: err.message || 'Failed to create user' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
