'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { BETVERS_WALLET_UPDATED_EVENT, broadcastWalletSyncAcrossTabs } from '../lib/ui-events';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';
import WithdrawalDepositRuleBanner from './WithdrawalDepositRuleBanner';
import WithdrawalAgentCodeHint from './WithdrawalAgentCodeHint';
import WithdrawalDailyLimitBanner from './WithdrawalDailyLimitBanner';

const API_BASE = getPublicApiBaseUrl();
const MIN_WITHDRAW = 100;
const MAX_DAILY_WITHDRAW = 100_000;

type WithdrawalMethod = {
  id: number;
  name: string;
  type: 'bank' | 'wallet';
  logo_url: string;
};

type HistoryRow = {
  id: number;
  amount: string | number;
  status: string;
  method_name: string | null;
  created_at: string;
  account_name?: string;
};

type WithdrawalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  user: any;
};

async function syncWalletToStorageAndBroadcast() {
  try {
    const { balance } = await api.getWalletBalance();
    const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (!raw) return;
    const u = JSON.parse(raw) as Record<string, unknown>;
    const next = { ...u, balance };
    localStorage.setItem('user', JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(BETVERS_WALLET_UPDATED_EVENT, { detail: { balance } }));
    broadcastWalletSyncAcrossTabs();
  } catch {
    /* ignore */
  }
}

export default function WithdrawalModal({ isOpen, onClose, user }: WithdrawalModalProps) {
  const [step, setStep] = useState<'selection' | 'details' | 'success'>('selection');
  const [methods, setMethods] = useState<WithdrawalMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountDetails, setAccountDetails] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoPromptVisible, setPromoPromptVisible] = useState(false);
  const promoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [pendingSummary, setPendingSummary] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [depositEligible, setDepositEligible] = useState(false);
  const [eligibilityLoaded, setEligibilityLoaded] = useState(false);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [minDepositRequired, setMinDepositRequired] = useState(6665);
  const [withdrawnToday, setWithdrawnToday] = useState(0);
  const [remainingToday, setRemainingToday] = useState(MAX_DAILY_WITHDRAW);
  const methodsRef = useRef<WithdrawalMethod[]>([]);
  const fetchGenRef = useRef(0);
  const userStateGenRef = useRef(0);
  methodsRef.current = methods;

  const fetchMethods = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    const block = methodsRef.current.length === 0;
    if (block) setMethodsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/withdrawal-methods`);
      const data = await response.json();
      if (fetchGenRef.current !== gen) return;
      setMethods(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch methods:', err);
      if (fetchGenRef.current === gen) setMethods([]);
    } finally {
      if (fetchGenRef.current === gen) setMethodsLoading(false);
    }
  }, []);

  const loadUserWithdrawalState = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!user?.id || !token) {
      setHasPending(false);
      setPendingSummary(null);
      setHistory([]);
      setDepositEligible(false);
      setEligibilityLoaded(false);
      return;
    }
    const gen = ++userStateGenRef.current;
    setEligibilityLoaded(false);
    setHistoryLoading(true);
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const [pendRes, histRes, eligRes] = await Promise.all([
        fetch(`${API_BASE}/user/pending-withdrawal`, { headers }),
        fetch(`${API_BASE}/user/withdrawal-history`, { headers }),
        fetch(`${API_BASE}/user/withdrawal-eligibility`, { headers }),
      ]);
      const pendData = pendRes.ok ? await pendRes.json().catch(() => ({})) : {};
      const histData = histRes.ok ? await histRes.json().catch(() => []) : [];
      const eligData = await eligRes.json().catch(() => ({}));
      if (userStateGenRef.current !== gen) return;

      const pending = Boolean(pendData?.hasPending);
      setHasPending(pending);
      setDepositEligible(Boolean((eligData as { eligible?: boolean }).eligible));
      const td = Number((eligData as { totalDeposits?: number }).totalDeposits);
      const mr = Number((eligData as { minRequired?: number }).minRequired);
      setTotalDeposits(Number.isFinite(td) ? td : 0);
      setMinDepositRequired(Number.isFinite(mr) && mr > 0 ? mr : 200);
      const wt = Number((eligData as { withdrawnToday?: number }).withdrawnToday);
      const rt = Number((eligData as { remainingToday?: number }).remainingToday);
      setWithdrawnToday(Number.isFinite(wt) ? wt : 0);
      setRemainingToday(Number.isFinite(rt) ? rt : MAX_DAILY_WITHDRAW);
      const req = pendData?.request as { amount?: string | number; method_name?: string } | null;
      if (pending && req) {
        setPendingSummary(`${req.amount} ETB · ${req.method_name || 'Withdrawal'} — processing`);
      } else {
        setPendingSummary(null);
      }
      setHistory(Array.isArray(histData) ? histData : []);
    } catch {
      if (userStateGenRef.current === gen) {
        setHasPending(false);
        setHistory([]);
      }
    } finally {
      if (userStateGenRef.current === gen) {
        setHistoryLoading(false);
        setEligibilityLoaded(true);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      fetchGenRef.current += 1;
      userStateGenRef.current += 1;
      setMethods([]);
      setMethodsLoading(false);
      return;
    }
    void fetchMethods();
  }, [user?.id, fetchMethods]);

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    setAmount('');
    setAccountName('');
    setAccountDetails('');
    setPromoCode('');
    setPromoPromptVisible(false);
    setSelectedMethod(null);
    setError(null);
    setStep('selection');
    void fetchMethods();
    void loadUserWithdrawalState();
  }, [isOpen, user?.id, fetchMethods, loadUserWithdrawalState]);

  const validateWithdrawalAmount = (val: number): string | null => {
    if (!Number.isFinite(val) || val < MIN_WITHDRAW) {
      return `Enter at least ${MIN_WITHDRAW} ETB`;
    }
    if (val > MAX_DAILY_WITHDRAW) {
      return `Maximum withdrawal per request is ${MAX_DAILY_WITHDRAW.toLocaleString()} ETB`;
    }
    if (eligibilityLoaded && val > remainingToday) {
      if (remainingToday <= 0) {
        return `Daily withdrawal limit reached (${MAX_DAILY_WITHDRAW.toLocaleString()} ETB per day)`;
      }
      return `You can withdraw up to ${remainingToday.toLocaleString()} ETB more today`;
    }
    if (val > (user?.balance || 0)) {
      return 'Insufficient balance';
    }
    return null;
  };

  const handleMethodSelect = (method: WithdrawalMethod) => {
    if (eligibilityLoaded && !depositEligible) {
      setError(null);
      return;
    }
    const val = parseFloat(amount);
    const amountError = validateWithdrawalAmount(val);
    if (amountError) {
      setError(amountError);
      return;
    }
    setSelectedMethod(method);
    setError(null);
    setStep('details');
  };

  useEffect(() => {
    if (!promoPromptVisible) return;
    const t = window.setTimeout(() => promoInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [promoPromptVisible]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositEligible) {
      setError(null);
      return;
    }
    if (!accountName?.trim() || !accountDetails?.trim()) {
      setError('Please fill all details');
      return;
    }

    const submitAmount = parseFloat(amount);
    const amountError = validateWithdrawalAmount(submitAmount);
    if (amountError) {
      setError(amountError);
      return;
    }

    if (depositEligible && !promoPromptVisible) {
      setPromoPromptVisible(true);
      setError(null);
      return;
    }

    if (!promoCode.trim()) {
      setError('Please enter correct agent ID code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/user/withdrawal-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          userId: user.id,
          methodId: selectedMethod?.id,
          amount: parseFloat(amount),
          accountName,
          accountDetails,
          promoCode: promoCode.trim().toUpperCase(),
        }),
      });

      if (response.ok) {
        await syncWalletToStorageAndBroadcast();
        setStep('success');
        setHasPending(true);
        setPendingSummary(`${amount} ETB · ${selectedMethod?.name || 'Withdrawal'} — processing`);
        void loadUserWithdrawalState();
      } else {
        const data = await response.json().catch(() => ({})) as {
          message?: string;
          code?: string;
          withdrawnToday?: number;
          remainingToday?: number;
        };
        const msg =
          data.code === 'PROMO_CODE_INVALID'
            ? 'Please enter correct agent ID code'
            : data.code === 'DAILY_WITHDRAWAL_LIMIT'
              ? data.message || `Daily withdrawal limit is ${MAX_DAILY_WITHDRAW.toLocaleString()} ETB`
              : data.message || 'Failed to process withdrawal';
        if (data.code === 'DAILY_WITHDRAWAL_LIMIT') {
          const wt = Number(data.withdrawnToday);
          const rt = Number(data.remainingToday);
          if (Number.isFinite(wt)) setWithdrawnToday(wt);
          if (Number.isFinite(rt)) setRemainingToday(rt);
        }
        setError(msg);
        setPromoPromptVisible(true);
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  if (!user?.id) return null;

  const showMethodsSkeleton = step === 'selection' && methodsLoading && methods.length === 0;
  const showPromoField =
    promoPromptVisible && eligibilityLoaded && depositEligible && step === 'details' && !hasPending;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col bg-[#EEF4FF] text-[#111827] ${isOpen ? '' : 'pointer-events-none invisible'}`}
      aria-hidden={!isOpen}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-[#FFFFFF] px-4 py-4 sm:px-5">
        <div>
          <h1 className="text-lg font-black tracking-tight text-[#111827] sm:text-xl">Withdrawal</h1>
          <p className="mt-0.5 text-[11px] font-bold text-slate-500">Funds are held until support completes payout</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-95"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 pb-28 sm:px-5">
            {hasPending && (
              <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-amber-950">Withdrawal processing</p>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-900/90">
                      {pendingSummary || 'Your request is being reviewed. Balance is already adjusted.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 'selection' && !hasPending && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="rounded-2xl border border-slate-200 bg-[#FFFFFF] p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Available</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">
                    {Number(user?.balance || 0).toFixed(2)} <span className="text-sm text-orange-600">ETB</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-[11px] font-black text-gray-400">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full rounded-[20px] border-2 border-transparent bg-[#FFFFFF] px-6 py-4 text-lg font-black text-gray-900 shadow-sm outline-none ring-1 ring-slate-200 transition-all focus:border-orange-500 focus:ring-orange-200"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300">
                      ETB
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold italic text-gray-400">Minimum {MIN_WITHDRAW} ETB</span>
                    <span className="text-[10px] font-bold italic text-gray-400">
                      Max {MAX_DAILY_WITHDRAW.toLocaleString()} ETB / day
                    </span>
                  </div>
                </div>

                {eligibilityLoaded && depositEligible && (
                  <WithdrawalDailyLimitBanner
                    maxDaily={MAX_DAILY_WITHDRAW}
                    withdrawnToday={withdrawnToday}
                    remainingToday={remainingToday}
                  />
                )}

                <div className="space-y-3">
                  <label className="ml-1 text-[11px] font-black text-gray-400">Payout method</label>
                  {showMethodsSkeleton ? (
                    <div className="grid grid-cols-2 gap-4">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-[64px] animate-pulse rounded-2xl bg-gray-100" />
                      ))}
                    </div>
                  ) : methods.length === 0 ? (
                    <p className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-xs font-semibold text-slate-600">
                      No payout methods yet. Please contact support.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {methods.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleMethodSelect(m)}
                          className="relative flex h-[64px] items-center justify-center rounded-2xl border border-slate-100 bg-[#FFFFFF] shadow-sm transition-all hover:bg-gray-50 active:scale-95"
                        >
                          <img src={m.logo_url} alt="" className="h-full w-full object-contain p-2" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {eligibilityLoaded && !depositEligible && amount && Number(amount) > 0 && (user?.balance ?? 0) > 0 && (
                  <WithdrawalDepositRuleBanner
                    minDepositRequired={minDepositRequired}
                    totalDeposits={totalDeposits}
                  />
                )}

                {error && (
                  <div className="rounded-[18px] bg-red-50 p-4 text-center text-[10px] font-black text-red-500">{error}</div>
                )}
              </div>
            )}

            {step === 'details' && selectedMethod && !hasPending && (
              <form onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="flex items-center gap-4 rounded-2xl bg-[#FFFFFF] p-4 shadow-sm ring-1 ring-slate-100">
                  <div className="h-12 w-12 rounded-xl bg-[#EEF4FF] p-2 shadow-inner">
                    <img src={selectedMethod.logo_url} alt="" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-gray-900">{selectedMethod.name}</div>
                    <div className="text-[11px] font-black text-orange-500">{amount} ETB</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="wd-name" className="ml-1 text-[11px] font-black text-gray-400">
                      Full name
                    </label>
                    <input
                      id="wd-name"
                      type="text"
                      placeholder="Account holder name"
                      className="w-full rounded-[20px] border-2 border-transparent bg-[#FFFFFF] px-5 py-4 font-bold text-gray-900 shadow-sm ring-1 ring-slate-200 outline-none transition-all focus:border-orange-500 focus:ring-orange-200"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="wd-details" className="ml-1 text-[11px] font-black text-gray-400">
                      {selectedMethod.type === 'bank' ? 'Account number' : 'Mobile number'}
                    </label>
                    <input
                      id="wd-details"
                      type="text"
                      placeholder={selectedMethod.type === 'bank' ? 'Enter bank account' : 'Enter phone number'}
                      className="w-full rounded-[20px] border-2 border-transparent bg-[#FFFFFF] px-5 py-4 font-bold text-gray-900 shadow-sm ring-1 ring-slate-200 outline-none transition-all focus:border-orange-500 focus:ring-orange-200"
                      value={accountDetails}
                      onChange={(e) => setAccountDetails(e.target.value)}
                    />
                  </div>
                </div>

                {eligibilityLoaded && !depositEligible && (
                  <WithdrawalDepositRuleBanner
                    minDepositRequired={minDepositRequired}
                    totalDeposits={totalDeposits}
                  />
                )}

                {showPromoField && (
                  <div className="space-y-3 animate-in fade-in duration-300">
                    <WithdrawalAgentCodeHint />
                    <div className="space-y-2">
                    <label htmlFor="wd-agent-code" className="ml-1 text-[11px] font-black text-gray-400">
                      Enter agent ID code
                    </label>
                    <input
                      ref={promoInputRef}
                      id="wd-agent-code"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={10}
                      className="w-full rounded-[20px] border-2 border-transparent bg-[#FFFFFF] px-5 py-4 font-mono text-lg font-black uppercase tracking-wider text-gray-900 shadow-sm ring-1 ring-slate-200 outline-none transition-all focus:border-orange-500 focus:ring-orange-200"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value.toUpperCase());
                        if (error) setError(null);
                      }}
                    />
                    </div>
                  </div>
                )}

                {error && depositEligible && (
                  <div className="rounded-[18px] bg-red-50 p-4 text-center text-[10px] font-black text-red-500">{error}</div>
                )}

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={loading || !depositEligible}
                    className="w-full rounded-[24px] bg-green-500 py-5 text-sm font-black text-white shadow-xl shadow-green-100 transition-all active:scale-95 disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    {loading ? 'Submitting…' : 'Withdraw'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPromoPromptVisible(false);
                      setPromoCode('');
                      setError(null);
                      setStep('selection');
                    }}
                    className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-gray-400"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}

            {step === 'success' && (
              <div className="space-y-6 py-8 text-center animate-in zoom-in-95 duration-300">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-500">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <div className="text-xl font-black tracking-tight text-gray-900">Submitted</div>
                  <p className="text-[11px] font-bold leading-relaxed text-gray-500">
                    Your wallet balance has been updated. Support will complete your payout or contact you if needed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('selection');
                    void loadUserWithdrawalState();
                  }}
                  className="w-full rounded-[24px] bg-green-500 py-5 text-sm font-black text-white transition-all active:scale-95"
                >
                  Done
                </button>
              </div>
            )}

            <section className="mt-8 border-t border-slate-200 pt-6">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Your withdrawals</h2>
              {historyLoading && history.length === 0 ? (
                <div className="flex h-24 items-center justify-center">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500" />
                </div>
              ) : history.length === 0 ? (
                <p className="mt-3 text-center text-xs font-semibold text-slate-400">No history yet</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-[#FFFFFF] px-3 py-3 text-xs shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-black text-slate-900">{h.method_name || 'Withdrawal'}</p>
                        <p className="text-[10px] font-semibold capitalize text-slate-500">
                          {h.status} · {new Date(h.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                      <span className="shrink-0 font-black tabular-nums text-slate-900">{h.amount} ETB</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
      </main>
    </div>
  );
}
