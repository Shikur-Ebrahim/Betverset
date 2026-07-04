import 'dotenv/config';
import { db } from './lib/firebase-admin';

async function count() {
  const s = await db.collection('fixtures').get();
  console.log('Fixtures count:', s.size);
  process.exit(0);
}

count().catch(console.error);
