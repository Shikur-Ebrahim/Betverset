import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = require('firebase-admin/app');
    const firestore = require('firebase-admin/firestore');
    
    // Check if initializing throws
    let initStatus = 'not attempted';
    try {
      if (admin.getApps().length === 0) {
        admin.initializeApp({
          credential: admin.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
          })
        });
      }
      initStatus = 'success';
    } catch (e: any) {
      initStatus = 'failed: ' + e.message;
    }

    let dbStatus = 'not attempted';
    try {
      const db = firestore.getFirestore();
      dbStatus = 'success';
    } catch (e: any) {
      dbStatus = 'failed: ' + e.message;
    }
    
    return NextResponse.json({ 
      status: 'loaded',
      initStatus,
      dbStatus
    });
  } catch (err: any) {
    return NextResponse.json({ 
      error: 'Failed to load firebase-admin',
      message: err.message,
      stack: err.stack
    });
  }
}
