import { NextResponse } from 'next/server';
import { verifyUser, unauthorized } from '@/lib/auth-helper';
import { checkWithdrawalDepositEligibility } from '@/lib/services/depositRule';
import { getDailyWithdrawalLimitInfo, MAX_DAILY_WITHDRAWAL_ETB } from '@/lib/services/withdrawalDailyLimit';


export async function GET(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const [eligibility, daily] = await Promise.all([
      checkWithdrawalDepositEligibility(userId),
      getDailyWithdrawalLimitInfo(userId),
    ]);

    return NextResponse.json({
      ...eligibility,
      maxDailyWithdrawal: MAX_DAILY_WITHDRAWAL_ETB,
      withdrawnToday: daily.withdrawnToday,
      remainingToday: daily.remainingToday,
    });
  } catch (err: any) {
    console.error('withdrawal-eligibility error:', err);
    return NextResponse.json({ message: 'Failed to check withdrawal eligibility' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
