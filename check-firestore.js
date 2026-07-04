const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin if not already
if (!require('firebase-admin').apps.length) {
  require('firebase-admin').initializeApp({
    credential: require('firebase-admin').credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  });
}

const db = getFirestore();

async function check() {
  const fixtures = await db.collection('fixtures').get();
  const odds = await db.collection('odds').limit(10).get();
  console.log('Fixtures count:', fixtures.size);
  console.log('Odds count:', odds.size);
}
check().catch(console.error);
