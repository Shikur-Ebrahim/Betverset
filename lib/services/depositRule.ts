import { supabaseAdmin } from '@/lib/supabase-admin';

export const WITHDRAWAL_MIN_DEPOSIT_KEY = 'withdrawal_min_total_deposit';
export const DEFAULT_MIN_TOTAL_DEPOSIT = 200;

export async function getWithdrawalMinTotalDeposit(): Promise<number> {
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', WITHDRAWAL_MIN_DEPOSIT_KEY).single();
  if (!data) return DEFAULT_MIN_TOTAL_DEPOSIT;
  const amount = (data.value as any)?.amount;
  return Number.isFinite(amount) && amount > 0 ? amount : DEFAULT_MIN_TOTAL_DEPOSIT;
}

export async function setWithdrawalMinTotalDeposit(amount: number): Promise<number> {
  await supabaseAdmin.from('app_settings').upsert(
    { key: WITHDRAWAL_MIN_DEPOSIT_KEY, value: { amount } },
    { onConflict: 'key' }
  );
  return amount;
}

export async function getUserApprovedDepositTotal(userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('deposit_requests')
    .select('amount, status')
    .eq('user_id', userId);

  const total = (data || [])
    .filter((row: any) => row.status === 'approved')
    .reduce((sum: number, row: any) => sum + (Number(row.amount) || 0), 0);
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
