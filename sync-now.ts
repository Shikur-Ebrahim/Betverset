import 'dotenv/config';
import { db } from './lib/firebase-admin';
import { fetchAndStoreFixturesForWindow, fetchAndStoreOddsForFixture } from './lib/services/apiFootball';

async function main() {
  console.log('Starting manual sync to populate fixtures...');
  
  // 1. Fetch upcoming fixtures
  console.log('Fetching fixtures for today...');
  await fetchAndStoreFixturesForWindow();
  
  // 2. Fetch odds for those fixtures
  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const snapshot = await db.collection('fixtures')
    .where('match_date', '>=', now.toISOString())
    .where('match_date', '<=', twoDaysFromNow)
    .get();

  let oddsFetched = 0;
  console.log(`Found ${snapshot.size} upcoming fixtures. Checking odds...`);
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const fixtureId = Number(data.api_fixture_id);
    
    if (!fixtureId) continue;

    try {
      console.log(`Checking odds for fixture ${fixtureId}...`);
      const count = await fetchAndStoreOddsForFixture(fixtureId);
      oddsFetched += count;
      
      if (count === 0) {
        await db.collection('fixtures').doc(doc.id).delete();
        console.log(`Deleted fixture ${fixtureId} because it has no odds.`);
      } else {
        console.log(`Added odds for fixture ${fixtureId}.`);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('daily limit reached')) {
        console.warn('API Quota reached. Stopping odds sync.');
        break;
      }
      console.error(`Failed odds for fixture ${fixtureId}:`, err.message);
    }
  }

  console.log(`Done. Fetched odds for upcoming fixtures: ${oddsFetched} odds stored.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
