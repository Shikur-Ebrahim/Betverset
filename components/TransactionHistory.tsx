'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BETVERS_DEPOSIT_PROOF_SUBMITTED_EVENT } from '@/lib/ui-events';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';

const API_BASE = getPublicApiBaseUrl();

type Transaction = {
  id: number;
  screenshot_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

type TransactionHistoryProps = {
  isOpen: boolean;
  onClose: () => void;
  user: { id: number } | null;
};

export default function TransactionHistory({ isOpen, onClose, user }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bootstrapped, setBootstrapped] = useState(false);
  const fetchGenRef = useRef(0);

  const fetchHistory = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!user?.id || !token) {
      setTransactions([]);
      setBootstrapped(false);
      return;
    }
    const gen = ++fetchGenRef.current;
    try {
      const response = await fetch(`${API_BASE}/user/deposit-history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (fetchGenRef.current !== gen) return;
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      if (fetchGenRef.current !== gen) return;
      setTransactions([]);
    } finally {
      if (fetchGenRef.current === gen) setBootstrapped(true);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      fetchGenRef.current += 1;
      setTransactions([]);
      setBootstrapped(false);
      return;
    }
    void fetchHistory();
  }, [user?.id, fetchHistory]);

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    void fetchHistory();
  }, [isOpen, user?.id, fetchHistory]);

  useEffect(() => {
    const onDepositProof = () => {
      if (user?.id != null) void fetchHistory();
    };
    window.addEventListener(BETVERS_DEPOSIT_PROOF_SUBMITTED_EVENT, onDepositProof);
    return () => window.removeEventListener(BETVERS_DEPOSIT_PROOF_SUBMITTED_EVENT, onDepositProof);
  }, [user?.id, fetchHistory]);

  if (!user?.id) return null;

  const showBlockingLoader = !bootstrapped;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-end justify-center sm:items-center ${
        isOpen ? '' : 'pointer-events-none invisible'
      }`}
      aria-hidden={!isOpen}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={() => isOpen && onClose()}
        aria-hidden
      />

      <div className="relative flex h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[32px] bg-[#F8FAFC] shadow-2xl animate-in slide-in-from-bottom duration-300 sm:h-auto sm:rounded-[32px]">
        <header className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6 py-6">
          <div className="text-2xl font-black tracking-tighter text-[#1A202C]">My Uploads</div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-all active:scale-90"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-20">
          {showBlockingLoader ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-32 opacity-40">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-100 text-gray-400">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                  <path d="M12 12v9" />
                  <path d="m8 17 4 4 4-4" />
                </svg>
              </div>
              <div className="text-xs font-black uppercase tracking-widest">No photos uploaded</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="group relative aspect-[3/4] animate-in overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm zoom-in-95 duration-300"
                >
                  <img
                    src={t.screenshot_url}
                    alt="Deposit Proof"
                    className="h-full w-full cursor-pointer object-cover transition-transform group-hover:scale-105"
                    onClick={() => window.open(t.screenshot_url, '_blank')}
                  />

                  <div className="absolute right-2 top-2">
                    <div
                      className={`h-3 w-3 rounded-full border-2 border-white shadow-sm ${
                        t.status === 'approved'
                          ? 'bg-green-500'
                          : t.status === 'rejected'
                            ? 'bg-red-500'
                            : 'bg-orange-500'
                      }`}
                    />
                  </div>

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="text-[9px] font-black uppercase tracking-widest text-white">
                      {new Date(t.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
