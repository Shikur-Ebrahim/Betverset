import type { Fixture, FixtureMeta, Odd } from './api';

export type HomeFeedCacheEntry = {
  fixtures: Fixture[];
  odds: Record<number, Odd[]>;
  meta: FixtureMeta | null;
  savedAt: number;
};

const STORAGE_PREFIX = 'betvers-home-feed:';
const TTL_MS = 30 * 60 * 1000;

const memoryCache = new Map<string, HomeFeedCacheEntry>();
const prefetchInFlight = new Set<string>();

export function homeFeedCacheKey(
  day: string,
  country: string,
  leagueId: number | null
): string {
  return `${day}|${country}|${leagueId ?? 'all'}`;
}

function isFresh(entry: HomeFeedCacheEntry | null | undefined): entry is HomeFeedCacheEntry {
  if (!entry?.fixtures?.length) return false;
  return Date.now() - entry.savedAt < TTL_MS;
}

export function peekHomeFeedCache(key: string): HomeFeedCacheEntry | null {
  const mem = memoryCache.get(key);
  if (mem && isFresh(mem)) return mem;
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeFeedCacheEntry;
    if (!isFresh(parsed)) {
      sessionStorage.removeItem(STORAGE_PREFIX + key);
      memoryCache.delete(key);
      return null;
    }
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeHomeFeedCache(
  key: string,
  fixtures: Fixture[],
  odds: Record<number, Odd[]>,
  meta: FixtureMeta | null
): void {
  if (!fixtures.length) return;
  const entry: HomeFeedCacheEntry = {
    fixtures,
    odds,
    meta,
    savedAt: Date.now(),
  };
  memoryCache.set(key, entry);
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

function prefetchHomeFeedKey(
  key: string,
  fetch: () => Promise<{ fixtures: Fixture[]; odds: Record<number, Odd[]> }>
): void {
  if (typeof window === 'undefined') return;
  if (peekHomeFeedCache(key) || prefetchInFlight.has(key)) return;
  prefetchInFlight.add(key);
  void fetch()
    .then(({ fixtures, odds }) => {
      if (fixtures.length > 0) writeHomeFeedCache(key, fixtures, odds, null);
    })
    .catch(() => {})
    .finally(() => prefetchInFlight.delete(key));
}

/** Warm per-day home feeds so Today / Tomorrow clicks are instant. */
export function prefetchHomeDayFeeds(
  dayIds: string[],
  limit: number,
  fetchFeed: (day: string) => Promise<{ fixtures: Fixture[]; odds: Record<number, Odd[]> }>
): void {
  for (const dayId of dayIds) {
    if (!dayId || dayId === 'all') continue;
    const key = homeFeedCacheKey(dayId, 'All countries', null);
    prefetchHomeFeedKey(key, () => fetchFeed(dayId));
  }
}

/** Warm per-country feeds for the landing country dropdown / sidebar. */
export function prefetchHomeCountryFeeds(
  day: string,
  countries: string[],
  limit: number,
  fetchFeed: (params: {
    day?: string;
    country: string;
  }) => Promise<{ fixtures: Fixture[]; odds: Record<number, Odd[]> }>
): void {
  for (const country of countries) {
    if (!country || country === 'All countries') continue;
    const key = homeFeedCacheKey(day, country, null);
    prefetchHomeFeedKey(key, () =>
      fetchFeed({
        day: day !== 'all' ? day : undefined,
        country,
      })
    );
  }
}
