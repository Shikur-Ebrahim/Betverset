import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';

export async function POST(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const { currentPassword, newPassword } = await req.json();

    const authHeader = req.headers.get('authorization');
    const idToken = authHeader?.split('Bearer ')[1];
    
    if (!idToken) {
      return NextResponse.json({ message: 'No token provided' }, { status: 401 });
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    const { data: userData } = await supabaseAdmin.from('users').select('phone').eq('id', userId).single();
    const phone = userData?.phone;
    if (!phone) {
      return NextResponse.json({ message: 'User phone not found' }, { status: 400 });
    }
    const email = `${phone.replace('+', '')}@betvers.bet`;

    const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: currentPassword, returnSecureToken: true }),
    });

    if (!verifyRes.ok) {
      return NextResponse.json({ message: 'Incorrect current password' }, { status: 400 });
    }

    const verifyData = await verifyRes.json();
    const freshIdToken = verifyData.idToken;

    const updateRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: freshIdToken,
        password: newPassword,
        returnSecureToken: true
      }),
    });

    if (!updateRes.ok) {
      const errorData = await updateRes.json();
      console.error('REST API password update failed:', errorData);
      return NextResponse.json({ message: 'Failed to update password' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (err: any) {
    console.error('Error changing password:', err);
    return NextResponse.json({ message: 'Failed to change password' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
