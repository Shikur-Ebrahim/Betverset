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

/** Backend format: B + two digits + two letters + two digits (7 chars). */
function looksLikeCompleteTicketCode(raw: string): boolean {
  const n = stripTicketInputPrefixes(raw).toUpperCase();
  return /^[BT]\d{2}[A-Z]{2}\d{2}$/.test(n);
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
        onClick={() => { setError(null); setIsOpen((o) => !o); }}
        className="relative flex flex-col items-center gap-1 text-[#6B7280] hover:text-[#111827] transition-colors"
      >
        <div className="relative">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" ry="1" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="13" y2="16" />
          </svg>
          {items.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none" style={{background:'#2563EB'}}>
              {items.length}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold">Betslip</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[220]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-[28px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up"
            style={{background:'linear-gradient(180deg,#F0FDF4 0%,#FFFFFF 100%)', border:'1.5px solid rgba(16,185,129,0.15)', borderBottom:'none'}}>

            {/* Header */}
            <div className="shrink-0" style={{borderBottom:'1px solid rgba(0,0,0,0.08)'}}>
              <div className="flex items-center gap-2 px-4 py-3.5">
                <div className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-white font-black text-[11px]" style={{background:'linear-gradient(135deg,#059669,#10B981)'}}>
                  BS
                </div>
                <span className="shrink-0 font-black text-[#064E3B] text-[15px] tracking-tight">Betslip</span>
                {items.length > 0 && (
                  <span className="shrink-0 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{background:'#059669'}}>
                    {items.length}
                  </span>
                )}
                <div className="relative min-w-0 flex-1">
                  <input
                    type="text"
                    value={ticketInput}
                    onChange={(e) => { setTicketInput(e.target.value); setTicketLoadError(null); }}
                    aria-label="Ticket code"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="Enter ticket code..."
                    className="w-full rounded-xl py-2 pl-3 pr-8 text-[11px] font-mono font-bold text-[#064E3B] outline-none"
                    style={{background:'rgba(5,150,105,0.08)', border:'1.5px solid rgba(5,150,105,0.2)'}}
                    onFocus={(e) => { e.target.style.borderColor = '#059669'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(5,150,105,0.2)'; }}
                  />
                  {ticketLoadLoading && (
                    <span className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-[rgba(5,150,105,0.15)] border-t-[#059669]" />
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {items.length > 0 && (
                    <button type="button" onClick={handleClearAll} className="text-[10px] text-[#6B7280] hover:text-[#EF4444] font-bold transition-colors">
                      Clear
                    </button>
                  )}
                  <button type="button" onClick={() => setIsOpen(false)} className="text-[#6B7280] hover:text-[#111827] transition-colors">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
              {ticketLoadError && (
                <p className="px-4 py-2 text-[10px] font-bold text-[#EF4444]" style={{background:'rgba(239,68,68,0.08)', borderTop:'1px solid rgba(239,68,68,0.15)'}}>
                  {ticketLoadError}
                </p>
              )}
            </div>

            {/* Bet items */}
            <div className="flex-1 overflow-y-auto space-y-2 p-3">
              {success ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12 animate-scale-in">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{background:'rgba(37,99,235,0.12)', border:'1px solid rgba(37,99,235,0.3)'}}>
                    <svg className="h-8 w-8 text-[#2563EB]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black tracking-tight text-[#111827]">Bet Placed! 🎉</p>
                    {placedTicketDisplay && (
                      <p className="mt-1.5 font-mono text-xs font-black tracking-wide text-[#2563EB]">{placedTicketDisplay}</p>
                    )}
                    <p className="text-xs font-medium text-[#6B7280] mt-1">Good luck!</p>
                    {walletBalance !== null && (
                      <p className="mt-2 text-[11px] font-black text-[#4B5563]">
                        New balance: <span className="text-[#111827]">{walletBalance.toFixed(2)} {walletCurrency}</span>
                      </p>
                    )}
                  </div>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-[#6B7280]">
                  <svg className="h-14 w-14 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" ry="1" />
                  </svg>
                  <p className="text-sm font-bold text-[#6B7280]">Your betslip is empty</p>
                  <p className="text-xs text-[#3F3F46]">Pick matches to add selections</p>
                </div>
              ) : (
                items.map((bet) => (
                  <div key={bet.id}
                    className="group relative overflow-hidden rounded-2xl transition-all"
                    style={{background:'#FFFFFF', border:'1.5px solid rgba(5,150,105,0.12)', boxShadow:'0 2px 12px rgba(5,150,105,0.07)'}}>
                    {/* Colored top bar */}
                    <div className="h-1 w-full" style={{background:'linear-gradient(90deg,#059669,#10B981)'}} />
                    <div className="p-3">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <p className="text-[9px] font-black tracking-widest text-[#059669] uppercase truncate">{bet.league}</p>
                          {/* Home team row */}
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center overflow-hidden" style={{background:'rgba(5,150,105,0.06)', border:'1px solid rgba(5,150,105,0.12)'}}>
                              {bet.homeLogo
                                ? <img src={bet.homeLogo} alt="" className="h-6 w-6 object-contain" />
                                : <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5" className="h-4 w-4"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                              }
                            </div>
                            <span className="truncate text-[13px] font-black text-[#0F172A]">{bet.homeTeam}</span>
                          </div>
                          {/* VS divider */}
                          <div className="ml-10 flex items-center gap-2">
                            <div className="h-px flex-1" style={{background:'rgba(5,150,105,0.15)'}} />
                            <span className="text-[8px] font-black text-[#059669] tracking-widest">VS</span>
                            <div className="h-px flex-1" style={{background:'rgba(5,150,105,0.15)'}} />
                          </div>
                          {/* Away team row */}
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center overflow-hidden" style={{background:'rgba(5,150,105,0.06)', border:'1px solid rgba(5,150,105,0.12)'}}>
                              {bet.awayLogo
                                ? <img src={bet.awayLogo} alt="" className="h-6 w-6 object-contain" />
                                : <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5" className="h-4 w-4"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                              }
                            </div>
                            <span className="truncate text-[13px] font-black text-[#0F172A]">{bet.awayTeam}</span>
                          </div>
                          {/* Selection badge */}
                          <div className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1" style={{background:'rgba(5,150,105,0.08)'}}>
                            <span className="text-[9px] font-bold text-[#059669]">{bet.market}:</span>
                            <span className="text-[10px] font-black text-[#059669]">{bet.selection}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <div className="min-w-[50px] rounded-xl px-2.5 py-1.5 text-center text-[15px] font-black text-white"
                            style={{background:'linear-gradient(135deg,#059669,#10B981)', boxShadow:'0 2px 8px rgba(5,150,105,0.3)'}}>
                            {bet.odds.toFixed(2)}
                          </div>
                          <button onClick={() => handleRemoveBet(bet.id)} className="flex h-7 w-7 items-center justify-center rounded-full text-[#CBD5E1] hover:text-[#EF4444] hover:bg-red-50 transition-all">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && !success && (
              <div className="shrink-0 space-y-3 p-4" style={{borderTop:'1.5px solid rgba(5,150,105,0.12)', background:'#FFFFFF'}}>
                {ticketImportBlocked && ticketBlockedMessage && (
                  <div className="rounded-2xl px-3 py-2.5 text-center text-[10px] font-bold leading-snug text-[#B45309]"
                    style={{background:'rgba(245,158,11,0.08)', border:'1.5px solid rgba(245,158,11,0.2)'}}>
                    {ticketBlockedMessage}
                  </div>
                )}
                {!hasSession && items.length > 0 && (
                  <p className="text-center text-[11px] font-medium leading-snug text-[#6B7280]">
                    Please log in to place your bet.
                  </p>
                )}
                {hasSession && walletBalance !== null && (
                  <div className="flex items-center justify-between rounded-2xl px-3 py-2.5" style={{background:'rgba(5,150,105,0.06)', border:'1.5px solid rgba(5,150,105,0.12)'}}>
                    <span className="text-[10px] font-bold text-[#059669]">Available balance</span>
                    <span className="text-[13px] font-black tabular-nums text-[#064E3B]">{walletBalance.toFixed(2)} <span className="text-[#059669]">{walletCurrency}</span></span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#6B7280]">Total odds</span>
                  <span className="text-[22px] font-black tabular-nums text-[#059669]">{totalOdds.toFixed(2)}</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Enter stake..."
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    className="w-full rounded-2xl py-3.5 pl-4 pr-14 text-sm font-black text-[#0F172A] outline-none transition-all"
                    style={{background:'rgba(5,150,105,0.05)', border:'1.5px solid rgba(5,150,105,0.2)'}}
                    onFocus={(e) => { e.target.style.borderColor = '#059669'; e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(5,150,105,0.2)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#059669]">{walletCurrency}</span>
                </div>
                {potentialWin && (
                  <div className="flex items-center justify-between rounded-2xl px-3 py-2.5"
                    style={{background:'linear-gradient(135deg,rgba(5,150,105,0.08),rgba(16,185,129,0.06))', border:'1.5px solid rgba(5,150,105,0.2)'}}>
                    <span className="text-[11px] font-bold text-[#059669]">🏆 Potential win</span>
                    <span className="text-[18px] font-black tabular-nums text-[#059669]">{potentialWin} {walletCurrency}</span>
                  </div>
                )}
                {insufficientFunds && (
                  <div className="rounded-2xl p-2.5 text-center text-[10px] font-bold text-[#B45309]"
                    style={{background:'rgba(245,158,11,0.08)', border:'1.5px solid rgba(245,158,11,0.2)'}}>
                    Stake exceeds balance. Add funds or lower stake.
                  </div>
                )}
                {error && (
                  <div className="rounded-2xl p-3 text-center text-[10px] font-black text-[#EF4444]"
                    style={{background:'rgba(239,68,68,0.06)', border:'1.5px solid rgba(239,68,68,0.15)'}}>
                    {error}
                  </div>
                )}
                <button
                  onClick={() => void handlePlaceBet()}
                  disabled={placeDisabled}
                  className="w-full rounded-2xl py-4 text-[14px] font-black transition-all active:scale-95"
                  style={placeDisabled ? {background:'rgba(5,150,105,0.1)', color:'#9CA3AF', cursor:'not-allowed'} : {background:'linear-gradient(135deg,#059669,#10B981)', color:'#FFFFFF', boxShadow:'0 4px 20px rgba(5,150,105,0.4)'}}
                >
                  {loading ? 'Processing...' : insufficientFunds ? 'Insufficient balance' : `Place Bet — ${items.length} selection${items.length === 1 ? '' : 's'}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

