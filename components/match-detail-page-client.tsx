'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { api, Fixture, Odd } from '../lib/api';
import {
  findMatchInHomeCaches,
  peekMatchDetailCache,
  prefetchMatchDetailOdds,
  resolveInstantMatchData,
  writeMatchDetailCache,
} from '../lib/match-detail-cache';
import MatchDetailView from './match-detail-view';

type Props = {
  matchId: number;
  initialFixture: Fixture | null;
  initialOdds: Odd[];
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell bg-[#EEF4FF] min-h-screen text-[#111827] flex flex-col items-center justify-center gap-4 px-6">
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div
      className="w-10 h-10 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin"
      aria-hidden
    />
  );
}

export default function MatchDetailPageClient({
  matchId,
  initialFixture,
  initialOdds,
}: Props) {
  const instant = resolveInstantMatchData(matchId, initialFixture, initialOdds);
  const [fixture, setFixture] = useState<Fixture | null>(instant.fixture);
  const [odds, setOdds] = useState<Odd[]>(instant.odds);
  const [oddsLoading, setOddsLoading] = useState(
    Boolean(instant.fixture) && instant.odds.length === 0
  );
  const [loading, setLoading] = useState(!instant.fixture);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!Number.isFinite(matchId) || matchId <= 0) return;
    const cached = peekMatchDetailCache(matchId);
    const resolved = resolveInstantMatchData(matchId, initialFixture, initialOdds);
    const nextFixture = resolved.fixture ?? cached?.fixture ?? null;
    const nextOdds = resolved.odds.length > 0 ? resolved.odds : (cached?.odds ?? []);
    if (nextFixture) {
      setFixture(nextFixture);
      setLoading(false);
      if (nextOdds.length > 0) {
        setOdds(nextOdds);
        setOddsLoading(false);
      } else {
        setOddsLoading(true);
      }
    }
    prefetchMatchDetailOdds(matchId);
  }, [matchId, initialFixture, initialOdds]);

  useEffect(() => {
    if (!Number.isFinite(matchId) || matchId <= 0) {
      setError('Invalid match link.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const cachedNow = peekMatchDetailCache(matchId);
      const homeCached = findMatchInHomeCaches(matchId);
      const hasFullOdds = (cachedNow?.odds?.length ?? 0) > 8;
      const fixtureNow = cachedNow?.fixture ?? homeCached.fixture ?? null;

      if (!hasFullOdds && fixtureNow) {
        setOddsLoading(true);
      }

      const [nextFixture, nextOdds] = await Promise.all([
        fixtureNow ? Promise.resolve(fixtureNow) : api.getFixture(matchId),
        hasFullOdds ? Promise.resolve(cachedNow!.odds) : api.getOdds(matchId),
      ]);

      if (cancelled) return;

      if (nextFixture) {
        setFixture(nextFixture);
        const rows = Array.isArray(nextOdds) ? nextOdds : [];
        if (rows.length > 0) {
          setOdds(rows);
          writeMatchDetailCache(nextFixture, rows);
        } else if (cachedNow?.odds?.length) {
          setOdds(cachedNow.odds);
          writeMatchDetailCache(nextFixture, cachedNow.odds);
        } else {
          writeMatchDetailCache(nextFixture, []);
        }
        setError(null);
        setLoading(false);
      } else if (!fixture) {
        setError('This match could not be loaded. It may have ended or been removed.');
        setLoading(false);
      }

      setOddsLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (!Number.isFinite(matchId) || matchId <= 0) {
    return (
      <Shell>
        <p className="text-sm text-[#6B7280] text-center">Invalid match link.</p>
        <Link href="/" className="text-[#2563EB] font-semibold text-sm">
          Back to home
        </Link>
      </Shell>
    );
  }

  if (loading && !fixture) {
    return (
      <Shell>
        <Spinner />
        <p className="text-sm text-[#6B7280]">Loading match…</p>
      </Shell>
    );
  }

  if (error && !fixture) {
    return (
      <Shell>
        <p className="text-sm text-[#6B7280] text-center max-w-xs">{error}</p>
        <Link href="/" className="text-[#2563EB] font-semibold text-sm">
          Back to home
        </Link>
      </Shell>
    );
  }

  if (!fixture) {
    return (
      <Shell>
        <p className="text-sm text-[#6B7280] text-center">Match not found.</p>
        <Link href="/" className="text-[#2563EB] font-semibold text-sm">
          Back to home
        </Link>
      </Shell>
    );
  }

  return (
    <MatchDetailView
      initialFixture={fixture}
      initialOdds={odds}
      oddsLoading={oddsLoading}
    />
  );
}
