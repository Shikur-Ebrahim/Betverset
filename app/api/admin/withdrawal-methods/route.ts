import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { name, type, logoUrl } = await req.json();
    if (!name || !type) {
      return NextResponse.json({ message: 'Name and type are required' }, { status: 400 });
    }

    // Check for duplicates using a single-field query (no composite index needed)
    const existing = await db.collection('withdrawal_methods')
      .where('name', '==', name)
      .get();
    const activeDuplicate = existing.docs.some((doc: any) => doc.data().active === true);
    if (activeDuplicate) {
      return NextResponse.json({ message: 'This method already exists' }, { status: 400 });
    }

    const docRef = db.collection('withdrawal_methods').doc();
    const data = {
      id: docRef.id,
      name,
      type,
      logo_url: logoUrl,
      active: true,
      created_at: new Date().toISOString(),
    };
    await docRef.set(data);
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Error adding withdrawal method:', err);
    return NextResponse.json({ message: 'Failed to add withdrawal method' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const snapshot = await db.collection('withdrawal_methods').get();
    let methods = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    methods = methods.filter((m: any) => m.active === true);
    methods.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    return NextResponse.json(methods);
  } catch (err: any) {
    console.error('Fetch withdrawal methods error:', err);
    return NextResponse.json({ message: 'Failed to fetch withdrawal methods' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
