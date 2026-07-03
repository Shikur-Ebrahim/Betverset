'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type TicketByCodeSelection } from '../lib/api';
import { loadBetslipFromStorage, useBetSlip, type BetSlipItem, loadPrematchEnforceFromStorage } from '../lib/betslip';
import {
  BETVERS_AUTH_SUCCESS_EVENT,
  BETVERS_WALLET_UPDATED_EVENT,
  BETVERS_BET_PLACED_EVENT,
} from '../lib/ui-events';

type BetSlipDrawerProps = {
  onAuthTrigger?: () => void;
  /** Called after a bet is placed successfully (e.g. open bet history). */
  onBetPlaced?: () => void;
};

function readStoredBalance(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr) as { balance?: string | number };
    if (user.balance === undefined || user.balance === null) return null;
    const n = parseFloat(String(user.balance));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function ticketSelectionToBetItem(s: TicketByCodeSelection, index: number): BetSlipItem | null {
  const market = s.market_name || 'General';
  const isManual = s.is_manual === true || (s.fixture_id == null && !!s.manual_kickoff_at);
  if (!isManual && (s.fixture_id == null || s.fixture_id === undefined)) return null;
  const id = isManual
    ? `m-${index}-${s.manual_kickoff_at || ''}-${s.home_team}-${s.away_team}-${s.selection}`
    : `${s.fixture_id}-${market}-${s.selection}`;
  return {
    id,
    fixtureId: isManual ? null : s.fixture_id!,
    homeTeam: s.home_team,
    awayTeam: s.away_team,
    league: s.league_name || '',
    market,
    selection: s.selection,
    odds: Number(s.odd),
    homeLogo: s.home_logo || undefined,
    awayLogo: s.away_logo || undefined,
    manualKickoffAt: s.manual_kickoff_at ?? undefined,
    manualEndAt: s.manual_end_at ?? undefined,
  };
}

/** Strip common prefixes so pasted "code:T12AB34" still matches pattern. */
function stripTicketInputPrefixes(raw: string): string {
  return raw.trim().replace(/^#/i, '').replace(/^code:\s*/i, '').trim();
}

/** Backend format: T + two digits + two letters + two digits (7 chars). */
function looksLikeCompleteTicketCode(raw: string): boolean {
  const n = stripTicketInputPrefixes(raw).toUpperCase();
  return /^T\d{2}[A-Z]{2}\d{2}$/.test(n);
}

export default function BetSlipDrawer({ onAuthTrigger, onBetPlaced }: BetSlipDrawerProps) {
  const { items, removeBet, clearAll, replaceAll, totalOdds } = useBetSlip();
  const [stake, setStake] = useState('100');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [placedTicketDisplay, setPlacedTicketDisplay] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletCurrency, setWalletCurrency] = useState('ETB');
  const [hasSession, setHasSession] = useState(false);
  const [ticketInput, setTicketInput] = useState('');
  const [ticketLoadLoading, setTicketLoadLoading] = useState(false);
  const [ticketLoadError, setTicketLoadError] = useState<string | null>(null);
  const [ticketImportBlocked, setTicketImportBlocked] = useState(false);
  const [ticketBlockedMessage, setTicketBlockedMessage] = useState<string | null>(null);
  const pendingAutoPlaceRef = useRef(false);
  const handlePlaceBetRef = useRef<() => Promise<void>>(async () => {});
  const lastTicketFetchRef = useRef<string>('');
  const ticketFetchGenRef = useRef(0);

  useEffect(() => {
    setHasSession(typeof window !== 'undefined' && !!localStorage.getItem('token'));
  }, []);

  const potentialWin =
    stake && !isNaN(Number(stake)) ? (Number(stake) * totalOdds).toFixed(2) : null;

  const stakeVal = parseFloat(stake);
  const stakeOk = Number.isFinite(stakeVal) && stakeVal > 0;
  const insufficientFunds =
    hasSession && walletBalance !== null && stakeOk && stakeVal > walletBalance + 1e-9;

  const refreshWalletFromApi = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      setHasSession(false);
      setWalletBalance(null);
      return;
    }
    setHasSession(true);
    const local = readStoredBalance();
    if (local !== null) setWalletBalance(local);
    try {
      const w = await api.getWalletBalance();
      setWalletBalance(w.balance);
      setWalletCurrency(w.currency || 'ETB');
    } catch {
      /* keep local fallback */
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setHasSession(false);
      setWalletBalance(null);
    } else {
      setHasSession(true);
      void refreshWalletFromApi();
    }
  }, [isOpen, refreshWalletFromApi]);

  useEffect(() => {
    const onWallet = () => {
      const b = readStoredBalance();
      if (b !== null) setWalletBalance(b);
      void refreshWalletFromApi();
    };
    const onAuth = () => {
      void (async () => {
        await refreshWalletFromApi();
        if (pendingAutoPlaceRef.current && localStorage.getItem('token') && loadBetslipFromStorage().length > 0) {
          pendingAutoPlaceRef.current = false;
          await handlePlaceBetRef.current();
        }
      })();
    };
    window.addEventListener(BETVERS_WALLET_UPDATED_EVENT, onWallet);
    window.addEventListener(BETVERS_AUTH_SUCCESS_EVENT, onAuth as EventListener);
    return () => {
      window.removeEventListener(BETVERS_WALLET_UPDATED_EVENT, onWallet);
      window.removeEventListener(BETVERS_AUTH_SUCCESS_EVENT, onAuth as EventListener);
    };
  }, [refreshWalletFromApi]);

  const handlePlaceBet = useCallback(async () => {
    const userStr = localStorage.getItem('user');

    if (!userStr || !localStorage.getItem('token')) {
      pendingAutoPlaceRef.current = true;
      setError(null);
      onAuthTrigger?.();
      return;
    }

    let user: { id: number; balance?: string | number };
    try {
      user = JSON.parse(userStr) as { id: number; balance?: string | number };
    } catch {
      setError('Invalid session. Please log in again.');
      return;
    }

    if (!stakeOk) {
      setError('Please enter a valid stake');
      return;
    }

    if (insufficientFunds && walletBalance !== null && hasSession) {
      setError(
        `Insufficient balance. Available ${walletBalance.toFixed(2)} ${walletCurrency}, stake ${stakeVal.toFixed(2)} ${walletCurrency}.`
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.placeBet({
        user_id: user.id,
        stake: stakeVal,
        enforce_prematch_from_ticket: loadPrematchEnforceFromStorage(),
        selections: items.map((item) => ({
          fixture_id: item.fixtureId,
          market_id: null,
          selection: item.selection,
          odd: item.odds,
          home_team: item.homeTeam,
          away_team: item.awayTeam,
          home_logo: item.homeLogo,
          away_logo: item.awayLogo,
          league_name: item.league,
          market_name: item.market,
          manual_kickoff_at: item.manualKickoffAt,
          manual_end_at: item.manualEndAt,
        })),
      });

      if (typeof data.wallet_balance === 'number' && Number.isFinite(data.wallet_balance)) {
        const next = { ...user, balance: data.wallet_balance };
        localStorage.setItem('user', JSON.stringify(next));
        setWalletBalance(data.wallet_balance);
        window.dispatchEvent(
          new CustomEvent(BETVERS_WALLET_UPDATED_EVENT, { detail: { balance: data.wallet_balance } })
        );
      }

      window.dispatchEvent(new CustomEvent(BETVERS_BET_PLACED_EVENT));

      const rawCode =
        data && typeof data === 'object' && 'ticket_code' in data && data.ticket_code != null
          ? String(data.ticket_code).replace(/^#/, '').trim()
          : '';
      setPlacedTicketDisplay(rawCode ? `code:${rawCode}` : null);
      setSuccess(true);
      setTimeout(() => {
        clearAll();
        setSuccess(false);
        setPlacedTicketDisplay(null);
        setIsOpen(false);
        onBetPlaced?.();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place bet. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [
    items,
    stakeOk,
    stakeVal,
    insufficientFunds,
    walletBalance,
    hasSession,
    walletCurrency,
    clearAll,
    onAuthTrigger,
    onBetPlaced,
  ]);

  useEffect(() => {
    handlePlaceBetRef.current = handlePlaceBet;
  }, [handlePlaceBet]);

  const handleRemoveBet = useCallback(
    (id: string) => {
      setTicketImportBlocked(false);
      setTicketBlockedMessage(null);
      removeBet(id);
    },
    [removeBet]
  );

  const handleClearAll = useCallback(() => {
    setTicketInput('');
    setTicketLoadError(null);
    setTicketImportBlocked(false);
    setTicketBlockedMessage(null);
    lastTicketFetchRef.current = '';
    clearAll();
  }, [clearAll]);

  const loadTicketFromCode = useCallback(
    async (rawOverride?: string) => {
      const trimmed = (rawOverride ?? ticketInput).trim();
      if (!trimmed) return;
      setTicketLoadError(null);
      setTicketLoadLoading(true);
      try {
        const data = await api.getTicketByCode(trimmed);
        const nextItems = data.selections
          .map((s, i) => ticketSelectionToBetItem(s, i))
          .filter((x): x is BetSlipItem => x != null);
        if (nextItems.length === 0) {
          setTicketLoadError('Could not load selections from this ticket.');
          setTicketImportBlocked(false);
          setTicketBlockedMessage(null);
          return;
        }
        replaceAll(nextItems, true);
        setTicketImportBlocked(!data.can_place);
        setTicketBlockedMessage(data.can_place ? null : data.message);
        setError(null);
        lastTicketFetchRef.current = stripTicketInputPrefixes(data.ticket_code || trimmed).toUpperCase();
        setTicketInput(data.ticket_code || lastTicketFetchRef.current);
      } catch (e) {
        setTicketLoadError(e instanceof Error ? e.message : 'Lookup failed');
        setTicketImportBlocked(false);
        setTicketBlockedMessage(null);
      } finally {
        setTicketLoadLoading(false);
      }
    },
    [ticketInput, replaceAll]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (!looksLikeCompleteTicketCode(ticketInput)) return;
    const normalized = stripTicketInputPrefixes(ticketInput).toUpperCase();
    if (normalized === lastTicketFetchRef.current) return;
    const gen = ++ticketFetchGenRef.current;
    const snapshot = ticketInput;
    const t = window.setTimeout(() => {
      if (ticketFetchGenRef.current !== gen) return;
      if (!looksLikeCompleteTicketCode(snapshot)) return;
      const n2 = stripTicketInputPrefixes(snapshot).toUpperCase();
      if (n2 === lastTicketFetchRef.current) return;
      void loadTicketFromCode(snapshot);
    }, 450);
    return () => window.clearTimeout(t);
  }, [ticketInput, isOpen, loadTicketFromCode]);

  const placeDisabled = loading || !stakeOk || items.length === 0 || insufficientFunds || ticketImportBlocked;

  return (
    <>
      <button
        id="betslip-toggle-btn"
        onClick={() => {
          setError(null);
          setIsOpen((o) => !o);
        }}
        className="relative flex flex-col items-center gap-1 text-[#8B949E] hover:text-white transition-colors"
      >
        <div className="relative">
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" ry="1" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="13" y2="16" />
          </svg>
          {items.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[#3B82F6] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
              {items.length}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold">Betslip</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[220]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-[#F8FAFC] rounded-t-[24px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden sm:rounded-t-[32px]">
            <div className="shrink-0 border-b border-gray-100 bg-white">
              <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-2.5 sm:px-5 sm:py-3">
                <div className="w-7 h-7 shrink-0 bg-orange-100 rounded-md flex items-center justify-center text-orange-500 font-black text-[10px] sm:w-8 sm:h-8 sm:rounded-lg sm:text-xs">
                  BS
                </div>
                <span className="shrink-0 font-black text-gray-900 text-sm tracking-tight sm:text-base">Betslip</span>
                {items.length > 0 && (
                  <span className="shrink-0 bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full sm:text-[10px] sm:px-2">
                    {items.length}
                  </span>
                )}
                <div className="relative min-w-0 flex-1">
                  <input
                    type="text"
                    value={ticketInput}
                    onChange={(e) => {
                      setTicketInput(e.target.value);
                      setTicketLoadError(null);
                    }}
                    aria-label="Ticket code"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-2.5 pr-8 text-[11px] font-mono font-bold text-slate-900 outline-none placeholder:text-transparent focus:border-orange-400 focus:bg-white sm:py-2 sm:pl-3 sm:pr-9 sm:text-xs"
                  />
                  {ticketLoadLoading ? (
                    <span className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500 sm:right-2.5 sm:h-4 sm:w-4" />
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-[10px] text-gray-400 hover:text-red-500 font-black transition-colors sm:text-[11px]"
                    >
                      Clear all
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-900 transition-colors"
                    aria-label="Close"
                  >
                    <svg className="h-[18px] w-[18px] sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
              {ticketLoadError ? (
                <p className="border-t border-red-100 bg-red-50/80 px-3 py-1.5 text-[10px] font-bold text-red-600 sm:px-5 sm:text-[11px]">
                  {ticketLoadError}
                </p>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 p-3 sm:space-y-3 sm:p-4">
              {success ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 animate-in zoom-in-95 duration-300 sm:gap-4 sm:py-16">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-500 shadow-inner sm:h-20 sm:w-20">
                    <svg className="h-8 w-8 sm:h-10 sm:w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black tracking-tight text-gray-900 sm:text-xl">Bet placed!</p>
                    {placedTicketDisplay ? (
                      <p className="mt-1.5 font-mono text-xs font-black tracking-wide text-slate-800 sm:mt-2 sm:text-sm">
                        {placedTicketDisplay}
                      </p>
                    ) : null}
                    <p className="text-xs font-medium italic text-gray-400 sm:text-sm">Good luck!</p>
                    {walletBalance !== null && (
                      <p className="mt-2 text-[11px] font-black text-slate-700 sm:mt-3 sm:text-[13px]">
                        New balance: {walletBalance.toFixed(2)} {walletCurrency}
                      </p>
                    )}
                  </div>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-14 text-gray-300 sm:gap-3 sm:py-20">
                  <svg className="h-14 w-14 opacity-10 sm:h-16 sm:w-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" ry="1" />
                  </svg>
                  <p className="text-[11px] font-black text-gray-400 sm:text-[13px]">Betslip empty</p>
                </div>
              ) : (
                items.map((bet) => (
                  <div
                    key={bet.id}
                    className="group relative flex flex-col gap-1.5 overflow-hidden rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-all active:scale-[0.98] sm:gap-2 sm:rounded-2xl sm:p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:gap-1.5">
                        <p className="text-[9px] font-black tracking-tight text-gray-400 sm:text-[10px]">{bet.league}</p>
                        <div className="flex flex-col gap-1.5 sm:gap-2">
                          <div className="flex items-center gap-2 sm:gap-3">
                            {bet.homeLogo ? (
                              <img src={bet.homeLogo} alt="" className="h-4 w-4 object-contain sm:h-5 sm:w-5" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border border-gray-100 bg-gray-50 sm:h-5 sm:w-5" />
                            )}
                            <span className="truncate text-[11px] font-black tracking-tight text-gray-800 sm:text-[13px]">
                              {bet.homeTeam}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3">
                            {bet.awayLogo ? (
                              <img src={bet.awayLogo} alt="" className="h-4 w-4 object-contain sm:h-5 sm:w-5" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border border-gray-100 bg-gray-50 sm:h-5 sm:w-5" />
                            )}
                            <span className="truncate text-[11px] font-black tracking-tight text-gray-800 sm:text-[13px]">
                              {bet.awayTeam}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:mt-2 sm:gap-2">
                          <span className="text-[9px] font-bold text-gray-400 sm:text-[10px]">{bet.market}:</span>
                          <span className="text-[9px] font-black text-orange-500 sm:text-[10px]">{bet.selection}</span>
                        </div>
                      </div>
                      <div className="ml-3 flex shrink-0 flex-col items-end gap-2 sm:ml-4 sm:gap-3">
                        <div className="min-w-[44px] rounded-lg bg-blue-50 px-2 py-1 text-center text-[12px] font-black text-blue-600 shadow-sm sm:min-w-[50px] sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-[15px]">
                          {bet.odds.toFixed(2)}
                        </div>
                        <button
                          onClick={() => handleRemoveBet(bet.id)}
                          className="flex h-7 w-7 items-center justify-center text-gray-200 transition-colors hover:text-red-500 sm:h-8 sm:w-8"
                        >
                          <svg className="h-4 w-4 sm:h-[18px] sm:w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && !success && (
              <div className="shrink-0 space-y-3 border-t border-gray-100 bg-white p-3 shadow-2xl sm:space-y-4 sm:p-5">
                {ticketImportBlocked && ticketBlockedMessage ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center text-[10px] font-bold leading-snug text-amber-900 sm:text-[11px]">
                    {ticketBlockedMessage}
                  </div>
                ) : null}
                {!hasSession && items.length > 0 && (
                  <p className="text-center text-[10px] font-medium leading-snug text-slate-600 sm:text-[12px]">
                    Please log in to place your bet. After you sign in, your bet will be placed automatically.
                  </p>
                )}

                {hasSession && walletBalance !== null && (
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
                    <span className="text-[10px] font-black tracking-tight text-slate-500 sm:text-[11px]">Available balance</span>
                    <span className="text-[13px] font-black tabular-nums text-slate-900 sm:text-[15px]">
                      {walletBalance.toFixed(2)} {walletCurrency}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black tracking-tight text-gray-400 sm:text-[12px]">Total odds</span>
                  <span className="text-[17px] font-black tabular-nums tracking-tighter text-gray-900 sm:text-[20px]">
                    {totalOdds.toFixed(2)}
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Enter stake..."
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    className="w-full rounded-2xl border-2 border-transparent bg-[#F8FAFC] py-3 pl-4 pr-14 text-sm font-black text-gray-900 shadow-inner outline-none transition-all focus:border-orange-500 sm:rounded-[20px] sm:py-4 sm:pl-6 sm:pr-16 sm:text-base"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300 sm:right-6 sm:text-[11px]">
                    {walletCurrency}
                  </span>
                </div>

                {potentialWin && (
                  <div className="flex items-center justify-between rounded-2xl border border-green-100 bg-green-50 px-3 py-2.5 sm:rounded-[20px] sm:px-5 sm:py-3">
                    <span className="text-[11px] font-black tracking-tight text-green-600 sm:text-[12px]">Potential win</span>
                    <span className="text-[15px] font-black tabular-nums tracking-tighter text-green-600 sm:text-[18px]">
                      {potentialWin} {walletCurrency}
                    </span>
                  </div>
                )}

                {insufficientFunds && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-2.5 text-center text-[10px] font-bold text-amber-800 sm:p-3 sm:text-[11px]">
                    Stake exceeds balance. Lower the stake or add funds.
                  </div>
                )}

                {error && (
                  <div className="rounded-xl bg-red-50 p-3 text-center text-[9px] font-black text-red-500 sm:p-4 sm:text-[10px]">
                    {error}
                  </div>
                )}

                <button
                  onClick={() => void handlePlaceBet()}
                  disabled={placeDisabled}
                  className="w-full rounded-2xl bg-gray-900 py-4 text-[13px] font-black text-white shadow-xl shadow-gray-200 transition-all hover:bg-black active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 sm:rounded-[24px] sm:py-5 sm:text-[15px]"
                >
                  {loading
                    ? 'Processing...'
                    : insufficientFunds
                      ? 'Insufficient balance'
                      : `Place bet — ${items.length} selection${items.length === 1 ? '' : 's'}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
