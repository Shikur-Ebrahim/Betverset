/** Map Supabase fixture rows to the flat shape expected by the UI. */

export const LIVE_IN_PLAY_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'];

function toNumber(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatFixtureRow(doc: Record<string, unknown>) {
  const homeGoals = toNullableNumber(doc.home_goals ?? doc.home_score);
  const awayGoals = toNullableNumber(doc.away_goals ?? doc.away_score);
  const minuteRaw = doc.elapsed ?? doc.minute ?? null;

  return {
    id: doc.id as number,
    league_id: (doc.league_id as number) ?? 0,
    home_team_id: (doc.home_team_id as number) ?? 0,
    away_team_id: (doc.away_team_id as number) ?? 0,
    match_date: String(doc.match_date || doc.kickoff_at || ''),
    kickoff_at: String(doc.kickoff_at || doc.match_date || ''),
    status: String(doc.status || 'NS'),
    elapsed: minuteRaw,
    minute: minuteRaw != null ? toNumber(minuteRaw) : 0,
    home_score: homeGoals ?? 0,
    away_score: awayGoals ?? 0,
    home_goals: homeGoals,
    away_goals: awayGoals,
    home_team_name: String(doc.home_team_name || ''),
    home_team_logo: String(doc.home_team_logo || ''),
    away_team_name: String(doc.away_team_name || ''),
    away_team_logo: String(doc.away_team_logo || ''),
    home_odds: toNullableNumber(doc.home_odds),
    draw_odds: toNullableNumber(doc.draw_odds),
    away_odds: toNullableNumber(doc.away_odds),
    league_name: String(doc.league_name || ''),
    league_logo: String(doc.league_logo || ''),
    api_league_id: (doc.api_league_id as number) ?? (doc.league_id as number) ?? 0,
    country_name: String(doc.country_name || ''),
    flag_url: String(doc.flag_url || ''),
    venue_name: String(doc.venue_name || ''),
    venue_city: String(doc.venue_city || ''),
    referee: String(doc.referee || ''),
  };
}

export function formatLiveMatchRow(doc: Record<string, unknown>) {
  const fixture = formatFixtureRow(doc);
  const status = fixture.status.toUpperCase();

  return {
    id: fixture.id,
    fixture_id: fixture.id,
    status: fixture.status,
    minute: fixture.minute,
    home_score: fixture.home_score,
    away_score: fixture.away_score,
    is_active: LIVE_IN_PLAY_STATUSES.includes(status),
    match_date: fixture.match_date,
    home_team_name: fixture.home_team_name,
    home_team_logo: fixture.home_team_logo,
    away_team_name: fixture.away_team_name,
    away_team_logo: fixture.away_team_logo,
    league_name: fixture.league_name,
    league_logo: fixture.league_logo,
    api_league_id: fixture.api_league_id,
    country_name: fixture.country_name,
    flag_url: fixture.flag_url,
  };
}

export function formatFixtureRows(rows: Record<string, unknown>[]) {
  return (rows || []).map(formatFixtureRow);
}
