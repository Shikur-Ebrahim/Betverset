const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./betverset.json', 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

async function main() {
  // Find admin in Firestore
  const snap = await db.collection('users').where('role', '==', 'admin').limit(5).get();
  console.log(`Admin users in Firestore: ${snap.size}`);
  snap.forEach(doc => {
    const d = doc.data();
    console.log('Admin doc:', { id: doc.id, phone: d.phone, role: d.role, email: d.email });
  });

  // List all Firebase Auth users
  console.log('\nFirebase Auth users:');
  const listResult = await auth.listUsers(10);
  listResult.users.forEach(user => {
    console.log({ uid: user.uid, email: user.email, displayName: user.displayName });
  });

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
