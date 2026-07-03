import { auth, db } from './firebase-admin';
import { NextResponse } from 'next/server';

export async function verifyUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function verifyAdmin(req: Request): Promise<string | null> {
  const uid = await verifyUser(req);
  if (!uid) return null;
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') return null;
  return uid;
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ message }, { status: 401 });
}

export function forbidden(message = 'Require Admin Role') {
  return NextResponse.json({ message }, { status: 403 });
}
