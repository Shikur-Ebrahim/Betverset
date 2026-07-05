'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Odd, Fixture } from '../lib/api';
import { isMatchClosedForBetting } from '../lib/match-status';
import { useBetSlip } from '../lib/betslip';

// Markets that should be expanded by default
const DEFAULT_EXPANDED = new Set([
  'match winner',
  'double chance',
  'goals over/under',
  'both teams to score',
  'home/away',
]);

function isExpanded(name: string) {
  const m = name.toLowerCase().trim();
  return DEFAULT_EXPANDED.has(m) || m.includes('match winner') || (m.includes('goals over/under') && !m.includes('half'));
}

// Priority order for market display
const MARKET_PRIORITY: Record<string, number> = {
  'match winner': 1,
  'double chance': 2,
  'goals over/under': 3,
  'both teams to score': 4,
  'home/away': 5,
  'asian handicap': 6,
  'first half winner': 7,
  'second half winner': 8,
};

function marketPriority(name: string): number {
  const m = name.toLowerCase().trim();
  for (const [key, rank] of Object.entries(MARKET_PRIORITY)) {
    if (m.includes(key)) return rank;
  }
  return 99;
}

// Canonical display name for a selection
function getSelectionName(selection: string, fixture: Fixture): string {
  const sel = selection.toLowerCase();
  if (sel === 'home' || sel === '1') return fixture.home_team_name || 'Home';
  if (sel === 'away' || sel === '2') return fixture.away_team_name || 'Away';
  if (sel === 'x' || sel === 'draw') return 'Draw';
  return selection;
}

// Deduplicate odds: for each market, keep only the BEST (highest) odd per selection
function deduplicateOdds(odds: Odd[]): Odd[] {
  const best = new Map<string, Odd>();
  for (const odd of odds) {
    const key = `${odd.market_name}__${odd.selection}`;
    const existing = best.get(key);
    if (!existing || (odd.odd_value ?? 0) > (existing.odd_value ?? 0)) {
      best.set(key, odd);
    }
  }
  return Array.from(best.values());
}

// Sort selections within a market intelligently
const SEL_ORDER: Record<string, number> = {
  home: 1, '1': 1,
  draw: 2, x: 2,
  away: 3, '2': 3,
};
function sortSelections(odds: Odd[]): Odd[] {
  return [...odds].sort((a, b) => {
    const oa = SEL_ORDER[a.selection.toLowerCase()] ?? 50;
    const ob = SEL_ORDER[b.selection.toLowerCase()] ?? 50;
    if (oa !== ob) return oa - ob;
    return a.selection.localeCompare(b.selection);
  });
}

const SKELETON_MARKETS = ['Match Winner', 'Double Chance', 'Goals Over/Under', 'Both Teams To Score'];

type Props = { odds: Odd[]; fixture: Fixture; oddsLoading?: boolean };

export default function MatchOddsClient({ odds, fixture, oddsLoading = false }: Props) {
  const [activeTab, setActiveTab] = useState<string>('All');
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const { addBet, isSelected } = useBetSlip();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Deduplicate and group by market
  const deduped = useMemo(() => deduplicateOdds(odds), [odds]);

  const markets = useMemo(() => {
    const map = new Map<string, Odd[]>();
    for (const odd of deduped) {
      const name = odd.market_name || 'Other';
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(odd);
    }
    return map;
  }, [deduped]);

  const marketNames = useMemo(() => {
    return Array.from(markets.keys()).sort((a, b) => {
      const pa = marketPriority(a);
      const pb = marketPriority(b);
      return pa !== pb ? pa - pb : a.localeCompare(b);
    });
  }, [markets]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current || marketNames.length === 0) return;
    initRef.current = true;
    const c = new Set<string>();
    for (const name of marketNames) {
      if (!isExpanded(name)) c.add(name);
    }
    setCollapsed(c);
  }, [marketNames]);

  const scrollBy = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 160 : -160, behavior: 'smooth' });
  };

  const displayed = useMemo(() => {
    return marketNames.map(n => [n, markets.get(n)!] as [string, Odd[]]);
  }, [marketNames, markets]);

  const isFinished = isMatchClosedForBetting(fixture);
  const isLive = !isFinished && ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes((fixture.status || '').toUpperCase());

  return (
    <>
      {isLive && (
        <div className="bg-[#0D1117] sticky top-14 z-30 shadow-md">
          <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#16A34A] border-b border-[#16A34A]/20">
            ● Live odds update ~30s
          </p>
        </div>
      )}

      {/* Odds body */}
      <div className="px-3 pb-8 space-y-3 mt-2">
        {displayed.map(([marketName, marketOdds]) => {
          const isCollapsed = collapsed.has(marketName);
          const sorted = sortSelections(marketOdds);
          const cols = sorted.length === 2 ? 2 : sorted.length === 3 ? 3 : sorted.length <= 4 ? 2 : 3;

          return (
            <div key={marketName} className="rounded-2xl overflow-hidden border border-[#E2E8F0]/60 bg-white shadow-sm">
              {/* Market header */}
              <button
                onClick={() => setCollapsed(prev => {
                  const n = new Set(prev);
                  n.has(marketName) ? n.delete(marketName) : n.add(marketName);
                  return n;
                })}
                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#1E293B] to-[#334155] text-white"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                  <span className="text-[13px] font-bold tracking-wide">{marketName}</span>
                </div>
                <svg
                  className={`w-4 h-4 text-white/60 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20" fill="currentColor"
                >
                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {!isCollapsed && (
                <div className={`p-2.5 grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                  {sorted.map((odd) => {
                    const betId = `${fixture.id}-${marketName}-${odd.selection}`;
                    const selected = isSelected(betId);
                    const label = getSelectionName(odd.selection, fixture);
                    return (
                      <button
                        key={`${odd.market_name}-${odd.selection}`}
                        disabled={isFinished}
                        onClick={() => {
                          if (isFinished) return;
                          addBet({
                            id: betId,
                            fixtureId: fixture.id,
                            homeTeam: fixture.home_team_name,
                            awayTeam: fixture.away_team_name,
                            league: fixture.league_name,
                            market: marketName,
                            selection: label,
                            odds: Number(odd.odd_value),
                            homeLogo: fixture.home_team_logo,
                            awayLogo: fixture.away_team_logo,
                          });
                        }}
                        className={`relative flex flex-col items-center justify-center gap-0.5 px-2 py-3 rounded-xl border transition-all duration-150 ${
                          isFinished
                            ? 'bg-[#F8FAFC] border-[#E2E8F0] cursor-not-allowed opacity-60'
                            : selected
                              ? 'bg-[#FF8C00] border-[#FF8C00] shadow-lg shadow-[#FF8C00]/30'
                              : 'bg-[#F1F5F9] border-[#E2E8F0] hover:bg-[#E8EFF9] hover:border-[#94A3B8] hover:shadow-sm active:scale-95'
                        }`}
                      >
                        {selected && (
                          <div className="absolute top-1.5 right-1.5">
                            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                          </div>
                        )}
                        <span className={`text-[11px] font-medium text-center leading-tight truncate max-w-full px-1 ${
                          selected ? 'text-white/90' : 'text-[#64748B]'
                        }`}>
                          {label}
                        </span>
                        <span className={`text-[17px] font-black ${
                          isFinished ? 'text-[#94A3B8]' : selected ? 'text-white' : 'text-[#0F172A]'
                        }`}>
                          {isFinished ? '—' : Number(odd.odd_value).toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading skeleton */}
        {markets.size === 0 && oddsLoading && (
          <div className="space-y-3">
            {SKELETON_MARKETS.map(label => (
              <div key={label} className="rounded-2xl overflow-hidden border border-[#E2E8F0]/60 bg-white shadow-sm">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-[#1E293B] to-[#334155]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                  <span className="text-[13px] font-bold text-white">{label}</span>
                </div>
                <div className="p-2.5 grid grid-cols-3 gap-2">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-[62px] rounded-xl bg-[#F1F5F9] animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {markets.size === 0 && !oddsLoading && (
          <div className="text-center py-14 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#0F172A]">No Markets Available</p>
              <p className="text-[12px] text-[#94A3B8] mt-0.5">Betting odds are not yet available for this match.</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap transition-all duration-150 ${
        active
          ? 'bg-[#FF8C00] text-white shadow-md shadow-[#FF8C00]/40'
          : 'bg-[#1C2128] text-[#8B949E] border border-[#30363D] hover:text-white hover:border-[#555]'
      }`}
    >
      {label}
    </button>
  );
}
