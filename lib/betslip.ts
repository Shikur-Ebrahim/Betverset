'use client';

import { useCallback, useEffect, useState } from 'react';

export type BetSlipItem = {
  id: string; // unique key: fixtureId + market + selection, or manual composite id
  fixtureId: number | null;
  homeTeam: string;
  awayTeam: string;
  league: string;
  market: string;
  selection: string; // display name e.g. "Chelsea", "Draw"
  odds: number;
  homeLogo?: string;
  awayLogo?: string;
  /** Admin manual preset legs (no API fixture). */
  manualKickoffAt?: string;
  manualEndAt?: string;
};

export const BETSLIP_STORAGE_KEY = 'betvers_betslip';

/** When true, server rejects place bet if any leg is not pre-match (copy-ticket flow only). */
export const BETSLIP_PREMATCH_ENFORCE_KEY = 'betvers_betslip_prematch_enforce';

export function loadBetslipFromStorage(): BetSlipItem[] {
  try {
    const raw = localStorage.getItem(BETSLIP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function loadPrematchEnforceFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(BETSLIP_PREMATCH_ENFORCE_KEY) === '1';
  } catch {
    return false;
  }
}

function setPrematchEnforce(on: boolean) {
  try {
    if (typeof window === 'undefined') return;
    if (on) localStorage.setItem(BETSLIP_PREMATCH_ENFORCE_KEY, '1');
    else localStorage.removeItem(BETSLIP_PREMATCH_ENFORCE_KEY);
  } catch {}
}

function loadFromStorage(): BetSlipItem[] {
  return loadBetslipFromStorage();
}

function saveToStorage(items: BetSlipItem[]) {
  try {
    localStorage.setItem(BETSLIP_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

/** Replace entire betslip (e.g. load picks from a ticket code). */
export function replaceBetslipItems(items: BetSlipItem[], fromTicketCode = false) {
  saveToStorage(items);
  if (fromTicketCode) setPrematchEnforce(true);
  else setPrematchEnforce(false);
  dispatchChange();
}

function dispatchChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('betslip_changed'));
  }
}

export function useBetSlip() {
  const [items, setItems] = useState<BetSlipItem[]>([]);

  useEffect(() => {
    setItems(loadFromStorage());

    const handler = () => {
      setItems(loadFromStorage());
    };
    
    window.addEventListener('betslip_changed', handler);
    return () => window.removeEventListener('betslip_changed', handler);
  }, []);

  const addBet = useCallback((bet: BetSlipItem) => {
    const prev = loadFromStorage();
    
    // Check if exactly this bet is already selected
    const isAlreadySelected = prev.some(b => b.id === bet.id);
    
    if (isAlreadySelected) {
      // Toggle off
      const next = prev.filter(b => b.id !== bet.id);
      saveToStorage(next);
      if (next.length === 0) setPrematchEnforce(false);
      dispatchChange();
    } else {
      // Remove any existing selection for this fixture, then add the new one
      // This enforces exactly one selection per match (manual legs keyed only by id)
      const filtered =
        bet.fixtureId != null ? prev.filter((b) => b.fixtureId !== bet.fixtureId) : prev;
      const next = [...filtered, bet];
      setPrematchEnforce(false);
      saveToStorage(next);
      dispatchChange();
    }
  }, []);

  const removeBet = useCallback((id: string) => {
    const prev = loadFromStorage();
    const next = prev.filter(b => b.id !== id);
    saveToStorage(next);
    if (next.length === 0) setPrematchEnforce(false);
    dispatchChange();
  }, []);

  const clearAll = useCallback(() => {
    saveToStorage([]);
    setPrematchEnforce(false);
    dispatchChange();
  }, []);

  const replaceAll = useCallback((next: BetSlipItem[], fromTicketCode = false) => {
    saveToStorage(next);
    if (fromTicketCode) setPrematchEnforce(true);
    else setPrematchEnforce(false);
    dispatchChange();
  }, []);

  const isSelected = useCallback((id: string) => {
    return items.some(b => b.id === id);
  }, [items]);

  const totalOdds = items.reduce((acc, b) => acc * b.odds, 1);

  return { items, addBet, removeBet, clearAll, replaceAll, isSelected, totalOdds };
}
