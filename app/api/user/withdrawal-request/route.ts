import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';
import { checkWithdrawalDepositEligibility } from '@/lib/services/depositRule';
import { checkDailyWithdrawalLimit, MAX_DAILY_WITHDRAWAL_ETB } from '@/lib/services/withdrawalDailyLimit';
import { validatePromotionCodeForUser } from '@/lib/services/promotionCode';


export async function POST(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const body = await req.json();
    const { methodId, amount, accountName, accountDetails, promoCode } = body;
    const amt = Number(amount);

    if (!methodId || !Number.isFinite(amt) || amt < 100) {
      return NextResponse.json({ message: 'Valid method and amount (min 100 ETB) are required' }, { status: 400 });
    }
    if (!accountName?.trim() || !accountDetails?.trim()) {
      return NextResponse.json({ message: 'Account name and details are required' }, { status: 400 });
    }

    const pendingCheck = await db.collection('withdrawal_requests')
      .where('user_id', '==', userId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
      
    if (!pendingCheck.empty) {
      return NextResponse.json({ message: 'You already have a withdrawal in processing. Wait for it to complete.' }, { status: 400 });
    }

    const { eligible, totalDeposits, minRequired } = await checkWithdrawalDepositEligibility(userId);
    if (!eligible) {
      return NextResponse.json({
        message: `To withdraw in Betvers betting, your total approved deposits must reach ${minRequired} ETB. You have deposited ${totalDeposits.toFixed(2)} ETB so far.`,
        code: 'DEPOSIT_RULE_NOT_MET',
        totalDeposits,
        minRequired,
      }, { status: 400 });
    }

    const promoCheck = await validatePromotionCodeForUser(userId, promoCode);
    if (!promoCheck.valid) {
      return NextResponse.json({
        message: promoCheck.message || 'Invalid promotion code',
        code: 'PROMO_CODE_INVALID',
      }, { status: 400 });
    }

    const dailyCheck = await checkDailyWithdrawalLimit(userId, amt);
    if (!dailyCheck.allowed) {
      return NextResponse.json({
        message: dailyCheck.message,
        code: 'DAILY_WITHDRAWAL_LIMIT',
        maxDailyWithdrawal: MAX_DAILY_WITHDRAWAL_ETB,
        withdrawnToday: dailyCheck.withdrawnToday,
        remainingToday: dailyCheck.remainingToday,
      }, { status: 400 });
    }

    const resultData = await db.runTransaction(async (transaction: any) => {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const currentBalance = Number(userDoc.data()?.balance) || 0;
      if (currentBalance < amt) {
        throw new Error('Insufficient balance');
      }

      // Deduct balance
      transaction.update(userRef, { balance: currentBalance - amt });

      // Create withdrawal request
      const requestRef = db.collection('withdrawal_requests').doc();
      const requestData = {
        id: requestRef.id,
        user_id: userId,
        method_id: methodId,
        amount: amt,
        account_name: accountName.trim(),
        account_details: accountDetails.trim(),
        promo_code: promoCode ? promoCode.trim().toUpperCase() : null,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      transaction.set(requestRef, requestData);

      return requestData;
    });

    return NextResponse.json(resultData, { status: 201 });
  } catch (err: any) {
    console.error('Withdrawal error:', err);
    return NextResponse.json({ message: err.message || 'Failed to process withdrawal' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
