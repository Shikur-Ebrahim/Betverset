'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';

const API_BASE = getPublicApiBaseUrl();

type BetSelection = {
  fixture_id: number | null;
  selection: string;
  odd: number;
  result: string | null;
  home_team: string;
  away_team: string;
  home_logo: string | null;
  away_logo: string | null;
  league_name: string;
  market_name: string;
};

export type AdminBetSlip = {
  id: number;
  user_id: number;
  user_phone: string | null;
  ticket_code: string | null;
  stake: string;
  total_odds: string;
  possible_win: string;
  status: string;
  created_at: string;
  selections: BetSelection[] | string;
};

function parseSelections(raw: BetSelection[] | string): BetSelection[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw) as unknown;
      return Array.isArray(v) ? (v as BetSelection[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function tabLabel(tab: 'all' | 'pending' | 'won' | 'lost'): string {
  if (tab === 'all') return 'All';
  if (tab === 'pending') return 'Open';
  return tab.charAt(0).toUpperCase() + tab.slice(1);
}

function slipStatusNorm(status: string): 'pending' | 'won' | 'lost' | 'other' {
  const x = (status || '').trim().toLowerCase();
  if (x === 'won') return 'won';
  if (x === 'lost') return 'lost';
  if (x === 'pending') return 'pending';
  return 'other';
}

function statusBadgeClass(s: string): string {
  const x = (s || '').toLowerCase();
  if (x === 'won') return 'bg-emerald-100 text-emerald-800';
  if (x === 'lost') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-900';
}

function statusLabel(s: string): string {
  const x = (s || '').toLowerCase();
  if (x === 'won') return 'Won';
  if (x === 'lost') return 'Lost';
  if (x === 'pending') return 'Open';
  return s || '—';
}

type AdminBetTicketsProps = {
  onClose: () => void;
  /** Prefetched from admin dashboard so opening this screen can show data immediately. */
  initialSlips?: AdminBetSlip[] | null;
};

export default function AdminBetTickets({ onClose, initialSlips = null }: AdminBetTicketsProps) {
  const [slips, setSlips] = useState<AdminBetSlip[]>(() => (Array.isArray(initialSlips) ? initialSlips : []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'won' | 'lost'>('all');
  const slipsRef = useRef<AdminBetSlip[]>([]);
  const fetchGenRef = useRef(0);
  slipsRef.current = slips;

  const fetchTickets = useCallback(async () => {
    setError(null);
    const gen = ++fetchGenRef.current;
    const showBlockingLoader = slipsRef.current.length === 0;
    if (showBlockingLoader) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/bet-tickets`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message || `Failed (${res.status})`);
      }
      const data = await res.json();
      if (fetchGenRef.current !== gen) return;
      setSlips(Array.isArray(data) ? data : []);
    } catch (e) {
      if (fetchGenRef.current !== gen) return;
      setError(e instanceof Error ? e.message : 'Could not load tickets');
      if (slipsRef.current.length === 0) setSlips([]);
    } finally {
      if (fetchGenRef.current === gen) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  const filteredSlips = useMemo(() => {
    if (activeTab === 'all') return slips;
    return slips.filter((s) => slipStatusNorm(s.status) === activeTab);
  }, [slips, activeTab]);

  const sortedSlips = useMemo(() => {
    return [...filteredSlips].sort((a, b) => {
      const ap = slipStatusNorm(a.status) === 'pending' ? 0 : 1;
      const bp = slipStatusNorm(b.status) === 'pending' ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredSlips]);

  return (
    <div className="fixed inset-0 z-[160] flex h-screen flex-col overflow-hidden bg-[var(--site-bg)] text-white">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--site-border)] bg-[var(--site-surface)] px-6 py-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--site-bg)] text-gray-500 transition-all active:scale-90"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="text-xl font-black tracking-tighter text-white">All tickets</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {slips.length} slip{slips.length === 1 ? '' : 's'}
              {activeTab !== 'all' ? ` · ${sortedSlips.length} in ${tabLabel(activeTab)}` : ''}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchTickets()}
          className="rounded-full bg-purple-50 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-purple-700 transition active:scale-95"
        >
          Refresh
        </button>
      </header>

      <div className="shrink-0 border-b border-[var(--site-border)] bg-[var(--site-surface)] px-2 sm:px-3">
        <nav className="mx-auto flex max-w-lg gap-1" aria-label="Filter tickets">
          {(['all', 'pending', 'won', 'lost'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative flex-1 py-3.5 text-sm font-semibold transition-colors ${
                activeTab === tab ? 'text-white' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tabLabel(tab)}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-purple-600" />
              )}
            </button>
          ))}
        </nav>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 pb-10">
        {loading && slips.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--site-border)] border-t-orange-500" />
            <p className="text-sm font-medium text-slate-500">Loading tickets…</p>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md rounded-2xl bg-red-50 p-6 text-center text-sm font-bold text-red-700">
            {error}
          </div>
        ) : sortedSlips.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-slate-400">
            <svg className="h-16 w-16 opacity-25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" ry="1" />
            </svg>
            <p className="text-sm font-bold text-slate-500">
              {slips.length === 0 ? 'No bet tickets yet' : 'No tickets in this filter'}
            </p>
          </div>
        ) : (
          <ul className="mx-auto flex max-w-lg flex-col gap-3">
            {sortedSlips.map((slip) => {
              const legs = parseSelections(slip.selections);
              const hasTicketCode = slip.ticket_code != null && String(slip.ticket_code).trim() !== '';
              const codePlain = hasTicketCode ? String(slip.ticket_code).replace(/^#/, '').trim() : '';
              const ticketLine = hasTicketCode ? `code:${codePlain}` : `ID ${slip.id}`;
              return (
                <li
                  key={slip.id}
                  className="overflow-hidden rounded-2xl border border-[var(--site-border)]/90 bg-[var(--site-surface)] shadow-sm ring-1 ring-black/[0.03]"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--site-border)] bg-[var(--site-bg)]/80 px-3 py-2.5 sm:px-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Ticket</p>
                      <p className="truncate font-mono text-sm font-semibold text-white">{ticketLine}</p>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                        User #{slip.user_id}
                        {slip.user_phone ? ` · ${slip.user_phone}` : ''}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(slip.status)}`}
                    >
                      {statusLabel(slip.status)}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 px-3 py-2 sm:px-4">
                    {legs.map((sel, idx) => {
                      const lr = (sel.result || '').trim().toLowerCase();
                      const legWon = lr === 'won';
                      const legLost = lr === 'lost';
                      return (
                        <div
                          key={`${slip.id}-${idx}`}
                          className={`py-2.5 first:pt-2 last:pb-2 ${
                            legWon
                              ? 'rounded-lg bg-emerald-50/80 px-2'
                              : legLost
                                ? 'rounded-lg bg-red-50/80 px-2'
                                : ''
                          }`}
                        >
                          <p className="text-[10px] font-medium text-slate-500">{sel.league_name}</p>
                          <div className="mt-1.5 space-y-1">
                            <div className="flex items-center gap-2">
                              {sel.home_logo ? (
                                <img src={sel.home_logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
                              ) : null}
                              <span className="truncate text-xs font-semibold text-gray-200">{sel.home_team}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {sel.away_logo ? (
                                <img src={sel.away_logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
                              ) : null}
                              <span className="truncate text-xs font-semibold text-gray-200">{sel.away_team}</span>
                            </div>
                          </div>
                          <p className="mt-2 text-[11px] text-slate-500">
                            {sel.market_name}: <span className="font-semibold text-orange-600">{sel.selection}</span>{' '}
                            @ {Number(sel.odd).toFixed(2)}
                            {sel.result ? (
                              <span className="ml-1 font-semibold text-slate-600">({sel.result})</span>
                            ) : null}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-slate-800/15 bg-slate-900 px-3 py-3 text-white sm:px-4">
                    <div>
                      <p className="text-[9px] font-medium text-slate-400">Stake</p>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums">{Number(slip.stake).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-medium text-slate-400">Odds</p>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums">{Number(slip.total_odds).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-medium text-orange-200/90">Potential</p>
                      <p className="mt-0.5 text-xs font-bold tabular-nums text-orange-400">
                        {Number(slip.possible_win).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <p className="border-t border-[var(--site-border)] px-3 py-2 text-[10px] text-slate-400 sm:px-4">
                    {new Date(slip.created_at).toLocaleString()}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
