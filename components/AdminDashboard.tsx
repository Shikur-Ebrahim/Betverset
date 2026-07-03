'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { AdminBetSlip } from './AdminBetTickets';
import type { DepositTicket } from './DepositRequests';
import type { WithdrawalTicket } from './WithdrawalRequests';
import { getPublicApiBaseUrl } from '@/lib/public-api-url';

const API_BASE = getPublicApiBaseUrl();

const DepositManagement = dynamic(() => import('./DepositManagement'));
const DepositRequests = dynamic(() => import('./DepositRequests'));
const WithdrawalRequests = dynamic(() => import('./WithdrawalRequests'));
const WithdrawalManagement = dynamic(() => import('./WithdrawalManagement'));
const AdminBetTickets = dynamic(() => import('./AdminBetTickets'));
const AdminAccountSettings = dynamic(() => import('./AdminAccountSettings'));
const AdminDepositRuleSettings = dynamic(() => import('./AdminDepositRuleSettings'));
const AdminTelegramSettings = dynamic(() => import('./AdminTelegramSettings'));
const AdminUsersManagement = dynamic(() => import('./AdminUsersManagement'));
const AdminManualTicketCreator = dynamic(() => import('./AdminManualTicketCreator'));
const AdminPromoCodeGenerator = dynamic(() => import('./AdminPromoCodeGenerator'));

type AdminDashboardProps = {
  user: any;
  onLogout: () => void;
  onClose: () => void;
};

const adminActions = [
  { id: 'deposit', label: 'Deposits', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  ), color: 'bg-orange-500' },
  { id: 'withdrawals', label: 'Withdrawals', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l-7 7 7 7"/></svg>
  ), color: 'bg-orange-600' },
  { id: 'tickets', label: 'Tickets', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7Z"/><path d="M4 15h16"/><path d="M8 11V7a2 2 0 1 1 4 0v4"/><path d="M16 11V7a2 2 0 1 0-4 0v4"/></svg>
  ), color: 'bg-purple-500' },
  { id: 'createBet', label: 'Create Bet', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
  ), color: 'bg-green-500' },
  { id: 'withdrawalM', label: 'Withdrawal M', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ), color: 'bg-red-500' },
  { id: 'depositeM', label: 'Deposit M', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
  ), color: 'bg-teal-500' },
  { id: 'users', label: 'Users', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ), color: 'bg-indigo-500' },
  { id: 'depositRule', label: 'Deposit Rule', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  ), color: 'bg-amber-600' },
  { id: 'promo', label: 'Promo', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 12v8H4v-8"/><path d="M12 3l8 4H4l8-4z"/><path d="M12 11v6"/><path d="M9 14h6"/></svg>
  ), color: 'bg-pink-500' },
  { id: 'telegram', label: 'Telegram', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
  ), color: 'bg-sky-500' },
  { id: 'setting', label: 'Settings', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  ), color: 'bg-gray-700' },
];

export default function AdminDashboard({ user, onLogout, onClose }: AdminDashboardProps) {
  const [currentView, setCurrentView] = useState<
    | 'main'
    | 'users'
    | 'deposits_config'
    | 'deposits'
    | 'withdrawals'
    | 'bets'
    | 'games'
    | 'settings'
    | 'depositRule'
    | 'support'
    | 'depositM'
    | 'withdrawalM'
    | 'tickets'
    | 'createBet'
    | 'promo'
  >('main');
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingWithdrawalCount, setPendingWithdrawalCount] = useState(0);
  const [wonTicketCount, setWonTicketCount] = useState(0);
  const [cachedBetTickets, setCachedBetTickets] = useState<AdminBetSlip[] | null>(null);
  const [cachedDepositTickets, setCachedDepositTickets] = useState<DepositTicket[] | null>(null);
  const [cachedWithdrawalTickets, setCachedWithdrawalTickets] = useState<WithdrawalTicket[] | null>(null);
  const prefetchInFlightRef = useRef(false);

  const authHeaders = useCallback((): HeadersInit | null => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, []);

  /** Lightweight: badge counts only — runs on open and every 30s. */
  const refreshCounts = useCallback(async () => {
    try {
      const headers = authHeaders();
      if (!headers) return;
      const [depC, wdrC, ticketC] = await Promise.all([
        fetch(`${API_BASE}/admin/deposit-requests/count`, { headers }),
        fetch(`${API_BASE}/admin/withdrawal-requests/count`, { headers }),
        fetch(`${API_BASE}/admin/bet-tickets/won-count`, { headers }),
      ]);
      if (depC.ok) {
        const d = await depC.json();
        const n = Number(d.count);
        setPendingCount(Number.isFinite(n) ? n : 0);
      }
      if (wdrC.ok) {
        const w = await wdrC.json();
        const n = Number(w.count);
        setPendingWithdrawalCount(Number.isFinite(n) ? n : 0);
      }
      if (ticketC.ok) {
        const t = await ticketC.json();
        setWonTicketCount(typeof t.count === 'number' ? t.count : 0);
      }
    } catch (error) {
      console.error('Failed to fetch admin counts:', error);
    }
  }, [authHeaders]);

  /** Heavy lists — deferred so the hub opens instantly; also on demand before list screens. */
  const prefetchLists = useCallback(async () => {
    if (prefetchInFlightRef.current) return;
    prefetchInFlightRef.current = true;
    try {
      const headers = authHeaders();
      if (!headers) return;
      const [depList, wdrList, betList] = await Promise.all([
        fetch(`${API_BASE}/admin/deposit-requests`, { headers }),
        fetch(`${API_BASE}/admin/withdrawal-requests`, { headers }),
        fetch(`${API_BASE}/admin/bet-tickets`, { headers }),
      ]);
      if (depList.ok) {
        const arr = await depList.json();
        setCachedDepositTickets(Array.isArray(arr) ? arr : []);
      }
      if (wdrList.ok) {
        const arr = await wdrList.json();
        setCachedWithdrawalTickets(Array.isArray(arr) ? arr : []);
      }
      if (betList.ok) {
        const arr = await betList.json();
        setCachedBetTickets(Array.isArray(arr) ? arr : []);
      }
    } catch (error) {
      console.error('Failed to prefetch admin lists:', error);
    } finally {
      prefetchInFlightRef.current = false;
    }
  }, [authHeaders]);

  useEffect(() => {
    void refreshCounts();
    const deferLists =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(() => void prefetchLists())
        : window.setTimeout(() => void prefetchLists(), 400);
    const interval = setInterval(() => void refreshCounts(), 30_000);
    return () => {
      clearInterval(interval);
      if (typeof requestIdleCallback === 'function' && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(deferLists as number);
      } else {
        clearTimeout(deferLists as number);
      }
    };
  }, [refreshCounts, prefetchLists]);

  const openListView = (view: 'deposits' | 'withdrawals' | 'tickets') => {
    setCurrentView(view);
    void prefetchLists();
  };

  if (!user) return null;

  if (currentView === 'depositM') {
    return (
      <DepositManagement
        onClose={() => {
          setCurrentView('main');
          void refreshCounts();
        }}
      />
    );
  }

  if (currentView === 'deposits') {
    return (
      <DepositRequests
        initialTickets={cachedDepositTickets}
        onClose={() => {
          setCurrentView('main');
          void refreshCounts();
          void prefetchLists();
        }}
      />
    );
  }

  if (currentView === 'withdrawals') {
    return (
      <WithdrawalRequests
        initialTickets={cachedWithdrawalTickets}
        onClose={() => {
          setCurrentView('main');
          void refreshCounts();
          void prefetchLists();
        }}
      />
    );
  }

  if (currentView === 'withdrawalM') {
    return (
      <WithdrawalManagement
        onClose={() => {
          setCurrentView('main');
          void refreshCounts();
        }}
      />
    );
  }

  if (currentView === 'tickets') {
    return (
      <AdminBetTickets
        initialSlips={cachedBetTickets}
        onClose={() => {
          setCurrentView('main');
          void refreshCounts();
          void prefetchLists();
        }}
      />
    );
  }

  if (currentView === 'settings') {
    return <AdminAccountSettings user={user} onClose={() => setCurrentView('main')} />;
  }

  if (currentView === 'support') {
    return <AdminTelegramSettings onClose={() => setCurrentView('main')} />;
  }

  if (currentView === 'depositRule') {
    return <AdminDepositRuleSettings onClose={() => setCurrentView('main')} />;
  }

  if (currentView === 'users') {
    return <AdminUsersManagement onClose={() => setCurrentView('main')} />;
  }

  if (currentView === 'createBet') {
    return <AdminManualTicketCreator onClose={() => setCurrentView('main')} />;
  }

  if (currentView === 'promo') {
    return <AdminPromoCodeGenerator onClose={() => setCurrentView('main')} />;
  }

  return (
    <div className="fixed inset-0 z-[150] bg-white text-[#1A202C] flex flex-col h-screen overflow-hidden">
      {/* Top Header */}
      <header className="bg-white px-6 py-5 flex justify-between items-center shrink-0 border-b border-[#F1F5F9]">
        <div className="text-2xl italic font-black text-[#1A202C] tracking-tighter">BETVERS</div>
        <button
          onClick={onLogout}
          className="text-xs bg-[#F1F5F9] text-[#475569] px-5 py-2.5 rounded-full font-bold transition-all active:scale-95"
        >
          Logout
        </button>
      </header>

      <main className="flex-1 grid grid-cols-2 auto-rows-fr gap-3 p-4 overflow-y-auto">
        {adminActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => {
              if (action.id === 'depositeM') {
                setCurrentView('depositM');
                return;
              }
              if (action.id === 'deposit') {
                openListView('deposits');
                return;
              }
              if (action.id === 'withdrawals') {
                openListView('withdrawals');
                return;
              }
              if (action.id === 'withdrawalM') {
                setCurrentView('withdrawalM');
                return;
              }
              if (action.id === 'tickets') {
                openListView('tickets');
                return;
              }
              if (action.id === 'telegram') {
                setCurrentView('support');
                return;
              }
              if (action.id === 'setting') {
                setCurrentView('settings');
                return;
              }
              if (action.id === 'depositRule') {
                setCurrentView('depositRule');
                return;
              }
              if (action.id === 'users') {
                setCurrentView('users');
                return;
              }
              if (action.id === 'createBet') {
                setCurrentView('createBet');
                return;
              }
              if (action.id === 'promo') {
                setCurrentView('promo');
                return;
              }
            }}
            className="relative z-10 flex h-full min-h-[96px] w-full flex-col items-center justify-center gap-2.5 rounded-2xl border border-[#F1F5F9] bg-[#F8FAFC] transition-all active:scale-95"
          >
            {action.id === 'deposit' && pendingCount > 0 && (
              <div className="pointer-events-none absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-lg shadow-red-200">
                {pendingCount > 99 ? '99+' : pendingCount}
              </div>
            )}
            {action.id === 'withdrawals' && pendingWithdrawalCount > 0 && (
              <div className="pointer-events-none absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-lg shadow-red-200">
                {pendingWithdrawalCount > 99 ? '99+' : pendingWithdrawalCount}
              </div>
            )}
            {action.id === 'tickets' && wonTicketCount > 0 && (
              <div className="pointer-events-none absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-[10px] font-black text-white shadow-lg shadow-purple-200">
                {wonTicketCount > 99 ? '99+' : wonTicketCount}
              </div>
            )}
            <div className={`w-10 h-10 ${action.color} rounded-xl flex items-center justify-center text-white shadow-sm`}>
              {action.icon}
            </div>
            <span className="text-[11px] font-black text-[#1A202C] uppercase tracking-tight">{action.label}</span>
          </button>
        ))}
      </main>
    </div>
  );
}