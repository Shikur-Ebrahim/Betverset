import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


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
      if (data.error?.message === 'EMAIL_NOT_FOUND') {
        throw new Error('This phone number is not registered, please signup now');
      }
      if (data.error?.message === 'INVALID_PASSWORD' || data.error?.message === 'INVALID_LOGIN_CREDENTIALS') {
        throw new Error('Incorrect pin please enter correct password');
      }
      throw new Error(data.error?.message || 'Login failed');
    }

    const uid = data.localId;
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    return NextResponse.json({
      token: data.idToken,
      user: { 
        id: uid, 
        phone: userData?.phone || phone, 
        role: userData?.role || 'user' 
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
}

export const dynamic = 'force-dynamic';
