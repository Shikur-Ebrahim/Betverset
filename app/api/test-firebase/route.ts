import { NextResponse } from 'next/server';
import { getApps } from 'firebase-admin/app';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const apps = getApps();
    let dbStatus = 'Not initialized';
    let dbError = null;
    let docCount = -1;

    try {
      // Force init by accessing proxy
      const coll = db.collection('users');
      dbStatus = 'Proxy accessed, getting data...';
      
      // Try to fetch a single doc to see if it hangs or throws
      const snap = await coll.limit(1).get();
      dbStatus = 'Connected successfully';
      docCount = snap.size;
    } catch (e: any) {
      dbStatus = 'Error connecting';
      dbError = e.message;
    }

    return NextResponse.json({
      status: 'ok',
      hasApps: apps.length > 0,
      appName: apps.length > 0 ? apps[0].name : null,
      projectIdEnv: !!process.env.FIREBASE_PROJECT_ID,
      clientEmailEnv: !!process.env.FIREBASE_CLIENT_EMAIL,
      privateKeyEnv: !!process.env.FIREBASE_PRIVATE_KEY,
      privateKeyLength: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0,
      serviceAccountEnv: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      serviceAccountLength: process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? process.env.FIREBASE_SERVICE_ACCOUNT_KEY.length : 0,
      dbStatus,
      dbError,
      docCount
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
