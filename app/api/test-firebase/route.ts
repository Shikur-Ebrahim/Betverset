import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const admin = await import('firebase-admin');
    return NextResponse.json({ 
      status: 'ok', 
      firebaseAdminLoaded: !!admin
    });
  } catch (err: any) {
    return NextResponse.json({ 
      error: 'Failed to import firebase-admin',
      message: err.message,
      stack: err.stack,
      code: err.code
    });
  }
}

export const dynamic = 'force-dynamic';
