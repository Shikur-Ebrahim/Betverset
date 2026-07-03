import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';


export async function POST(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const body = await req.json();
    const { methodId, amount, screenshotUrl } = body;

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
