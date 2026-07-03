import type { Fixture } from './api';
import { isMatchClosedForBetting } from './match-status';

/** Matches shown on first paint (frontend window only). */
export const HOME_INITIAL_VISIBLE = 100;

/** Extra matches revealed per "See more" click (client-side, no refetch). */
export const HOME_LOAD_MORE_STEP = 50;

export const CAROUSEL_ACTIVE_STATUSES = ['NS', 'TBD', '1H', '2H', 'HT', 'ET', 'P', 'LIVE'];

/** Top fixtures for the home “Popular Events” carousel (no extra API round-trip). */
export function pickCarouselFixtures(fixtures: Fixture[], limit = 12): Fixture[] {
  const active = fixtures.filter((f) =>
    CAROUSEL_ACTIVE_STATUSES.includes((f.status || '').toUpperCase())
  );
  return [...active]
    .sort((a, b) => {
      const apiIdA = a.api_league_id ?? 0;
      const apiIdB = b.api_league_id ?? 0;
      const priorityA = TOP_LEAGUE_PRIORITY.indexOf(apiIdA);
      const priorityB = TOP_LEAGUE_PRIORITY.indexOf(apiIdB);
      const rankA = priorityA === -1 ? 999 : priorityA;
      const rankB = priorityB === -1 ? 999 : priorityB;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(a.match_date).getTime() - new Date(b.match_date).getTime();
    })
    .slice(0, limit);
}

const TOP_LEAGUE_PRIORITY = [
  39, 2, 140, 135, 78, 61, 3, 848, 45, 40, 307, 253, 71, 88, 94,
];

function compareLeagueGroups(
  keyA: string,
  matchesA: Fixture[],
  keyB: string,
  matchesB: Fixture[]
): number {
  const apiIdA = matchesA[0]?.api_league_id ?? 0;
  const apiIdB = matchesB[0]?.api_league_id ?? 0;

  const priorityA = TOP_LEAGUE_PRIORITY.indexOf(apiIdA);
  const priorityB = TOP_LEAGUE_PRIORITY.indexOf(apiIdB);

  if (priorityA !== -1 && priorityB !== -1) {
    if (priorityA !== priorityB) return priorityA - priorityB;
  } else if (priorityA !== -1) {
    return -1;
  } else if (priorityB !== -1) {
    return 1;
  }

  const liveStatuses = ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'];
  const isLiveA = matchesA.some(
    (m) => liveStatuses.includes(m.status?.toUpperCase() || '') && !isMatchClosedForBetting(m)
  );
  const isLiveB = matchesB.some(
    (m) => liveStatuses.includes(m.status?.toUpperCase() || '') && !isMatchClosedForBetting(m)
  );

  if (isLiveA !== isLiveB) return isLiveA ? -1 : 1;

  return keyA.localeCompare(keyB);
}

/** Group fixtures by league (country + name) with the same sort as the home list. */
export function groupFixturesByLeague(fixtures: Fixture[]): [string, Fixture[]][] {
  const grouped = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const country = fixture.country_name || 'International';
    const leagueKey = `${country}: ${fixture.league_name}`;
    if (!grouped.has(leagueKey)) grouped.set(leagueKey, []);
    grouped.get(leagueKey)!.push(fixture);
  }
  return Array.from(grouped.entries()).sort(([keyA, matchesA], [keyB, matchesB]) =>
    compareLeagueGroups(keyA, matchesA, keyB, matchesB)
  );
}

/** Flat list in display order (for pagination windowing). */
export function orderFixturesForHomeList(fixtures: Fixture[]): Fixture[] {
  return groupFixturesByLeague(fixtures).flatMap(([, matches]) => matches);
}
