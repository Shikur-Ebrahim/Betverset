import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  try {
    return NextResponse.json({ 
      status: 'ok', 
      dbProxyExists: !!db,
      env: {
        hasJson: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
        hasProjectId: !!process.env.FIREBASE_PROJECT_ID
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}

export const dynamic = 'force-dynamic';
