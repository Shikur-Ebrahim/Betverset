const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./betverset.json', 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db = getFirestore();

const TARGET_EMAIL = '251989898989@betvers.bet';

async function main() {
  console.log(`Looking up: ${TARGET_EMAIL}`);
  const user = await auth.getUserByEmail(TARGET_EMAIL);
  console.log(`Found UID: ${user.uid}`);

  // Set role in Firestore users collection
  await db.collection('users').doc(user.uid).set({ role: 'admin' }, { merge: true });
  console.log(`✅ Firestore users/${user.uid} → role: admin`);

  // Also set Firebase Auth custom claim
  await auth.setCustomUserClaims(user.uid, { role: 'admin' });
  console.log(`✅ Firebase Auth custom claim → role: admin`);

  console.log('\n🎉 Done! Log out and log back in on the app.');
  process.exit(0);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
