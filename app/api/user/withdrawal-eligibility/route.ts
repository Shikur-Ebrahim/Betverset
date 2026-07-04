import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth-helper';
import { checkWithdrawalDepositEligibility, getWithdrawalMinTotalDeposit } from '@/lib/services/depositRule';
import { getDailyWithdrawalLimitInfo, MAX_DAILY_WITHDRAWAL_ETB } from '@/lib/services/withdrawalDailyLimit';


export async function GET(req: Request) {
  try {
    // Always load the admin-set minimum deposit rule (public)
    const minRequired = await getWithdrawalMinTotalDeposit();

    // Try to get user-specific data if logged in
    let eligible = false;
    let totalDeposits = 0;
    let withdrawnToday = 0;
    let remainingToday = MAX_DAILY_WITHDRAWAL_ETB;

    try {
      const userId = await verifyUser(req);
      if (userId) {
        const [eligibility, daily] = await Promise.all([
          checkWithdrawalDepositEligibility(userId),
          getDailyWithdrawalLimitInfo(userId),
        ]);
        eligible = eligibility.eligible;
        totalDeposits = eligibility.totalDeposits;
        withdrawnToday = daily.withdrawnToday;
        remainingToday = daily.remainingToday;
      }
    } catch {
      // Ignore auth errors - return defaults
    }

    return NextResponse.json({
      eligible,
      totalDeposits,
      minRequired,
      maxDailyWithdrawal: MAX_DAILY_WITHDRAWAL_ETB,
      withdrawnToday,
      remainingToday,
    });
  } catch (err: any) {
    console.error('withdrawal-eligibility error:', err);
    return NextResponse.json({ message: 'Failed to check withdrawal eligibility' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
