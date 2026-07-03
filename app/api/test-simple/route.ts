import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = require('firebase-admin/app');
    const firestore = require('firebase-admin/firestore');
    
    return NextResponse.json({ 
      status: 'loaded',
      hasAppsFunction: typeof admin.getApps === 'function',
      hasFirestoreFunction: typeof firestore.getFirestore === 'function'
    });
  } catch (err: any) {
    return NextResponse.json({ 
      error: 'Failed to load firebase-admin',
      message: err.message,
      stack: err.stack
    });
  }
}
