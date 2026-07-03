import MatchDetailPageClient from '../../../components/match-detail-page-client';

/** Client resolves fixture/odds from session cache for instant navigation from home. */
export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matchId = Number(id);

  return (
    <MatchDetailPageClient
      matchId={Number.isFinite(matchId) ? matchId : NaN}
      initialFixture={null}
      initialOdds={[]}
    />
  );
}
