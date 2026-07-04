import { apiFetch } from './lib/services/apiFootball';

async function test() {
  const today = new Date().toISOString().split('T')[0];
  console.log('Fetching odds for', today);
  const data = await apiFetch('/odds', { date: today, page: 1 });
  console.log('Got', data.length, 'fixtures with odds on page 1');
  if (data.length > 0) {
    console.log('First fixture with odds:', data[0].fixture.id);
  }
}

test().catch(console.error);
