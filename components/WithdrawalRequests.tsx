'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { broadcastWalletSyncAcrossTabs } from '../lib/ui-events';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';

const API_BASE = getPublicApiBaseUrl();

export type WithdrawalTicket = {
  id: number;
  user_id: number;
  phone: string;
  method_name: string | null;
  amount: string | number;
  account_name: string;
  account_details: string;
  promo_code?: string;
  status: 'pending' | 'approved';
  created_at: string;
};

type WithdrawalRequestsProps = {
  onClose: () => void;
  initialTickets?: WithdrawalTicket[] | null;
};

export default function WithdrawalRequests({ onClose, initialTickets = null }: WithdrawalRequestsProps) {
  const [tickets, setTickets] = useState<WithdrawalTicket[]>(() =>
    Array.isArray(initialTickets) ? initialTickets : []
  );
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<{ id: number; type: 'approve' | 'reject' } | null>(null);
  const ticketsRef = useRef<WithdrawalTicket[]>([]);
  const fetchGenRef = useRef(0);
  ticketsRef.current = tickets;

  const fetchTickets = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    const showBlockingLoader = ticketsRef.current.length === 0;
    if (showBlockingLoader) setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/withdrawal-requests`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      if (fetchGenRef.current !== gen) return;
      setTickets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch withdrawal requests:', error);
      if (fetchGenRef.current === gen && ticketsRef.current.length === 0) setTickets([]);
    } finally {
      if (fetchGenRef.current === gen) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tickets]);

  const handleAction = async () => {
    if (!confirming) return;
    const { id, type } = confirming;

    setProcessingId(id);
    setConfirming(null);

    try {
      const url =
        type === 'approve'
          ? `${API_BASE}/admin/withdrawal-requests/${id}/approve`
          : `${API_BASE}/admin/withdrawal-requests/${id}`;

      const response = await fetch(url, {
        method: type === 'approve' ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (response.ok) {
        broadcastWalletSyncAcrossTabs();
        if (type === 'approve') {
          setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'approved' as const } : t)));
        } else {
          setTickets((prev) => prev.filter((t) => t.id !== id));
        }
      } else {
        alert(`Failed to ${type} withdrawal`);
      }
    } catch (error) {
      console.error(`${type} error:`, error);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingN = tickets.filter((t) => t.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-[160] flex h-screen flex-col overflow-hidden bg-[#F8FAFC] text-[#1A202C]">
      <header className="flex shrink-0 items-center justify-between border-b border-[#F1F5F9] bg-white px-6 py-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-500 transition-all active:scale-90"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-xl font-black tracking-tighter text-[#1A202C]">Withdrawal requests</div>
        </div>
        <div className="rounded-full bg-orange-100 px-3 py-1.5 text-[10px] font-black tracking-widest text-orange-600">
          {pendingN} pending
        </div>
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto p-4 pb-24">
        {loading && tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500" />
            <p className="text-sm font-medium text-slate-500">Loading requests…</p>
          </div>
        ) : sortedTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-40 opacity-40">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-100">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l-7 7 7 7" />
              </svg>
            </div>
            <div className="text-xs font-black tracking-[0.2em]">No withdrawal queue</div>
          </div>
        ) : (
          sortedTickets.map((t) => (
            <div
              key={t.id}
              className={`relative space-y-4 overflow-hidden rounded-[28px] border bg-white p-5 shadow-sm ${
                t.status === 'approved' ? 'border-green-100' : 'border-gray-100'
              } animate-in slide-in-from-bottom-4 duration-300`}
            >
              {t.status === 'approved' && (
                <div className="absolute right-0 top-0 flex items-center gap-1.5 rounded-bl-2xl bg-green-500 px-4 py-1.5 text-[9px] font-black tracking-widest text-white">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Paid out
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                      t.status === 'approved' ? 'bg-green-50 text-green-500' : 'bg-orange-50 text-orange-500'
                    }`}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l-7 7 7 7" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black tracking-tight text-gray-900">{t.phone}</div>
                    <div className="text-[10px] font-bold tracking-wider text-gray-400">
                      {t.method_name || 'Method'} ·{' '}
                      {new Date(t.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-black leading-none text-black">{t.amount}</div>
                  <div
                    className={`mt-1 text-[9px] font-black tracking-widest ${
                      t.status === 'approved' ? 'text-green-500' : 'text-orange-500'
                    }`}
                  >
                    ETB
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#F8FAFC] p-4 text-xs font-bold text-gray-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pay to</p>
                <p className="mt-1 font-black text-gray-900">{t.account_name}</p>
                <p className="mt-1 break-all text-gray-600">{t.account_details}</p>
                {t.promo_code && (
                  <div className="mt-3 border-t border-gray-200 pt-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Agent Code</p>
                    <p className="mt-0.5 font-mono text-sm font-black text-gray-900">{t.promo_code}</p>
                  </div>
                )}
              </div>

              {t.status === 'pending' && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirming({ id: t.id, type: 'reject' })}
                    disabled={processingId === t.id}
                    className="flex-1 rounded-2xl bg-red-50 py-4 text-[11px] font-black text-red-500 transition-all active:scale-95"
                  >
                    Reject (refund)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming({ id: t.id, type: 'approve' })}
                    disabled={processingId === t.id}
                    className="flex-[2] rounded-2xl bg-gray-900 py-4 text-[11px] font-black text-white shadow-lg transition-all active:scale-95"
                  >
                    {processingId === t.id ? 'Processing…' : 'Mark paid out'}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </main>

      {confirming && (
        <div className="fixed inset-0 z-[200] flex animate-in items-center justify-center p-6 fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirming(null)} />
          <div className="relative w-full max-w-[280px] space-y-6 rounded-[32px] bg-white p-8 text-center shadow-2xl animate-in zoom-in-95 duration-300">
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                confirming.type === 'approve' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'
              }`}
            >
              {confirming.type === 'approve' ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xl font-black tracking-tight text-gray-900">
                Confirm {confirming.type === 'approve' ? 'payout' : 'rejection'}
              </div>
              <p className="text-xs font-medium leading-relaxed text-gray-500">
                {confirming.type === 'approve'
                  ? 'User balance was already reduced when they requested this. Confirm you sent the funds externally.'
                  : 'The withheld amount will be returned to the user wallet immediately.'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleAction}
                className={`w-full rounded-2xl py-4 text-xs font-black text-white transition-all active:scale-95 ${
                  confirming.type === 'approve' ? 'bg-green-500 shadow-lg shadow-green-100' : 'bg-red-500 shadow-lg shadow-red-100'
                }`}
              >
                Yes, {confirming.type === 'approve' ? 'mark paid' : 'reject & refund'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="w-full py-4 text-[10px] font-black text-gray-400 transition-colors hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
