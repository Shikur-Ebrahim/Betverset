import { db } from './lib/firebase-admin';

async function check() {
  const s = await db.collection('fixtures').get();
  console.log('Fixtures count:', s.size);
  if (s.size > 0) {
    const data = s.docs[0].data();
    console.log('Sample fixture:', data);
  }
  process.exit(0);
}

check().catch(console.error);
