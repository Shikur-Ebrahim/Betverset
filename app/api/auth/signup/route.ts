import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';
import { generatePromotionCodeForPhone } from '@/lib/services/promotionCode';


export async function POST(req: Request) {
  try {
    const { phone, password } = await req.json();

    if (!phone || !password) {
      return NextResponse.json({ error: 'Phone and password are required' }, { status: 400 });
    }

    const email = `${phone.replace('+', '')}@betvers.bet`;

    try {
      // Create user in Firebase Auth
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: phone,
      });

      const userDocRef = db.collection('users').doc(userRecord.uid);
      
      const userData = {
        phone,
        role: 'user',
        balance: 0,
        createdAt: new Date().toISOString(),
      };

      await userDocRef.set(userData);

      // Generate a promotion code for the new user
      await generatePromotionCodeForPhone(phone);

      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (!apiKey) throw new Error('Firebase API Key missing');

      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Login failed after signup');
      }

      return NextResponse.json({
        message: 'Account created',
        token: data.idToken,
        user: { id: userRecord.uid, phone, role: 'user' },
      });
    } catch (err: any) {
      if (err.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: 'Account already exists' }, { status: 400 });
      }
      throw err;
    }
  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: err.message, stack: err.stack, code: err.code }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
