const fetch = require('node-fetch');

const API_KEY = '028d83b02360897f54f9e8921f48a01b';
const API_BASE = 'https://v3.football.api-sports.io';

async function test() {
  // Test odds for fixture 1493558 which we confirmed has 1 odds response  
  const res = await fetch(`${API_BASE}/odds?fixture=1493558`, {
    headers: { 'x-apisports-key': API_KEY }
  });
  const data = await res.json();
  const responses = data.response || [];
  console.log(`Total response items: ${responses.length}`);
  
  if (responses.length > 0) {
    const first = responses[0];
    console.log('Top-level keys:', Object.keys(first));
    if (first.bookmakers) {
      console.log(`Bookmakers count: ${first.bookmakers.length}`);
      console.log('First bookmaker keys:', Object.keys(first.bookmakers[0]));
    }
    if (first.bookmaker) {
      console.log('Has "bookmaker" key:', first.bookmaker);
    }
  }
}

test().catch(console.error);
