'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Odd, Fixture } from '../lib/api';
import { isMatchClosedForBetting } from '../lib/match-status';
import { useBetSlip } from '../lib/betslip';

/** Markets expanded on first load; all others stay collapsed until the user opens them. */
function isDefaultExpandedMarket(marketName: string): boolean {
  const m = marketName.toLowerCase().trim();
  if (m === 'match winner' || m.includes('full time result')) return true;
  if (m === 'home/away') return true;
  if (m.includes('second half winner')) return true;
  if (m === 'asian handicap' || m.startsWith('asian handicap ')) return true;
  if (m === 'goals over/under') return true;
  if (
    m.includes('goals over/under') &&
    !m.includes('first half') &&
    !m.includes('second half')
  ) {
    return true;
  }
  return false;
}

function buildDefaultCollapsedMarkets(marketNames: string[]): Set<string> {
  const collapsed = new Set<string>();
  for (const name of marketNames) {
    if (!isDefaultExpandedMarket(name)) collapsed.add(name);
  }
  return collapsed;
}

const DEFAULT_EXPANDED_ORDER = [
  'match winner',
  'home/away',
  'second half winner',
  'asian handicap',
  'goals over/under',
];

function defaultExpandedSortRank(marketName: string): number {
  const m = marketName.toLowerCase();
  for (let i = 0; i < DEFAULT_EXPANDED_ORDER.length; i++) {
    const key = DEFAULT_EXPANDED_ORDER[i];
    if (key === 'goals over/under') {
      if (m === 'goals over/under' || (m.includes('goals over/under') && !m.includes('first half') && !m.includes('second half'))) {
        return i;
      }
    } else if (m.includes(key)) {
      return i;
    }
  }
  return DEFAULT_EXPANDED_ORDER.length;
}

function sortMarketsForDisplay(entries: [string, Odd[]][]): [string, Odd[]][] {
  return [...entries].sort(([a], [b]) => {
    const rankA = defaultExpandedSortRank(a);
    const rankB = defaultExpandedSortRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b);
  });
}

const ODDS_SKELETON_MARKETS = [
  'Match Winner',
  'Home/Away',
  'Second Half Winner',
  'Asian Handicap',
  'Goals Over/Under',
];

type MatchOddsClientProps = {
  odds: Odd[];
  fixture: Fixture;
  oddsLoading?: boolean;
};

const sortOrder: Record<string, number> = {
  'home': 1,
  '1': 1,
  'draw': 2,
  'x': 2,
  'away': 3,
  '2': 3
};

function getSelectionName(selection: string, fixture: Fixture) {
  const sel = selection.toLowerCase();
  if (sel === 'home' || sel === '1') return fixture.home_team_name;
  if (sel === 'away' || sel === '2') return fixture.away_team_name;
  if (sel === 'x') return 'Draw';
  return selection;
}

function sortOdds(odds: Odd[]) {
  return [...odds].sort((a, b) => {
    const orderA = sortOrder[a.selection.toLowerCase()] || 99;
    const orderB = sortOrder[b.selection.toLowerCase()] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.selection.localeCompare(b.selection);
  });
}

export default function MatchOddsClient({ odds, fixture, oddsLoading = false }: MatchOddsClientProps) {
  const [activeTab, setActiveTab] = useState<string>('All');
  const { addBet, isSelected } = useBetSlip();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'right' ? 200 : -200, behavior: 'smooth' });
    }
  };

  const markets = new Map<string, Odd[]>();
  for (const odd of odds) {
    if (!markets.has(odd.market_name)) markets.set(odd.market_name, []);
    markets.get(odd.market_name)!.push(odd);
  }

  const marketNames = useMemo(() => Array.from(markets.keys()), [odds]);
  const displayedMarkets = useMemo(() => {
    const entries =
      activeTab === 'All'
        ? Array.from(markets.entries())
        : Array.from(markets.entries()).filter(([name]) => name === activeTab);
    return activeTab === 'All' ? sortMarketsForDisplay(entries) : entries;
  }, [activeTab, odds]);

  const [collapsedMarkets, setCollapsedMarkets] = useState<Set<string>>(() => new Set());
  const collapsedInitRef = useRef(false);

  useEffect(() => {
    if (collapsedInitRef.current || marketNames.length === 0) return;
    collapsedInitRef.current = true;
    setCollapsedMarkets(buildDefaultCollapsedMarkets(marketNames));
  }, [marketNames]);

  useEffect(() => {
    if (!collapsedInitRef.current || marketNames.length === 0) return;
    setCollapsedMarkets((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const name of marketNames) {
        if (!prev.has(name) && !isDefaultExpandedMarket(name)) {
          next.add(name);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [marketNames]);

  const toggleMarket = (marketName: string) => {
    setCollapsedMarkets(prev => {
      const next = new Set(prev);
      next.has(marketName) ? next.delete(marketName) : next.add(marketName);
      return next;
    });
  };

  const isFinished = isMatchClosedForBetting(fixture);
  const isLiveInPlay =
    !isFinished &&
    ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes((fixture.status || '').toUpperCase());

  return (
    <>
      <div className="sticky top-14 z-30 bg-[#0D1117] pt-4 pb-3">
        {isLiveInPlay ? (
          <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wide text-[#16A34A]/90">
            Live odds update ~30s — backend syncs to database, page reads latest prices
          </p>
        ) : null}
        <div className="relative">
          <button
            onClick={() => scrollCarousel('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/80 border border-white/10 flex items-center justify-center text-white hover:bg-black transition-all shadow-lg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button
            onClick={() => scrollCarousel('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/80 border border-white/10 flex items-center justify-center text-white hover:bg-black transition-all shadow-lg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          
          <div ref={scrollRef} className="flex overflow-x-auto hide-scrollbar gap-2 px-8">
            <button onClick={() => setActiveTab('All')} className={`px-4 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors ${activeTab === 'All' ? 'bg-[#FF8C00] text-[#0D1117] shadow-md' : 'bg-[#161B22] text-[#8B949E] border border-[#30363D] hover:text-white'}`}>
              All
            </button>
            {marketNames.map(marketName => (
              <button key={marketName} onClick={() => setActiveTab(marketName)} className={`px-4 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors ${activeTab === marketName ? 'bg-[#FF8C00] text-[#0D1117] shadow-md' : 'bg-[#161B22] text-[#8B949E] border border-[#30363D] hover:text-white'}`}>
                {marketName}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-3 pb-6 space-y-3 mt-2">
        {displayedMarkets.map(([marketName, marketOdds]) => {
          const isCollapsed = collapsedMarkets.has(marketName);
          return (
            <div key={marketName} className="rounded-xl overflow-hidden border border-[#E2E8F0] bg-white shadow-sm">
              <div onClick={() => toggleMarket(marketName)} className="bg-[#FF8C00] px-3.5 py-2.5 flex items-center justify-between text-white cursor-pointer select-none">
                <span className="text-[13px] font-bold tracking-wide">{marketName}</span>
                <svg className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
              </div>
              {!isCollapsed && (
                <div className="flex flex-col p-[2px] bg-white gap-[2px]">
                  {sortOdds(marketOdds).map((odd) => {
                    const betId = `${fixture.id}-${marketName}-${odd.selection}`;
                    const selected = isSelected(betId);
                    return (
                      <button
                        key={odd.id}
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
                              selection: getSelectionName(odd.selection, fixture),
                              odds: Number(odd.odd_value),
                              homeLogo: fixture.home_team_logo,
                              awayLogo: fixture.away_team_logo
                            });
                        }}
                        className={`flex items-center justify-between px-3.5 py-[10px] transition-all rounded-[5px] ${
                          isFinished
                            ? 'bg-[#F1F5F9] cursor-not-allowed opacity-70'
                            : selected
                              ? 'bg-[#FF8C00]'
                              : 'bg-[#E8EDF5] hover:bg-[#DDE4EE]'
                        }`}
                      >
                        <span className={`text-[13px] font-medium ${isFinished ? 'text-[#94A3B8]' : selected ? 'text-white font-bold' : 'text-[#1A202C]'}`}>
                          {getSelectionName(odd.selection, fixture)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {selected && (
                            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                          <span className={`text-[14px] font-black ${isFinished ? 'text-[#94A3B8]' : selected ? 'text-white' : 'text-[#1A202C]'}`}>
                            {isFinished ? 'CLOSED' : odd.odd_value}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {markets.size === 0 && oddsLoading && (
          <div className="space-y-3">
            {ODDS_SKELETON_MARKETS.map((label) => (
              <div key={label} className="rounded-xl overflow-hidden border border-[#E2E8F0] bg-white shadow-sm">
                <div className="bg-[#FF8C00]/90 px-3.5 py-2.5 text-white">
                  <span className="text-[13px] font-bold tracking-wide">{label}</span>
                </div>
                <div className="flex flex-col p-[2px] bg-white gap-[2px]">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-[42px] mx-[2px] rounded-[5px] bg-[#E8EDF5] animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {markets.size === 0 && !oddsLoading && (
          <div className="text-center py-10 text-[#8B949E] flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#161B22] flex items-center justify-center border border-[#30363D]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <p className="text-[14px] font-bold text-white mb-1">No Markets Open</p>
              <p className="text-xs">Betting odds are not yet available for this match.</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
