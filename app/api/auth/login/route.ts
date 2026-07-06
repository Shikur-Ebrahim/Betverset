import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';


export async function POST(req: Request) {
  try {
    const { phone, password } = await req.json();

    if (!phone || !password) {
      return NextResponse.json({ error: 'Phone and password are required' }, { status: 400 });
    }

    const email = `${phone.replace('+', '')}@betvers.bet`;

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) throw new Error('Firebase API Key missing');

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const data = await res.json();
    if (!res.ok) {
      const msg = data.error?.message || '';
      if (msg === 'EMAIL_NOT_FOUND') {
        return NextResponse.json({ error: 'This phone number is not registered, please sign up' }, { status: 401 });
      }
      if (msg === 'INVALID_PASSWORD' || msg === 'INVALID_LOGIN_CREDENTIALS' || msg.includes('INVALID_LOGIN')) {
        return NextResponse.json({ error: 'Incorrect PIN, please try again' }, { status: 401 });
      }
      if (msg === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
        return NextResponse.json({ error: 'Too many failed attempts. Please try again later.' }, { status: 429 });
      }
      return NextResponse.json({ error: msg || 'Login failed' }, { status: 401 });
    }

    const uid = data.localId;

    let userData: any = null;
    try {
      const { data: user } = await supabaseAdmin.from('users').select('*').eq('id', uid).single();
      userData = user;
    } catch (err: any) {
      console.error('Supabase read failed during login (non-critical):', err?.message);
    }

    return NextResponse.json({
      token: data.idToken,
      user: {
        id: uid,
        phone: userData?.phone || phone,
        role: userData?.role || 'user',
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: err.message || 'Login failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
