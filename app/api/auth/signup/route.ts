import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generatePromotionCodeForPhone } from '@/lib/services/promotionCode';


export async function POST(req: Request) {
  try {
    const { phone, password } = await req.json();

    if (!phone || !password) {
      return NextResponse.json({ error: 'Phone and password are required' }, { status: 400 });
    }

    const email = `${phone.replace('+', '')}@betvers.bet`;

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) throw new Error('Firebase API Key missing');

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.error?.message === 'EMAIL_EXISTS') {
        return NextResponse.json({ error: 'Account already exists' }, { status: 400 });
      }
      return NextResponse.json({ error: data.error?.message || 'Failed to create account' }, { status: 400 });
    }

    const uid = data.localId;
    const idToken = data.idToken;

    // Create user in Supabase
    await supabaseAdmin.from('users').insert({
      id: uid,
      phone,
      role: 'user',
      balance: 0,
      currency: 'ETB',
      created_at: new Date().toISOString(),
    });

    // Generate promotion code — fire and forget
    generatePromotionCodeForPhone(phone).catch((err: any) => {
      console.error('Promo code generation failed (non-critical):', err?.message);
    });

    return NextResponse.json({
      message: 'Account created',
      token: idToken,
      user: { id: uid, phone, role: 'user' },
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create account' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
