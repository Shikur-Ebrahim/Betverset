import 'dotenv/config';
import { db } from './lib/firebase-admin';

async function run() {
  const snap = await db.collection('fixtures').limit(3).get();
  snap.docs.forEach(d => {
    const x = d.data();
    console.log('ID:', d.id);
    console.log('  home_team_name:', JSON.stringify(x.home_team_name));
    console.log('  away_team_name:', JSON.stringify(x.away_team_name));
    console.log('  home_team_logo:', JSON.stringify(x.home_team_logo));
    console.log('  away_team_logo:', JSON.stringify(x.away_team_logo));
    console.log('  has_odds:', x.has_odds);
    console.log('---');
  });
}
run().catch(console.error).finally(() => process.exit(0));
