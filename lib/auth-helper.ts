import { auth, db } from './firebase-admin';
import { NextResponse } from 'next/server';

export async function verifyUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch (err) {
    console.error('[verifyUser] verifyIdToken failed:', err);
    return null;
  }
}

export async function verifyAdmin(req: Request): Promise<string | null> {
  // Completely bypassed all token verification for admin routes as requested
  return "bypassed-admin";
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ message }, { status: 401 });
}

export function forbidden(message = 'Require Admin Role') {
  return NextResponse.json({ message }, { status: 403 });
}
