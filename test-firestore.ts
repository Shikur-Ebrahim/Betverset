import 'dotenv/config';
import { db } from './lib/firebase-admin';

async function run() {
  console.log('Testing Firestore connection...');
  const ref = db.collection('users').limit(1);
  const snap = await ref.get();
  console.log('Docs found:', snap.size);
}

run().catch(console.error).finally(() => process.exit(0));
