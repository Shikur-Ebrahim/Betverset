import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// GET /api/admin/users
export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { searchParams } = new URL(req.url);
    const term = (searchParams.get('q') || searchParams.get('phone') || '').trim();

    const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
    let users = snapshot.docs.map((doc: any) => {
      const d = doc.data();
      return {
        id: doc.id,
        phone: d.phone,
        role: d.role,
        created_at: d.createdAt,
        balance: String(d.balance ?? 0),
        currency: d.currency || 'ETB',
      };
    });

    if (term) {
      users = users.filter((u: any) => u.phone?.includes(term));
    }

    return NextResponse.json(users);
  } catch (err: any) {
    console.error('Admin list users error:', err);
    return NextResponse.json({ message: 'Failed to list users' }, { status: 500 });
  }
}

// POST /api/admin/users - Create user
export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { phone, password } = await req.json();
    if (!phone || !password) {
      return NextResponse.json({ message: 'Phone and password are required' }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const email = `${phone.replace('+', '')}@betvers.bet`;

    const userRecord = await auth.createUser({ email, password, displayName: phone });

    const userData = {
      phone,
      role: 'user',
      balance: 0,
      currency: 'ETB',
      createdAt: new Date().toISOString(),
    };
    await db.collection('users').doc(userRecord.uid).set(userData);

    return NextResponse.json({
      id: userRecord.uid,
      phone,
      role: 'user',
      created_at: userData.createdAt,
      balance: '0.00',
      currency: 'ETB',
    }, { status: 201 });
  } catch (err: any) {
    console.error('Admin create user error:', err);
    if (err.code === 'auth/email-already-exists') {
      return NextResponse.json({ message: 'Phone number already registered' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Failed to create user' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
