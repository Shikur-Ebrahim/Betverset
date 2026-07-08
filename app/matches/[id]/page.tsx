import MatchDetailPageClient from '../../../components/match-detail-page-client';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { expandOddsRows } from '@/lib/load-fixture-odds';
import { formatFixtureRow } from '@/lib/fixture-format';

/** Fetch fixture + odds server-side from Supabase so the detail page renders instantly. */
async function fetchMatchData(fixtureId: string) {
  try {
    const id = Number(fixtureId);
    if (!Number.isFinite(id) || id <= 0) return { fixture: null, odds: [] };

    const [fixtureRes, oddsRes] = await Promise.all([
      supabaseAdmin.from('fixtures').select('*').eq('id', id).single(),
      supabaseAdmin
        .from('odds')
        .select('*')
        .eq('fixture_id', id)
        .limit(200),
    ]);

    const fixture = fixtureRes.data ? formatFixtureRow(fixtureRes.data) : null;
    const odds = expandOddsRows(id, oddsRes.data || []);
    return { fixture, odds };
  } catch {
    return { fixture: null, odds: [] };
  }
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matchId = Number(id);

  const { fixture, odds } =
    Number.isFinite(matchId) && matchId > 0
      ? await fetchMatchData(id)
      : { fixture: null, odds: [] };

  return (
    <MatchDetailPageClient
      matchId={Number.isFinite(matchId) ? matchId : NaN}
      initialFixture={fixture as any}
      initialOdds={odds as any}
    />
  );
}
