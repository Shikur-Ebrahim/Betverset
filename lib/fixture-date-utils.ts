/** East Africa Time (UTC+3) — used for day tabs on the home page. */
export const SITE_TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

export function toSiteDateStr(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  return new Date(ms + SITE_TZ_OFFSET_MS).toISOString().slice(0, 10);
}

export function siteDayBuckets(now = new Date()) {
  const localMs = now.getTime() + SITE_TZ_OFFSET_MS;
  const base = new Date(localMs);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const d = base.getUTCDate();

  const buckets: { id: string; date: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(Date.UTC(y, m, d + i));
    const dateStr = day.toISOString().slice(0, 10);
    const id = i === 0 ? 'today' : i === 1 ? 'tomorrow' : `date:${dateStr}`;
    buckets.push({ id, date: dateStr });
  }
  return buckets;
}

export function siteDayUtcRange(dateStr: string): { start: string; end: string } {
  const dayStartUtc = Date.parse(`${dateStr}T00:00:00.000Z`) - SITE_TZ_OFFSET_MS;
  const dayEndUtc = Date.parse(`${dateStr}T23:59:59.999Z`) - SITE_TZ_OFFSET_MS;
  return {
    start: new Date(dayStartUtc).toISOString(),
    end: new Date(dayEndUtc).toISOString(),
  };
}

export function siteWindowRange(now = new Date()) {
  const buckets = siteDayBuckets(now);
  const { start } = siteDayUtcRange(buckets[0].date);
  const { end } = siteDayUtcRange(buckets[buckets.length - 1].date);
  const liveStart = new Date(new Date(start).getTime() - 2 * 60 * 60 * 1000).toISOString();
  return { start: liveStart, end };
}

export function siteDayIdForFixture(iso: string | null | undefined, now = new Date()): string | null {
  const fixtureDate = toSiteDateStr(iso);
  if (!fixtureDate) return null;
  for (const bucket of siteDayBuckets(now)) {
    if (fixtureDate === bucket.date) return bucket.id;
  }
  return null;
}
