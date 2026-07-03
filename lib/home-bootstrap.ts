import { api, type Fixture, type FixtureMeta, type League, type Odd } from './api';
import { mergeDayCountsIntoMeta, metaFromDayCounts } from './fixture-meta-utils';
import { HOME_INITIAL_VISIBLE } from './home-fixture-list';
import {
  homeFeedCacheKey,
  peekHomeFeedCache,
  prefetchHomeCountryFeeds,
  prefetchHomeDayFeeds,
  writeHomeFeedCache,
} from './home-feed-cache';

const PREFETCH_TOP_COUNTRIES = 12;

export type HomeBootstrapSnapshot = {
  fixtures: Fixture[];
  odds: Record<number, Odd[]>;
  meta: FixtureMeta | null;
  topLeagues?: League[];
};

const DEFAULT_KEY = homeFeedCacheKey('all', 'All countries', null);

let memorySnapshot: HomeBootstrapSnapshot | null = null;
let prefetchPromise: Promise<HomeBootstrapSnapshot> | null = null;
let seededFromServer = false;

function snapshotFromCache(): HomeBootstrapSnapshot | null {
  const cached = peekHomeFeedCache(DEFAULT_KEY);
  if (!cached?.fixtures.length) return null;
  return {
    fixtures: cached.fixtures,
    odds: cached.odds,
    meta: cached.meta,
  };
}

/** Hydrate client cache from SSR props — instant first paint, no duplicate fetch. */
export function seedHomeBootstrapFromServer(snap: HomeBootstrapSnapshot): void {
  if (typeof window === 'undefined' || seededFromServer) return;
  if (!snap.fixtures.length) return;
  seededFromServer = true;
  memorySnapshot = snap;
  writeHomeFeedCache(DEFAULT_KEY, snap.fixtures, snap.odds, snap.meta);
  prefetchPromise = Promise.resolve(snap);
  window.setTimeout(() => scheduleWarmCaches(snap.meta), 12_000);
}

export function hasSeededHomeBootstrap(): boolean {
  return seededFromServer;
}

function scheduleWarmCaches(meta: FixtureMeta | null): void {
  if (!meta) return;
  const dayIds = meta.days?.map((d) => d.id).filter((id) => id !== 'all') ?? [];
  if (dayIds.length) {
    prefetchHomeDayFeeds(dayIds, HOME_INITIAL_VISIBLE, (day) =>
      api.getHomeFeed({ limit: HOME_INITIAL_VISIBLE, day })
    );
  }
  const topCountries = (meta.countries ?? [])
    .filter((c) => c.name !== 'All countries' && c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, PREFETCH_TOP_COUNTRIES)
    .map((c) => c.name);
  if (topCountries.length) {
    prefetchHomeCountryFeeds('all', topCountries, HOME_INITIAL_VISIBLE, (params) =>
      api.getHomeFeed({ limit: HOME_INITIAL_VISIBLE, ...params })
    );
  }
}

/** Call when SSR did not provide data — single bootstrap API call. */
export function startHomeFeedPrefetch(): void {
  if (typeof window === 'undefined') return;
  if (prefetchPromise || seededFromServer) return;

  const fromCache = snapshotFromCache();
  if (fromCache) {
    memorySnapshot = fromCache;
    prefetchPromise = Promise.resolve(fromCache);
    scheduleWarmCaches(fromCache.meta);
    return;
  }

  prefetchPromise = (async () => {
    const boot = await api.getHomeBootstrap(HOME_INITIAL_VISIBLE);
    const snap: HomeBootstrapSnapshot = {
      fixtures: boot.fixtures,
      odds: boot.odds,
      meta: boot.meta,
      topLeagues: boot.topLeagues,
    };
    if (snap.fixtures.length > 0) {
      writeHomeFeedCache(DEFAULT_KEY, snap.fixtures, snap.odds, snap.meta);
      memorySnapshot = snap;
      if (snap.meta) {
        window.dispatchEvent(new CustomEvent('betvers:home-meta', { detail: snap.meta }));
      }
      scheduleWarmCaches(snap.meta);
    }
    return snap;
  })();
}

export function peekHomeBootstrap(): HomeBootstrapSnapshot | null {
  if (memorySnapshot?.fixtures.length) return memorySnapshot;
  return snapshotFromCache();
}

export function consumeHomeFeedPrefetch(): Promise<HomeBootstrapSnapshot> | null {
  if (prefetchPromise) return prefetchPromise;
  const cached = peekHomeBootstrap();
  if (cached) return Promise.resolve(cached);
  startHomeFeedPrefetch();
  return prefetchPromise;
}
