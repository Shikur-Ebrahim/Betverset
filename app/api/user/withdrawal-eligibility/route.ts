import { NextResponse } from 'next/server';
import { verifyUser, unauthorized } from '@/lib/auth-helper';
import { checkWithdrawalDepositEligibility } from '@/lib/services/depositRule';
import { getDailyWithdrawalLimitInfo, MAX_DAILY_WITHDRAWAL_ETB } from '@/lib/services/withdrawalDailyLimit';

export async function GET(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const [eligibility, limits] = await Promise.all([
      checkWithdrawalDepositEligibility(userId),
      getDailyWithdrawalLimitInfo(userId),
    ]);

    return NextResponse.json({
      eligible: eligibility.eligible,
      totalDeposits: eligibility.totalDeposits,
      minRequired: eligibility.minRequired,
      withdrawnToday: limits.withdrawnToday,
      remainingToday: limits.remainingToday,
      dailyLimit: MAX_DAILY_WITHDRAWAL_ETB,
    });
  } catch (err: any) {
    console.error('Error fetching withdrawal eligibility:', err);
    return NextResponse.json({ message: 'Failed to fetch withdrawal eligibility' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
