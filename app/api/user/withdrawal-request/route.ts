import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';
import { checkDailyWithdrawalLimit } from '@/lib/services/withdrawalDailyLimit';
import { checkWithdrawalDepositEligibility } from '@/lib/services/depositRule';


export async function POST(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const { methodId, amount, accountName, accountDetails, promoCode } = await req.json();

    if (!methodId || !amount || !accountName || !accountDetails) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const requestedAmount = parseFloat(String(amount));
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json({ message: 'Invalid withdrawal amount' }, { status: 400 });
    }

    // 1. Check if user is eligible based on deposit history
    const eligibility = await checkWithdrawalDepositEligibility(userId);
    if (!eligibility.eligible) {
      return NextResponse.json({
        message: `You must deposit at least ${eligibility.minRequired} ETB before you can make a withdrawal. (Current total: ${eligibility.totalDeposits})`
      }, { status: 400 });
    }

    // 2. Check daily limits
    const limitCheck = await checkDailyWithdrawalLimit(userId, requestedAmount);
    if (!limitCheck.allowed) {
      return NextResponse.json({ message: limitCheck.message }, { status: 400 });
    }

    // 3. Get user balance
    const { data: userData } = await supabaseAdmin.from('users').select('balance').eq('id', userId).single();
    if (!userData) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const balance = Number(userData.balance) || 0;
    if (balance < requestedAmount) {
      return NextResponse.json({ message: `Insufficient balance. You only have ${balance.toFixed(2)} ETB.` }, { status: 400 });
    }

    // 4. Update balance (deduct upfront)
    const { error: updateError } = await supabaseAdmin.from('users').update({
      balance: balance - requestedAmount
    }).eq('id', userId);

    if (updateError) {
      return NextResponse.json({ message: 'Failed to deduct balance' }, { status: 500 });
    }

    // 5. Insert request
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('withdrawal_requests')
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        method_id: methodId,
        amount: requestedAmount,
        holder_name: accountName,
        account_number: accountDetails,
        agent_code: promoCode || '',
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      // Rollback
      await supabaseAdmin.from('users').update({ balance }).eq('id', userId);
      throw insertError;
    }

    return NextResponse.json({ message: 'Withdrawal request submitted', request: inserted }, { status: 201 });
  } catch (err: any) {
    console.error('Error submitting withdrawal request:', err);
    return NextResponse.json({ message: 'Failed to submit withdrawal request' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
