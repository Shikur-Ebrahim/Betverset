import { supabaseAdmin } from '@/lib/supabase-admin';

export const MAX_DAILY_WITHDRAWAL_ETB = 8000;

function getTodayRangeUTC() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getDailyWithdrawalLimitInfo(userId: string): Promise<{
  withdrawnToday: number;
  remainingToday: number;
}> {
  const { start, end } = getTodayRangeUTC();

  const { data } = await supabaseAdmin
    .from('withdrawal_requests')
    .select('amount, status, created_at')
    .eq('user_id', userId);

  const withdrawnToday = (data || [])
    .filter((row: any) => {
      const createdAt = row.created_at || '';
      return (
        createdAt >= start &&
        createdAt <= end &&
        row.status !== 'rejected' &&
        row.status !== 'failed'
      );
    })
    .reduce((sum: number, row: any) => sum + (Number(row.amount) || 0), 0);

  const remainingToday = Math.max(0, MAX_DAILY_WITHDRAWAL_ETB - withdrawnToday);
  return { withdrawnToday, remainingToday };
}

export async function checkDailyWithdrawalLimit(
  userId: string,
  requestedAmount: number
): Promise<{ allowed: boolean; withdrawnToday: number; remainingToday: number; message: string }> {
  const { withdrawnToday, remainingToday } = await getDailyWithdrawalLimitInfo(userId);
  
  if (requestedAmount > remainingToday) {
    if (remainingToday <= 0) {
      return {
        allowed: false,
        withdrawnToday,
        remainingToday,
        message: `Daily withdrawal limit of ${MAX_DAILY_WITHDRAWAL_ETB} ETB reached. Please try again tomorrow.`,
      };
    }
    return {
      allowed: false,
      withdrawnToday,
      remainingToday,
      message: `Daily withdrawal limit is ${MAX_DAILY_WITHDRAWAL_ETB} ETB. You can only withdraw ${remainingToday.toFixed(2)} ETB more today.`,
    };
  }

  return { allowed: true, withdrawnToday, remainingToday, message: 'Allowed' };
}
