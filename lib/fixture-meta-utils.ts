import type { FixtureDayCounts, FixtureMeta } from './api';

function countriesFromSummary(counts: FixtureDayCounts) {
  const rows = (counts.countries ?? []).filter((c) => c.name !== 'All countries');
  return [
    { name: 'All countries', count: counts.total, flag_url: null as string | null },
    ...rows,
  ];
}

export function metaFromDayCounts(counts: FixtureDayCounts): FixtureMeta {
  return {
    total: counts.total,
    days: counts.days,
    countries: countriesFromSummary(counts),
  };
}

/** Merge fast /meta/summary into existing meta (keeps country breakdown when loaded). */
export function mergeDayCountsIntoMeta(
  prev: FixtureMeta | null,
  counts: FixtureDayCounts
): FixtureMeta {
  if (!prev) return metaFromDayCounts(counts);
  const fromSummary = (counts.countries ?? []).filter((c) => c.name !== 'All countries');
  const extraCountries =
    fromSummary.length > 0
      ? fromSummary
      : prev.countries.filter((c) => c.name !== 'All countries');
  return {
    total: counts.total,
    days: counts.days,
    countries: [
      { name: 'All countries', count: counts.total, flag_url: null },
      ...extraCountries,
    ],
  };
}
