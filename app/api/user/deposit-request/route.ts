import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';

export async function POST(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const { methodId, amount, senderName, accountDetails, screenshotUrl } = await req.json();

    if (!methodId || !amount) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('deposit_requests')
      .insert({
        user_id: userId,
        method_id: methodId,
        amount: Number(amount),
        sender_name: senderName || '',
        account_details: accountDetails || '',
        screenshot_url: screenshotUrl || '',
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ message: 'Deposit request submitted successfully', request: inserted }, { status: 201 });
  } catch (err: any) {
    console.error('Error submitting deposit request:', err);
    return NextResponse.json({ message: 'Failed to submit deposit request' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
