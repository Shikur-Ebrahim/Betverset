import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';


export async function POST(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const { currentPassword, newPassword } = await req.json();

    const userRecord = await auth.getUser(userId);
    const email = userRecord.email;

    if (!email) {
      return NextResponse.json({ message: 'User email not found' }, { status: 400 });
    }

    // Verify current password via REST API
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: currentPassword, returnSecureToken: true }),
    });

    if (!res.ok) {
      return NextResponse.json({ message: 'Incorrect current password' }, { status: 400 });
    }

    // Update password
    await auth.updateUser(userId, { password: newPassword });

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (err: any) {
    console.error('Error changing password:', err);
    return NextResponse.json({ message: 'Failed to change password' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
