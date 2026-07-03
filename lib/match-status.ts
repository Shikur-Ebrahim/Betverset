/** Regulation clock from API values like 90, "90", "90+4'", "90+4". */
function regulationMinute(raw: number | string | null | undefined): number {
  if (raw == null || raw === '') return 0;
  const s = String(raw).trim();
  const plus = s.indexOf('+');
  const head = (plus >= 0 ? s.slice(0, plus) : s).trim();
  const lead = head.match(/^(\d+)/);
  if (lead) return Number(lead[1]);
  const n = Number(head);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Match is closed for betting / odds UI:
 * — API reports full-time (or extra time / pens finished), or
 * — Second half (or generic LIVE) at minute ≥ 90 (regulation complete; no injury-time wait).
 * ET / P before FT stay open until FT so cup ties are not cut off mid-flow.
 */
export function isMatchClosedForBetting(fixture: {
  status?: string | null;
  minute?: number | string | null;
}): boolean {
  const s = String(fixture.status || '').toUpperCase();
  if (['FT', 'AET', 'PEN'].includes(s)) return true;
  const m = regulationMinute(fixture.minute);
  if (m >= 90 && (s === '2H' || s === 'LIVE')) return true;
  return false;
}
