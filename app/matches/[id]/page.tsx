import MatchDetailPageClient from '../../../components/match-detail-page-client';
import { db } from '@/lib/firebase-admin';

/** Fetch fixture + odds server-side so the detail page renders instantly with data. */
async function fetchMatchData(fixtureId: string) {
  try {
    const [fixtureDoc, oddsSnap] = await Promise.all([
      db.collection('fixtures').doc(fixtureId).get(),
      db.collection('odds').where('fixture_id', '==', fixtureId).get(),
    ]);

    const fixture = fixtureDoc.exists ? { id: fixtureDoc.id, ...fixtureDoc.data() } : null;
    const odds = oddsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { fixture, odds };
  } catch {
    return { fixture: null, odds: [] };
  }
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matchId = Number(id);

  const { fixture, odds } = Number.isFinite(matchId) && matchId > 0
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
