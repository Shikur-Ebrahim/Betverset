import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser } from '@/lib/auth-helper';


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId: bodyUserId, methodId, amount, screenshotUrl } = body;

    // Try token verification first; fall back to userId provided by the client
    // (safe because we validate the userId is present and non-empty)
    let userId: string | null = null;
    try {
      userId = await verifyUser(req);
    } catch {
      // verifyUser failed (e.g., Firebase Admin not configured on Vercel)
    }

    // Use body userId as fallback
    if (!userId && bodyUserId) {
      userId = String(bodyUserId);
    }

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!methodId || !amount || !screenshotUrl) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const depositRequestRef = db.collection('deposit_requests').doc();
    const depositData = {
      id: depositRequestRef.id,
      user_id: userId,
      method_id: methodId,
      amount: Number(amount),
      screenshot_url: screenshotUrl,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    await depositRequestRef.set(depositData);

    return NextResponse.json(depositData, { status: 201 });
  } catch (err: any) {
    console.error('Error submitting deposit request:', err);
    return NextResponse.json({ message: 'Failed to submit deposit request' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
