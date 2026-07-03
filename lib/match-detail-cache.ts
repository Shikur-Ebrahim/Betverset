import type { Fixture, Odd } from './api';
import { getPublicApiBaseUrl } from './public-api-url';
import { homeFeedCacheKey, peekHomeFeedCache } from './home-feed-cache';

const STORAGE_PREFIX = 'betvers-match:';
const TTL_MS = 30 * 60 * 1000;

type MatchDetailCacheEntry = {
  fixture: Fixture;
  odds: Odd[];
  savedAt: number;
};

const memoryCache = new Map<number, MatchDetailCacheEntry>();
const prefetchInFlight = new Set<number>();

function isFresh(entry: MatchDetailCacheEntry | null | undefined): entry is MatchDetailCacheEntry {
  if (!entry?.fixture) return false;
  return Date.now() - entry.savedAt < TTL_MS;
}

export function peekMatchDetailCache(fixtureId: number): MatchDetailCacheEntry | null {
  const mem = memoryCache.get(fixtureId);
  if (mem && isFresh(mem)) return mem;
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + fixtureId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MatchDetailCacheEntry;
    if (!isFresh(parsed)) {
      sessionStorage.removeItem(STORAGE_PREFIX + fixtureId);
      memoryCache.delete(fixtureId);
      return null;
    }
    memoryCache.set(fixtureId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeMatchDetailCache(fixture: Fixture, odds: Odd[] = []): void {
  const existing = peekMatchDetailCache(fixture.id);
  const mergedOdds =
    odds.length > 0
      ? odds
      : existing?.odds?.length
        ? existing.odds
        : [];
  const entry: MatchDetailCacheEntry = {
    fixture,
    odds: mergedOdds,
    savedAt: Date.now(),
  };
  memoryCache.set(fixture.id, entry);
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + fixture.id, JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

export function writeMatchDetailOdds(fixtureId: number, odds: Odd[]): void {
  if (!odds.length) return;
  const existing = peekMatchDetailCache(fixtureId);
  if (existing?.fixture) {
    writeMatchDetailCache(existing.fixture, odds);
    return;
  }
  const home = findMatchInHomeCaches(fixtureId);
  if (home.fixture) {
    writeMatchDetailCache(home.fixture, odds);
  }
}

/** Home feed session/memory caches (fixture + 1X2 odds). */
export function findMatchInHomeCaches(id: number): { fixture: Fixture | null; odds: Odd[] } {
  if (typeof window === 'undefined') return { fixture: null, odds: [] };
  const keys = [
    homeFeedCacheKey('all', 'All countries', null),
    homeFeedCacheKey('today', 'All countries', null),
    homeFeedCacheKey('tomorrow', 'All countries', null),
  ];
  for (const key of keys) {
    const cached = peekHomeFeedCache(key);
    const hit = cached?.fixtures.find((f) => f.id === id);
    if (hit && cached) {
      return { fixture: hit, odds: cached.odds[id] ?? [] };
    }
  }
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k?.startsWith('betvers-home-feed:')) continue;
      const raw = sessionStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        fixtures?: Fixture[];
        odds?: Record<string, Odd[]>;
      };
      const hit = parsed.fixtures?.find((f) => f.id === id);
      if (hit) {
        const odds = parsed.odds?.[String(id)] ?? parsed.odds?.[id] ?? [];
        return { fixture: hit, odds };
      }
    }
  } catch {
    /* ignore */
  }
  return { fixture: null, odds: [] };
}

/** Fastest available fixture + odds for instant match detail paint. */
export function resolveInstantMatchData(
  fixtureId: number,
  initialFixture: Fixture | null,
  initialOdds: Odd[]
): { fixture: Fixture | null; odds: Odd[] } {
  if (initialFixture) {
    return { fixture: initialFixture, odds: initialOdds };
  }
  if (typeof window === 'undefined') {
    return { fixture: null, odds: [] };
  }
  const dedicated = peekMatchDetailCache(fixtureId);
  if (dedicated?.fixture) {
    return { fixture: dedicated.fixture, odds: dedicated.odds };
  }
  const home = findMatchInHomeCaches(fixtureId);
  if (home.fixture) {
    return home;
  }
  return { fixture: null, odds: [] };
}

/** Warm full odds before navigation (hover / touch). */
export function prefetchMatchDetailOdds(fixtureId: number): void {
  if (typeof window === 'undefined') return;
  if (!Number.isFinite(fixtureId) || fixtureId <= 0) return;
  const cached = peekMatchDetailCache(fixtureId);
  if (cached && cached.odds.length > 8) return;
  if (prefetchInFlight.has(fixtureId)) return;
  prefetchInFlight.add(fixtureId);
  void fetch(`${getPublicApiBaseUrl()}/odds/fixture/${fixtureId}`, { credentials: 'omit' })
    .then((res) => (res.ok ? res.json() : []))
    .then((rows: Odd[]) => {
      if (Array.isArray(rows) && rows.length > 0) {
        writeMatchDetailOdds(fixtureId, rows);
      }
    })
    .catch(() => {})
    .finally(() => prefetchInFlight.delete(fixtureId));
}
