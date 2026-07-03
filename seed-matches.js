const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fetch = require('node-fetch');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./betverset.json', 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const API_KEY = '028d83b02360897f54f9e8921f48a01b';
const API_BASE = 'https://v3.football.api-sports.io';

async function apiFetch(endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), { headers: { 'x-apisports-key': API_KEY } });
  const json = await res.json();
  return json?.response ?? [];
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`Fetching all fixtures for today (${today})...`);
  
  const fixtures = await apiFetch('/fixtures', { date: today });
  console.log(`Got ${fixtures.length} fixtures`);

  let saved = 0;

  for (const item of fixtures) {
    const f = item?.fixture;
    const teams = item?.teams;
    const league = item?.league;
    const goals = item?.goals;
    if (!f?.id) continue;

    // Fetch odds for this fixture
    const oddsData = await apiFetch('/odds', { fixture: f.id });
    
    let oddsCount = 0;
    const batch = db.batch();

    for (const oddsItem of oddsData) {
      const bookmakers = oddsItem?.bookmakers ?? [];
      for (const bookmaker of bookmakers) {
        if (!bookmaker?.id) continue;
        const bets = bookmaker?.bets ?? [];
        for (const bet of bets) {
          for (const value of bet?.values ?? []) {
            const oddId = `${f.id}_${bookmaker.id}_${bet.id}_${value.value}`.replace(/\//g, '-').replace(/\s+/g, '_');
            const ref = db.collection('odds').doc(oddId);
            batch.set(ref, {
              fixture_id: String(f.id),
              bookmaker_id: String(bookmaker.id),
              bookmaker_name: bookmaker.name || '',
              market_id: String(bet.id),
              market_name: bet.name || '',
              market_key: bet.name?.toLowerCase().replace(/\s+/g, '_') || '',
              selection: value.value || '',
              odd_value: parseFloat(value.odd) || null,
              last_update: new Date().toISOString(),
            }, { merge: true });
            oddsCount++;
          }
        }
      }
    }

    if (oddsCount > 0) {
      // Save the fixture
      const ref = db.collection('fixtures').doc(String(f.id));
      batch.set(ref, {
        api_fixture_id: f.id,
        match_date: f.date || null,
        status: f.status?.short || 'NS',
        elapsed: f.status?.elapsed || null,
        referee: f.referee || null,
        home_team_id: String(teams?.home?.id || ''),
        away_team_id: String(teams?.away?.id || ''),
        home_team_name: teams?.home?.name || '',
        away_team_name: teams?.away?.name || '',
        home_team_logo: teams?.home?.logo || null,
        away_team_logo: teams?.away?.logo || null,
        home_goals: goals?.home ?? null,
        away_goals: goals?.away ?? null,
        league_id: String(league?.id || ''),
        league_name: league?.name || '',
        league_logo: league?.logo || null,
        api_league_id: league?.id || 0,
        country_name: league?.country || null,
        venue_name: f.venue?.name || null,
        venue_city: f.venue?.city || null,
        updated_at: new Date().toISOString(),
      }, { merge: true });

      await batch.commit();
      saved++;
      console.log(`✅ Saved fixture ${f.id} (${teams?.home?.name} vs ${teams?.away?.name}) — ${oddsCount} odds`);
    } else {
      console.log(`❌ Skipped fixture ${f.id} (${teams?.home?.name} vs ${teams?.away?.name}) — no odds`);
    }

    // Stop early once we have 20 good matches
    if (saved >= 20) {
      console.log('\nReached 20 saved matches, stopping.');
      break;
    }
  }

  console.log(`\nDone! Saved ${saved} matches with odds to Firebase.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
