import { siteDayBuckets, toSiteDateStr } from './fixture-date-utils';

export type FixtureMetaDay = { id: string; count: number };
export type FixtureMetaCountry = { name: string; count: number; flag_url: string | null };
export type FixtureMetaResult = {
  total: number;
  days: FixtureMetaDay[];
  countries: FixtureMetaCountry[];
};

function dayIdToLabel(dayId: string): string {
  if (dayId === 'all') return 'All Games';
  if (dayId === 'today') return 'Today';
  if (dayId === 'tomorrow') return 'Tomorrow';
  if (dayId.startsWith('date:')) {
    const dateStr = dayId.replace('date:', '');
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(new Date(`${dateStr}T12:00:00Z`));
  }
  return dayId;
}

/** Always expose All + Today + Tomorrow + next 5 calendar days (UTC+3). */
export function buildFixtureMeta(fixtures: Array<Record<string, unknown>>): FixtureMetaResult {
  const dayBuckets = siteDayBuckets();
  const dayCounts = new Map<string, number>();
  for (const bucket of dayBuckets) {
    dayCounts.set(bucket.id, 0);
  }

  let total = 0;
  for (const f of fixtures) {
    const matchDate = toSiteDateStr(String(f.match_date || f.kickoff_at || ''));
    if (!matchDate) continue;
    for (const bucket of dayBuckets) {
      if (matchDate === bucket.date) {
        dayCounts.set(bucket.id, (dayCounts.get(bucket.id) || 0) + 1);
        break;
      }
    }
    total++;
  }

  const days: FixtureMetaDay[] = [
    { id: 'all', count: total },
    ...dayBuckets.map((b) => ({
      id: b.id,
      count: dayCounts.get(b.id) || 0,
    })),
  ];

  const countriesMap = new Map<string, FixtureMetaCountry>();
  for (const f of fixtures) {
    const c = String(f.country_name || 'International');
    if (!countriesMap.has(c)) {
      countriesMap.set(c, { name: c, count: 0, flag_url: (f.flag_url as string | null) || null });
    }
    countriesMap.get(c)!.count++;
  }

  const countries: FixtureMetaCountry[] = [
    { name: 'All countries', count: total, flag_url: null },
    ...Array.from(countriesMap.values()).sort((a, b) => b.count - a.count),
  ];

  return { total, days, countries };
}

export { dayIdToLabel };
