import HomePageClient from '../components/home-page-client';
import { getCachedHomeBundle } from '../lib/cached-home-bundle';

export const revalidate = 60;

export default async function Home() {
  const { fixtures, odds, meta, topLeagues } = await getCachedHomeBundle();

  return (
    <HomePageClient
      liveMatches={[]}
      upcomingFixtures={fixtures}
      initialOddsMap={odds}
      initialFixtureMeta={meta}
      topLeagues={topLeagues}
      featuredMatches={[]}
    />
  );
}
