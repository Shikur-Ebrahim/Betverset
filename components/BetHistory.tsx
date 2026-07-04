'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { BETVERS_BET_PLACED_EVENT } from '@/lib/ui-events';

type BetSelection = {
  fixture_id: number | null;
  selection: string;
  odd: number;
  result: string | null;
  home_team: string;
  away_team: string;
  home_logo: string;
  away_logo: string;
  league_name: string;
  market_name: string;
  kickoff_at?: string | null;
};

type BetSlip = {
  id: number;
  ticket_code: string | null;
  stake: string;
  total_odds: string;
  possible_win: string;
  status: 'pending' | 'won' | 'lost';
  created_at: string;
  selections: BetSelection[];
};

type BetHistoryProps = {
  isOpen: boolean;
  onClose: () => void;
  user: { id: number } | null;
};

function titleCaseWords(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function tabLabel(tab: 'all' | 'pending' | 'won' | 'lost'): string {
  if (tab === 'all') return 'All';
  return tab.charAt(0).toUpperCase() + tab.slice(1);
}

function slipStatusLabel(status: string): string {
  if (status === 'won') return 'Won';
  if (status === 'lost') return 'Lost';
  return 'Open';
}

function legResultLabel(result: string | null | undefined): string | null {
  const r = (result || '').trim().toLowerCase();
  if (r === 'won') return 'Won';
  if (r === 'lost') return 'Lost';
  return null;
}

function formatKickoffAt(value: string | null | undefined): string | null {
  if (value == null || String(value).trim() === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function ticketCodePlain(code: string | null | undefined): string {
  if (code == null) return '';
  return String(code).replace(/^#/, '').trim();
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function BetHistory({ isOpen, onClose, user }: BetHistoryProps) {
  const [bets, setBets] = useState<BetSlip[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'won' | 'lost'>('all');
  const [copiedBetId, setCopiedBetId] = useState<number | null>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const betsRef = useRef<BetSlip[]>([]);
  const fetchGenRef = useRef(0);
  betsRef.current = bets;

  const copyTicketCode = useCallback(async (bet: BetSlip) => {
    const text = ticketCodePlain(bet.ticket_code);
    if (!text) return;
    const ok = await writeClipboard(text);
    if (!ok) return;
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
    setCopiedBetId(bet.id);
    copyResetRef.current = setTimeout(() => {
      setCopiedBetId(null);
      copyResetRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  const fetchHistory = useCallback(async () => {
    const userId = user?.id;
    if (userId == null) {
      setBets([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    const gen = ++fetchGenRef.current;
    const showBlockingLoader = betsRef.current.length === 0;
    if (showBlockingLoader) setLoading(true);
    try {
      const data = await api.getBetHistory(userId);
      if (fetchGenRef.current !== gen) return;
      setBets(Array.isArray(data) ? (data as BetSlip[]) : []);
      setLoadError(null);
    } catch (err) {
      console.error('Failed to fetch history:', err);
      if (fetchGenRef.current !== gen) return;
      setBets([]);
      setLoadError(err instanceof Error ? err.message : 'Could not load bet history');
    } finally {
      if (fetchGenRef.current === gen) setLoading(false);
    }
  }, [user?.id]);

  /** Prefetch as soon as the user is known so opening the modal can show data immediately. */
  useEffect(() => {
    if (user?.id == null) {
      fetchGenRef.current += 1;
      setBets([]);
      setLoading(false);
      return;
    }
    void fetchHistory();
  }, [user?.id, fetchHistory]);

  /** Soft refresh whenever the sheet opens (list already visible if prefetch finished). */
  useEffect(() => {
    if (!isOpen || user?.id == null) return;
    void fetchHistory();
  }, [isOpen, user?.id, fetchHistory]);

  useEffect(() => {
    const onBetPlaced = () => {
      if (user?.id != null) void fetchHistory();
    };
    window.addEventListener(BETVERS_BET_PLACED_EVENT, onBetPlaced);
    return () => window.removeEventListener(BETVERS_BET_PLACED_EVENT, onBetPlaced);
  }, [user?.id, fetchHistory]);

  const filteredBets = activeTab === 'all' ? bets : bets.filter((b) => b.status === activeTab);

  if (user?.id == null) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4 ${
        isOpen ? '' : 'pointer-events-none invisible'
      }`}
      aria-hidden={!isOpen}
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={() => isOpen && onClose()}
        aria-hidden
      />

      <div
        role="dialog"
        aria-labelledby="bet-history-title"
        className="relative flex h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-[0_-8px_40px_rgba(0,0,0,0.12)] sm:h-[min(85vh,680px)] sm:rounded-3xl sm:shadow-2xl"
      >
        <header className="shrink-0 border-b border-slate-200/80 bg-[#FFFFFF] px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" ry="1" />
                </svg>
              </div>
              <div>
                <h2 id="bet-history-title" className="text-lg font-semibold tracking-tight text-slate-900">
                  Bet history
                </h2>
                <p className="text-xs text-slate-500">
                  {bets.length} {bets.length === 1 ? 'ticket' : 'tickets'} found
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="shrink-0 border-b border-slate-200/80 bg-[#FFFFFF] px-2 sm:px-3">
          <nav className="flex gap-1" aria-label="Filter tickets">
            {(['all', 'pending', 'won', 'lost'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative flex-1 py-3.5 text-sm font-medium transition-colors ${
                  activeTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tabLabel(tab)}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-orange-500" />
                )}
              </button>
            ))}
          </nav>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
          {loading && bets.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500" />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
              <p className="text-sm font-medium text-red-600">{loadError}</p>
              <p className="text-xs text-slate-500">
                If this keeps happening, log out and back in, or try again in a moment.
              </p>
              <button
                type="button"
                onClick={() => void fetchHistory()}
                className="mt-1 rounded-full bg-orange-500 px-4 py-2 text-xs font-bold text-[#111827]"
              >
                Retry
              </button>
            </div>
          ) : filteredBets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-slate-400">
              <svg className="h-16 w-16 opacity-25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" ry="1" />
              </svg>
              <p className="text-sm font-medium text-slate-500">No tickets in this filter</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3 pb-6">
              {filteredBets.map((bet) => {
                const codePlain = ticketCodePlain(bet.ticket_code);
                return (
                <li
                  key={bet.id}
                  className="overflow-hidden rounded-2xl border border-slate-200/90 bg-[#FFFFFF] shadow-sm ring-1 ring-black/[0.03]"
                >
                  <div className="relative aspect-[5/2] w-full min-h-[4.5rem] shrink-0 overflow-hidden bg-slate-100 sm:aspect-[21/8] sm:min-h-[5.5rem]">
                    <img
                      src="/ticket/ticket.jpg"
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover object-center"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5 sm:px-4">
                    <div className="min-w-0 flex flex-1 items-center gap-2 text-sm text-slate-600">
                      <span className="shrink-0 text-slate-400">Ticket</span>
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        {codePlain ? (
                        <button
                          type="button"
                          onClick={() => void copyTicketCode(bet)}
                          className="group flex min-w-0 max-w-full items-center gap-1 rounded-lg py-0.5 pl-0.5 pr-1 text-left transition hover:bg-slate-200/70 active:bg-slate-200"
                          aria-label={`Copy ticket code ${codePlain}`}
                        >
                          <span className="truncate font-mono text-xs font-medium text-slate-800 sm:text-sm">
                            code:{codePlain}
                          </span>
                          <span className="shrink-0 text-slate-400 transition-colors group-hover:text-slate-600" aria-hidden>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500 group-hover:text-slate-600">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </span>
                        </button>
                        ) : (
                          <span className="truncate font-mono text-xs font-medium text-slate-400 sm:text-sm" title="No ticket code">
                            —
                          </span>
                        )}
                        {copiedBetId === bet.id ? (
                          <span className="shrink-0 text-xs font-medium text-emerald-600" role="status">
                            Copied!
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                        bet.status === 'won'
                          ? 'bg-emerald-100 text-emerald-800'
                          : bet.status === 'lost'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {slipStatusLabel(bet.status)}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 px-3 py-2 sm:px-4">
                    {bet.selections.map((sel, idx) => {
                      const lr = (sel.result || '').trim().toLowerCase();
                      const legWon = lr === 'won';
                      const legLost = lr === 'lost';
                      const legBadge = legResultLabel(sel.result);
                      const kickoffLabel = formatKickoffAt(sel.kickoff_at);

                      return (
                        <div
                          key={`${bet.id}-${idx}`}
                          className={`py-3 first:pt-2 last:pb-2 ${
                            legWon
                              ? 'rounded-xl bg-emerald-50/90 ring-1 ring-emerald-200/80'
                              : legLost
                                ? 'rounded-xl bg-red-50/90 ring-1 ring-red-200/80'
                                : ''
                          } ${legWon || legLost ? 'my-2 px-2.5 -mx-0.5 sm:px-3 sm:-mx-1' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-medium leading-snug text-slate-500 sm:text-xs">
                                {titleCaseWords(sel.league_name || '')}
                              </p>
                              <div className="mt-1.5 space-y-1">
                                <div className="flex items-center gap-2">
                                  {sel.home_logo ? (
                                    <img src={sel.home_logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
                                  ) : null}
                                  <span className="truncate text-sm font-medium text-slate-800">{sel.home_team}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {sel.away_logo ? (
                                    <img src={sel.away_logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
                                  ) : null}
                                  <span className="truncate text-sm font-medium text-slate-800">{sel.away_team}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              <span className="rounded-lg bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
                                {Number(sel.odd).toFixed(2)}
                              </span>
                              {legBadge ? (
                                <span
                                  className={`text-[10px] font-semibold ${
                                    legWon ? 'text-emerald-700' : legLost ? 'text-red-700' : 'text-slate-500'
                                  }`}
                                >
                                  {legBadge}
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400">Pending</span>
                              )}
                              {kickoffLabel ? (
                                <span className="text-[10px] font-medium tabular-nums text-slate-400">{kickoffLabel}</span>
                              ) : null}
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {sel.market_name}:{' '}
                            <span className="font-semibold text-orange-600">{sel.selection}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-b-xl border-t border-[#1E40AF] bg-[#1E40AF] px-3 py-4 text-white sm:px-4">
                    <div>
                      <p className="text-[10px] font-medium text-blue-100/90 sm:text-xs">Stake</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">{Number(bet.stake).toFixed(2)} ETB</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-blue-100/90 sm:text-xs">Total odds</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">{Number(bet.total_odds).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium text-amber-200/95 sm:text-xs">Potential win</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-amber-400">
                        {Number(bet.possible_win).toFixed(2)} ETB
                      </p>
                    </div>
                  </div>
                </li>
              );
              })}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}
