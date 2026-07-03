'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, Fixture, Odd } from '../lib/api';
import { isMatchClosedForBetting } from '../lib/match-status';
import MatchOddsClient from './match-odds-client';
import BetSlipDrawer from './BetSlipDrawer';
import AuthModal from './auth-modal';
import BetHistory from './BetHistory';
import { BETVERS_AUTH_SUCCESS_EVENT } from '../lib/ui-events';

function formatMatchDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function renderStatusBadge(fixture: Fixture) {
  const s = fixture.status?.toUpperCase() || 'NS';
  if (isMatchClosedForBetting(fixture)) {
    return (
      <span className="mt-2.5 bg-white/10 border border-white/20 text-[#8B949E] text-[9px] px-2.5 py-1 rounded-sm font-black uppercase tracking-widest backdrop-blur-sm whitespace-nowrap">
        Finished
      </span>
    );
  }
  let bgColor = 'bg-black/40';
  let textColor = 'text-[#FF8C00]';
  let borderColor = 'border-[#FF8C00]/30';
  let label = s;

  if (s === 'NS' || s === 'TBD') {
    label = 'Not Started';
  } else if (['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(s)) {
    label = s === 'HT' ? 'HT' : s === '1H' ? '1st Half' : s === '2H' ? '2nd Half' : s;
    bgColor = 'bg-[#16A34A]/20';
    textColor = 'text-[#16A34A]';
    borderColor = 'border-[#16A34A]/40';
  } else if (['PST', 'CANC', 'ABD', 'SUSP'].includes(s)) {
    label = s === 'PST' ? 'Postponed' : s === 'CANC' ? 'Cancelled' : s === 'ABD' ? 'Abandoned' : 'Suspended';
    bgColor = 'bg-red-500/20';
    textColor = 'text-red-500';
    borderColor = 'border-red-500/40';
  }

  return (
    <span
      className={`mt-2.5 ${bgColor} border ${borderColor} ${textColor} text-[9px] px-2.5 py-1 rounded-sm font-black uppercase tracking-widest backdrop-blur-sm whitespace-nowrap`}
    >
      {label}
    </span>
  );
}

function computePollDelayMs(f: Fixture): number {
  const s = (f.status || '').toUpperCase();
  if (isMatchClosedForBetting(f)) {
    const sinceKickoffMs = Date.now() - new Date(f.match_date).getTime();
    if (sinceKickoffMs < 3 * 60 * 60 * 1000) {
      return 30_000;
    }
    return 90_000;
  }
  if (['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(s)) {
    return 30_000;
  }
  if (['FT', 'AET', 'PEN'].includes(s)) {
    const sinceKickoffMs = Date.now() - new Date(f.match_date).getTime();
    if (sinceKickoffMs < 3 * 60 * 60 * 1000) {
      return 30_000;
    }
    return 90_000;
  }
  const kick = new Date(f.match_date).getTime();
  const t = Date.now();
  if (t >= kick - 20 * 60 * 1000 && t <= kick + 4 * 60 * 60 * 1000) {
    return 30_000;
  }
  return 60_000;
}

type Props = {
  initialFixture: Fixture;
  initialOdds: Odd[];
  oddsLoading?: boolean;
};

export default function MatchDetailView({ initialFixture, initialOdds, oddsLoading = false }: Props) {
  const [fixture, setFixture] = useState(initialFixture);
  const [odds, setOdds] = useState(initialOdds);

  useEffect(() => {
    setFixture(initialFixture);
    setOdds(initialOdds);
  }, [initialFixture, initialOdds]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<{ id: number } | null>(null);
  const [isBetHistoryOpen, setIsBetHistoryOpen] = useState(false);
  const fixtureId = fixture.id;
  const fixtureIdRef = useRef(fixtureId);

  useLayoutEffect(() => {
    fixtureIdRef.current = fixtureId;
  }, [fixtureId]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const runTick = async () => {
      if (cancelled) return;
      const id = fixtureIdRef.current;
      let nextDelay = 30_000;
      try {
        // Re-read from DB; backend cron updates odds from API-Football every ~30s.
        const [nextFixture, nextOdds] = await Promise.all([
          api.getFixture(id, { refresh: true }),
          api.getOdds(id, { refresh: true }),
        ]);
        if (!cancelled && nextFixture) {
          setFixture(nextFixture);
          setOdds(Array.isArray(nextOdds) ? nextOdds : []);
          nextDelay = computePollDelayMs(nextFixture);
        }
      } catch {
        nextDelay = 30_000;
      }
      if (!cancelled) {
        timeoutId = setTimeout(runTick, nextDelay);
      }
    };

    const startDelay = oddsLoading || initialOdds.length === 0 ? 4000 : 1500;
    timeoutId = setTimeout(runTick, startDelay);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [fixtureId, oddsLoading, initialOdds.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const readUser = () => {
      const raw = localStorage.getItem('user');
      if (!raw) {
        setUser(null);
        return;
      }
      try {
        const u = JSON.parse(raw) as { id?: number };
        setUser(typeof u.id === 'number' ? { id: u.id } : null);
      } catch {
        setUser(null);
      }
    };
    readUser();
    const onAuth = () => readUser();
    window.addEventListener(BETVERS_AUTH_SUCCESS_EVENT, onAuth as EventListener);
    return () => window.removeEventListener(BETVERS_AUTH_SUCCESS_EVENT, onAuth as EventListener);
  }, []);

  const liveUi =
    ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes((fixture.status || '').toUpperCase()) &&
    !isMatchClosedForBetting(fixture);

  return (
    <div className="site-shell bg-[#0D1117] min-h-screen text-white pb-[70px]">
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialView="login"
        key="match-detail-auth"
        onSuccess={(u) => {
          setUser(typeof u?.id === 'number' ? { id: u.id } : null);
          setIsAuthOpen(false);
        }}
      />
      {user ? <BetHistory isOpen={isBetHistoryOpen} onClose={() => setIsBetHistoryOpen(false)} user={user} /> : null}
      <header className="flex items-center h-14 px-4 bg-[#161B22] border-b border-[#30363D] sticky top-0 z-40">
        <Link href="/" className="text-[#8B949E] p-2 -ml-2">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="flex-1 text-center font-bold text-white text-[15px] tracking-wide truncate px-2">
          {fixture.league_name}
        </div>
        <div className="w-8" />
      </header>

      <div className="px-4 py-3 text-[11px] text-[#8B949E] flex items-center gap-1.5 font-bold uppercase tracking-widest">
        <span>Football</span>
        <span className="text-[#30363D]">›</span>
        <span>{fixture.country_name || 'World'}</span>
        <span className="text-[#30363D]">›</span>
        <span className="text-[#FF8C00] truncate">{fixture.league_name}</span>
      </div>

      <section className="mx-3 mt-1 rounded-[1.25rem] overflow-hidden relative shadow-2xl border border-[rgba(255,255,255,0.05)]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F2A1A] via-[#122318] to-[#0A140F] opacity-95" />
        <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/5 to-transparent" />

        <div className="relative px-5 py-6">
          <div className="text-center text-[10px] font-black text-[#5C8D70] mb-5 tracking-[0.2em] uppercase flex flex-col gap-1">
            <span>{formatMatchDate(fixture.match_date)}</span>
            {fixture.venue_name && (
              <span className="opacity-70">
                {fixture.venue_name}, {fixture.venue_city}
              </span>
            )}
            {fixture.referee && (
              <span className="text-[9px] opacity-50 lowercase tracking-normal">Ref: {fixture.referee}</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-2.5 w-[35%]">
              <div className="w-[60px] h-[60px] bg-white/5 rounded-full flex items-center justify-center border border-white/10 p-2.5 shadow-inner">
                {fixture.home_team_logo ? (
                  <img src={fixture.home_team_logo} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="font-bold text-white/70">{getInitials(fixture.home_team_name)}</span>
                )}
              </div>
              <span className="text-[13px] font-bold text-center leading-tight text-white">{fixture.home_team_name}</span>
            </div>

            <div className="flex flex-col items-center justify-center w-[30%]">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[32px] font-black ${
                    liveUi ? 'text-[#16A34A]' : 'text-white'
                  }`}
                >
                  {fixture.home_score ?? '-'}
                </span>
                <span className="text-2xl text-[#FF8C00] font-black opacity-80">:</span>
                <span
                  className={`text-[32px] font-black ${
                    liveUi ? 'text-[#16A34A]' : 'text-white'
                  }`}
                >
                  {fixture.away_score ?? '-'}
                </span>
              </div>
              {renderStatusBadge(fixture)}
              {liveUi && (
                <span className="mt-1.5 text-[8px] font-bold text-[#5C8D70] tracking-widest uppercase">
                  Live view · data from server DB
                </span>
              )}
            </div>

            <div className="flex flex-col items-center gap-2.5 w-[35%]">
              <div className="w-[60px] h-[60px] bg-white/5 rounded-full flex items-center justify-center border border-white/10 p-2.5 shadow-inner">
                {fixture.away_team_logo ? (
                  <img src={fixture.away_team_logo} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="font-bold text-white/70">{getInitials(fixture.away_team_name)}</span>
                )}
              </div>
              <span className="text-[13px] font-bold text-center leading-tight text-white">{fixture.away_team_name}</span>
            </div>
          </div>
        </div>
      </section>

      <MatchOddsClient odds={odds} fixture={fixture} oddsLoading={oddsLoading} />

      <nav className="fixed bottom-0 left-0 right-0 h-[64px] bg-[#161B22] border-t border-[#30363D] flex justify-around items-center z-50">
        <Link href="/" className="flex flex-col items-center gap-1 text-[#FF8C00]">
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <path d="M2 12h20" />
          </svg>
          <span className="text-[10px] font-semibold">Sports</span>
        </Link>
        <Link href="/" prefetch={false} className="flex flex-col items-center gap-1 text-[#8B949E] hover:text-white transition-colors">
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span className="text-[10px] font-semibold">Live</span>
        </Link>
        <Link href="/" prefetch={false} className="flex flex-col items-center gap-1 text-[#8B949E] hover:text-white transition-colors">
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span className="text-[10px] font-semibold">Deposit</span>
        </Link>
        <Link href="/check-ticket" prefetch={false} className="flex flex-col items-center gap-1 text-[#8B949E] hover:text-white transition-colors">
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span className="text-[10px] font-semibold">Check</span>
        </Link>
        <BetSlipDrawer
          onAuthTrigger={() => setIsAuthOpen(true)}
          onBetPlaced={() => setIsBetHistoryOpen(true)}
        />
      </nav>
    </div>
  );
}