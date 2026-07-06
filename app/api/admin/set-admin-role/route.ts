import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { uid, adminSecret } = await req.json();

    if (!uid) {
      return NextResponse.json({ message: 'Missing uid' }, { status: 400 });
    }

    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ message: 'Invalid admin secret' }, { status: 403 });
    }

    await auth.setCustomUserClaims(uid, { admin: true });

    let phone = '';
    try {
      const userRec = await auth.getUser(uid);
      phone = userRec.phoneNumber || '';
    } catch (e) {
      console.error('Could not get phone from firebase auth', e);
    }

    // Upsert the user into Supabase just in case they don't exist yet, but make sure they are admin
    await supabaseAdmin.from('users').upsert({
      id: uid,
      role: 'admin',
      phone,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    return NextResponse.json({ message: `Success. User ${uid} is now an admin.` });
  } catch (error: any) {
    console.error('Error setting admin role:', error);
    return NextResponse.json({ message: 'Internal server error', error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
