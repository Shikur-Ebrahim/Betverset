import 'dotenv/config';
import { db } from './lib/firebase-admin';
import { apiFetch } from './lib/services/apiFootball';

async function testPerf() {
  console.time('Total');
  console.time('apiFetch');
  const today = new Date().toISOString().split('T')[0];
  
  // Custom fetch instead of apiFetch to time it
  console.time('API Football HTTP call');
  // Pass bet=1 to only get Match Winner odds! This reduces the payload size by 99%!
  const url = `https://v3.football.api-sports.io/odds?date=${today}&page=1&bet=1`;
  const res = await fetch(url, {
    headers: { 'x-apisports-key': process.env.FOOTBALL_API_KEY || '' },
  });
  const json = await res.json();
  const oddsPage = json?.response ?? [];
  console.timeEnd('API Football HTTP call');
  
  console.timeEnd('apiFetch');

  console.time('Process');
  const batch = db.batch();
  let count = 0;
  for (const item of oddsPage.slice(0, 10)) {
    const fixture = item?.fixture;
    if (!fixture?.id) continue;
    const ref = db.collection('fixtures').doc(String(fixture.id));
    batch.set(ref, { api_fixture_id: fixture.id }, { merge: true });
    count++;
  }
  console.timeEnd('Process');

  console.time('Firestore Commit');
  if (count > 0) {
    await batch.commit();
  }
  console.timeEnd('Firestore Commit');
  console.timeEnd('Total');
}

testPerf().catch(console.error).finally(() => process.exit(0));
