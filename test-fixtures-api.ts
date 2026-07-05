import 'dotenv/config';

const API_KEY = process.env.FOOTBALL_API_KEY || '';
const today = new Date().toISOString().split('T')[0];

async function run() {
  // Try the /fixtures endpoint for today to see if it has team names
  const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}&timezone=Africa/Addis_Ababa`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  const json = await res.json();
  const items = json?.response ?? [];
  console.log('Fixtures count:', items.length);
  if (items[0]) {
    const f = items[0];
    console.log('fixture.id:', f.fixture?.id);
    console.log('teams.home:', f.teams?.home);
    console.log('teams.away:', f.teams?.away);
    console.log('league:', f.league?.name, f.league?.country);
  }
}

run().catch(console.error).finally(() => process.exit(0));
