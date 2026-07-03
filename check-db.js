const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./betverset.json', 'utf8'));

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function main() {
  // Check quota
  const quotaDoc = await db.collection('app_settings').doc('api_quota').get();
  console.log('API Quota status:', JSON.stringify(quotaDoc.data(), null, 2));

  // Check how many fixtures are saved
  const fixtures = await db.collection('fixtures').get();
  console.log(`\nFixtures in database: ${fixtures.size}`);
  
  // Check how many odds are saved
  const odds = await db.collection('odds').limit(5).get();
  console.log(`Odds sample size: ${odds.size}`);
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
