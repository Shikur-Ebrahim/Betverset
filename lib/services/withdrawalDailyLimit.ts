import { db } from '@/lib/firebase-admin';

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

  // Firestore doesn't easily sum across queries like SQL SUM() with date filters without indexes and pulling all docs.
  // We'll query today's non-rejected withdrawals for the user.
  const snapshot = await db.collection('withdrawal_requests')
    .where('user_id', '==', userId)
    .where('created_at', '>=', start)
    .where('created_at', '<=', end)
    .get();

  const withdrawnToday = snapshot.docs
    .filter(doc => doc.data().status !== 'rejected' && doc.data().status !== 'failed')
    .reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);

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
