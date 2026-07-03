const fetch = require('node-fetch');

const API_KEY = '028d83b02360897f54f9e8921f48a01b';
const API_BASE = 'https://v3.football.api-sports.io';

async function test() {
  // Try fetching fixtures for next 10 days for a summer league, e.g., MLS (253) or Allsvenskan (113) or Eliteserien (61)
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  
  console.log(`Fetching all fixtures for today (${today})...`);
  const res = await fetch(`${API_BASE}/fixtures?date=${today}`, {
    headers: { 'x-apisports-key': API_KEY }
  });
  const data = await res.json();
  const fixtures = data.response || [];
  
  console.log(`Found ${fixtures.length} fixtures globally today.`);
  
  if (fixtures.length > 0) {
    const fixtureId = fixtures[0].fixture.id;
    console.log(`Fetching odds for fixture ${fixtureId} (${fixtures[0].league.name})...`);
    const oddsRes = await fetch(`${API_BASE}/odds?fixture=${fixtureId}`, {
      headers: { 'x-apisports-key': API_KEY }
    });
    const oddsData = await oddsRes.json();
    console.log(`Odds found: ${oddsData.response?.length || 0}`);
  }
}

test().catch(console.error);
