import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';

// ONE-TIME USE: Set a user as admin by email
// Protected by CRON_SECRET so only you can call it
// DELETE this file after use for security

const CRON_SECRET = process.env.CRON_SECRET || '';

export async function GET(req: Request) {
  // Require secret
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const email = searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'email param required' }, { status: 400 });
  }

  try {
    // Get user from Firebase Auth
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;

    // Set admin role in Firestore users collection
    await db.collection('users').doc(uid).set(
      { role: 'admin', email: email, uid },
      { merge: true }
    );

    // Also set custom claim on Firebase Auth token
    await auth.setCustomUserClaims(uid, { role: 'admin' });

    return NextResponse.json({
      ok: true,
      message: `✅ ${email} is now admin`,
      uid,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
