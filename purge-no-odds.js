const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(
  fs.readFileSync('./betverset.json', 'utf8')
);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function purgeMatchesWithoutOdds() {
  console.log('Fetching all fixtures...');
  const fixturesSnap = await db.collection('fixtures').get();
  
  if (fixturesSnap.empty) {
    console.log('No fixtures found.');
    return;
  }
  
  console.log(`Found ${fixturesSnap.size} fixtures. Checking for odds...`);
  
  let deletedCount = 0;
  
  for (const doc of fixturesSnap.docs) {
    const fixtureId = doc.id;
    
    // Check if there's any odd document with this fixture_id
    const oddsSnap = await db.collection('odds')
      .where('fixture_id', '==', fixtureId)
      .limit(1)
      .get();
      
    if (oddsSnap.empty) {
      // No odds found for this fixture, delete it!
      await db.collection('fixtures').doc(fixtureId).delete();
      console.log(`Deleted fixture ${fixtureId} because it has no odds.`);
      deletedCount++;
    }
  }
  
  console.log(`Purge complete. Deleted ${deletedCount} matches without odds.`);
  process.exit(0);
}

purgeMatchesWithoutOdds().catch(err => {
  console.error(err);
  process.exit(1);
});
