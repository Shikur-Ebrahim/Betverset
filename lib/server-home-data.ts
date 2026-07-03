import { fetchWithTimeout } from './fetch-with-timeout';
import { FIXTURE_LIST_LIMIT } from './api';
import { HOME_INITIAL_VISIBLE } from './home-fixture-list';
import { getPublicApiBaseUrl } from './public-api-url';
import type { Fixture, FixtureDayCounts, FixtureMeta, League, Odd } from './api';
import { metaFromDayCounts } from './fixture-meta-utils';

export type ServerHomeBundle = {
  fixtures: Fixture[];
  odds: Record<number, Odd[]>;
  meta: FixtureMeta | null;
  topLeagues: League[];
};

const EMPTY_META: FixtureMeta = { total: 0, days: [], countries: [] };

function parseOddsMap(raw: unknown): Record<number, Odd[]> {
  const out: Record<number, Odd[]> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, rows] of Object.entries(raw as Record<string, unknown>)) {
    const id = parseInt(key, 10);
    if (Number.isFinite(id) && Array.isArray(rows)) out[id] = rows as Odd[];
  }
  return out;
}

export function emptyServerHomeBundle(): ServerHomeBundle {
  return { fixtures: [], odds: {}, meta: null, topLeagues: [] };
}

const SSR_MAX_WAIT_MS = 8_000;

/** Server-only: first paint bundle for home (100 matches + dropdown counts). */
export async function fetchServerHomeBundle(): Promise<ServerHomeBundle> {
  let base: string;
  try {
    base = getPublicApiBaseUrl();
  } catch {
    return { fixtures: [], odds: {}, meta: null, topLeagues: [] };
  }

  const limit = FIXTURE_LIST_LIMIT;

  try {
    const bootstrapRes = await fetchWithTimeout(`${base}/fixtures/bootstrap?limit=${limit}`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 },
      timeoutMs: 6_000,
    });

    if (bootstrapRes.ok) {
      const boot = (await bootstrapRes.json()) as {
        fixtures?: Fixture[];
        odds?: unknown;
        meta?: FixtureMeta;
        topLeagues?: League[];
      };
      const fixtures = Array.isArray(boot.fixtures) ? boot.fixtures : [];
      const odds = parseOddsMap(boot.odds);
      const meta = boot.meta?.days?.length ? boot.meta : null;
      const topLeagues = Array.isArray(boot.topLeagues) ? boot.topLeagues.slice(0, 15) : [];
      return { fixtures, odds, meta, topLeagues };
    }

    const summaryRes = await fetchWithTimeout(`${base}/fixtures/meta/summary?has_odds=1`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 120 },
      timeoutMs: 8_000,
    });

    let fixtures: Fixture[] = [];
    let odds: Record<number, Odd[]> = {};
    let meta: FixtureMeta | null = null;
    if (summaryRes.ok) {
      const summary = (await summaryRes.json()) as FixtureDayCounts;
      if (summary?.days?.length) meta = metaFromDayCounts(summary);
    }

    return { fixtures, odds, meta, topLeagues: [] };
  } catch {
    return emptyServerHomeBundle();
  }
}

/** Do not block the HTML longer than SSR_MAX_WAIT_MS — client/cache fills in if slow. */
export async function fetchServerHomeBundleFast(): Promise<ServerHomeBundle> {
  return Promise.race([
    fetchServerHomeBundle(),
    new Promise<ServerHomeBundle>((resolve) => {
      setTimeout(() => resolve(emptyServerHomeBundle()), SSR_MAX_WAIT_MS);
    }),
  ]);
}
