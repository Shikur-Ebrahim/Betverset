import { NextResponse } from 'next/server';
import { getApps } from 'firebase-admin/app';
import { db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '';

    // Check if it's hanging on db connect
    let dbConnected = false;
    let connectError = null;
    
    // Don't actually await it, just trigger the proxy
    try {
      db.collection('users');
      dbConnected = true;
    } catch (e: any) {
      connectError = e.message;
    }

    return NextResponse.json({
      env: {
        NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
        FIREBASE_PRIVATE_KEY_LENGTH: rawKey.length,
        FIREBASE_PRIVATE_KEY_START: rawKey.substring(0, 30),
        FIREBASE_PRIVATE_KEY_HAS_NEWLINES: rawKey.includes('\n'),
        FIREBASE_PRIVATE_KEY_HAS_ESCAPED: rawKey.includes('\\n'),
        FIREBASE_SERVICE_ACCOUNT_KEY_LENGTH: sa.length,
        FIREBASE_SERVICE_ACCOUNT_KEY_START: sa.substring(0, 30),
      },
      dbConnected,
      connectError
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
