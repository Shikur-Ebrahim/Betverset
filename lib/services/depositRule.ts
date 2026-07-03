import { db } from '@/lib/firebase-admin';

export const WITHDRAWAL_MIN_DEPOSIT_KEY = 'withdrawal_min_total_deposit';
export const DEFAULT_MIN_TOTAL_DEPOSIT = 200;

export async function getWithdrawalMinTotalDeposit(): Promise<number> {
  const settingsDoc = await db.collection('app_settings').doc(WITHDRAWAL_MIN_DEPOSIT_KEY).get();
  if (!settingsDoc.exists) {
    return DEFAULT_MIN_TOTAL_DEPOSIT;
  }
  const amount = settingsDoc.data()?.value?.amount;
  return Number.isFinite(amount) && amount > 0 ? amount : DEFAULT_MIN_TOTAL_DEPOSIT;
}

export async function setWithdrawalMinTotalDeposit(amount: number): Promise<number> {
  await db.collection('app_settings').doc(WITHDRAWAL_MIN_DEPOSIT_KEY).set({
    value: { amount },
    updated_at: new Date().toISOString(),
  });
  return amount;
}

export async function getUserApprovedDepositTotal(userId: string): Promise<number> {
  const snapshot = await db.collection('deposit_requests')
    .where('user_id', '==', userId)
    .where('status', '==', 'approved')
    .get();

  const total = snapshot.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);
  return total;
}

export async function checkWithdrawalDepositEligibility(userId: string): Promise<{
  eligible: boolean;
  totalDeposits: number;
  minRequired: number;
}> {
  const [minRequired, totalDeposits] = await Promise.all([
    getWithdrawalMinTotalDeposit(),
    getUserApprovedDepositTotal(userId),
  ]);
  return {
    eligible: totalDeposits >= minRequired,
    totalDeposits,
    minRequired,
  };
}
