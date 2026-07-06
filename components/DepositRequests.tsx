'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { broadcastWalletSyncAcrossTabs } from '../lib/ui-events';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';

const API_BASE = getPublicApiBaseUrl();

export type DepositTicket = {
  id: number;
  user_id: number;
  phone: string;
  method_name: string;
  amount: number;
  screenshot_url: string;
  status: 'pending' | 'approved';
  created_at: string;
};

type DepositRequestsProps = {
  onClose: () => void;
  /** Prefetched list so the screen can show rows immediately (like user Bet history). */
  initialTickets?: DepositTicket[] | null;
};

export default function DepositRequests({ onClose, initialTickets = null }: DepositRequestsProps) {
  const [tickets, setTickets] = useState<DepositTicket[]>(() => (Array.isArray(initialTickets) ? initialTickets : []));
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<{
    id: number;
    type: 'approve' | 'reject' | 'deleteVerified';
    amount?: number;
  } | null>(null);
  const ticketsRef = useRef<DepositTicket[]>([]);
  const fetchGenRef = useRef(0);
  ticketsRef.current = tickets;

  /** When the dashboard prefetch lands after this screen mounted with an empty list, hydrate like Tickets + initialSlips. */
  useEffect(() => {
    if (!Array.isArray(initialTickets)) return;
    setTickets((prev) => (prev.length === 0 ? initialTickets : prev));
  }, [initialTickets]);

  const fetchTickets = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    try {
      const response = await fetch(`${API_BASE}/admin/deposit-requests`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      if (fetchGenRef.current !== gen) return;
      setTickets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      if (fetchGenRef.current === gen && ticketsRef.current.length === 0) setTickets([]);
    }
  }, []);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  // Sort tickets: Pending first, then by date
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
          ? `${API_BASE}/admin/deposit-requests/${id}/approve`
          : `${API_BASE}/admin/deposit-requests/${id}`;

      const response = await fetch(url, {
        method: type === 'approve' ? 'POST' : 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        if (type === 'approve') {
          broadcastWalletSyncAcrossTabs();
          setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'approved' as const } : t)));
        } else {
          if (type === 'deleteVerified') broadcastWalletSyncAcrossTabs();
          setTickets((prev) => prev.filter((t) => t.id !== id));
        }
      } else {
        const data = await response.json().catch(() => ({}));
        const msg = (data as { message?: string }).message;
        alert(msg || `Failed to ${type} deposit`);
      }
    } catch (error) {
      console.error(`${type} error:`, error);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] bg-[var(--site-bg)] text-slate-900 flex flex-col h-screen overflow-hidden">
      <header className="bg-[var(--site-surface)] px-6 py-5 flex items-center justify-between shrink-0 border-b border-[var(--site-border)]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--site-bg)] text-gray-500 transition-all active:scale-90"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div className="text-xl font-black text-slate-900 tracking-tighter">Deposit requests</div>
        </div>
        <div className="bg-orange-100 text-orange-600 text-[10px] font-black px-3 py-1.5 rounded-full tracking-widest">{tickets.filter(t => t.status === 'pending').length} New</div>
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto p-4 pb-24">
        {sortedTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-40">
            <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div className="text-xs font-black tracking-[0.2em]">All caught up</div>
          </div>
        ) : (
          sortedTickets.map((t) => (
            <div key={t.id} className={`bg-[var(--site-surface)] rounded-[28px] p-5 shadow-sm border ${t.status === 'approved' ? 'border-green-100' : 'border-[var(--site-border)]'} space-y-4 animate-in slide-in-from-bottom-4 duration-300 relative overflow-hidden`}>
              {t.status === 'approved' && (
                <div className="absolute top-0 right-0 bg-green-500 text-white px-4 py-1.5 rounded-bl-2xl text-[9px] font-black tracking-widest flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                  Verified
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${t.status === 'approved' ? 'bg-green-50 text-green-500' : 'bg-orange-50 text-orange-500'} rounded-xl flex items-center justify-center shadow-sm`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-900 tracking-tight">{t.phone}</div>
                    <div className="text-[10px] text-gray-400 font-bold tracking-wider">{t.method_name} • {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-slate-900 leading-none">{t.amount}</div>
                  <div className={`text-[9px] font-black tracking-widest mt-1 ${t.status === 'approved' ? 'text-green-500' : 'text-orange-500'}`}>ETB</div>
                </div>
              </div>

              <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-[var(--site-surface-soft)] group">
                <img 
                  src={t.screenshot_url} 
                  alt="Proof" 
                  className="w-full h-full object-contain cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => window.open(t.screenshot_url, '_blank')}
                />
              </div>

              {t.status === 'pending' ? (
                <div className="flex gap-3">
                  <button 
                    onClick={() => setConfirming({ id: t.id, type: 'reject' })}
                    disabled={processingId === t.id}
                    className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-[11px] active:scale-95 transition-all"
                  >
                    Reject
                  </button>
                  <button 
                    onClick={() => setConfirming({ id: t.id, type: 'approve' })}
                    disabled={processingId === t.id}
                    className="flex-[2] py-4 bg-gray-900 text-white rounded-2xl font-black text-[11px] active:scale-95 transition-all shadow-lg"
                  >
                    {processingId === t.id ? 'Processing...' : 'Approve ticket'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming({ id: t.id, type: 'deleteVerified', amount: t.amount })}
                  disabled={processingId === t.id}
                  className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black text-[11px] active:scale-95 transition-all border border-red-100"
                >
                  {processingId === t.id ? 'Processing...' : 'Delete verified deposit'}
                </button>
              )}
            </div>
          ))
        )}
      </main>

      {/* Custom Confirmation Overlay */}
      {confirming && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirming(null)}></div>
          <div className="relative bg-[var(--site-surface)] w-full max-w-[280px] rounded-[32px] p-8 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${confirming.type === 'approve' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
              {confirming.type === 'approve' ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="text-xl font-black text-slate-900 tracking-tight">
                {confirming.type === 'approve'
                  ? 'Confirm approval'
                  : confirming.type === 'deleteVerified'
                    ? 'Delete verified deposit'
                    : 'Confirm rejection'}
              </div>
              <p className="text-xs font-medium text-gray-500 leading-relaxed">
                {confirming.type === 'approve'
                  ? 'This will add the balance to the user account immediately.'
                  : confirming.type === 'deleteVerified'
                    ? `This will permanently remove the deposit and deduct ${confirming.amount ?? ''} ETB from the user's wallet.`
                    : 'This request will be permanently deleted from the system.'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={handleAction}
                className={`w-full py-4 rounded-2xl font-black text-xs transition-all active:scale-95 text-white ${confirming.type === 'approve' ? 'bg-green-500 shadow-green-100' : 'bg-red-500 shadow-red-100'} shadow-lg`}
              >
                {confirming.type === 'approve'
                  ? 'Yes, approve'
                  : confirming.type === 'deleteVerified'
                    ? 'Yes, delete'
                    : 'Yes, reject'}
              </button>
              <button 
                onClick={() => setConfirming(null)}
                className="w-full py-4 text-gray-400 font-black text-[10px] hover:text-gray-400 transition-colors"
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
