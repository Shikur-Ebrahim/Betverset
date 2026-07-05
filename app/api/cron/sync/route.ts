import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { apiFetch } from '@/lib/services/apiFootball';

const CRON_SECRET = process.env.CRON_SECRET || '';

// All bet markets are saved — no filter (saves every market the API returns)
// Cap total odds docs to 3000 to prevent Vercel timeout
const MAX_ODDS_DOCS = 3000;

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization');
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;
  if (!CRON_SECRET) return true;
  return false;
}

const mockOdd = (min: number, max: number) =>
  Number((Math.random() * (max - min) + min).toFixed(2));

/** Commit an array of {ref, data} in Firestore batches of 400 */
async function batchWrite(docs: Array<{ ref: any; data: any }>) {
  const SIZE = 400;
  for (let i = 0; i < docs.length; i += SIZE) {
    const b = db.batch();
    for (const { ref, data } of docs.slice(i, i + SIZE)) {
      b.set(ref, data, { merge: true });
    }
    await b.commit();
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const d1 = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const d2 = tomorrow.toISOString().split('T')[0];

    console.log(`[sync] Starting for ${d1} / ${d2}`);

    // Fetch today + tomorrow fixtures AND today + tomorrow odds in parallel (4 API calls)
    const [fixturesDay1, fixturesDay2, oddsDay1Raw, oddsDay2Raw] = await Promise.allSettled([
      apiFetch('/fixtures', { date: d1 }),
      apiFetch('/fixtures', { date: d2 }),
      apiFetch('/odds', { date: d1, page: 1 }),
      apiFetch('/odds', { date: d2, page: 1 }),
    ]);

    const fixturesDay1Data = fixturesDay1.status === 'fulfilled' ? fixturesDay1.value : [];
    const fixturesDay2Data = fixturesDay2.status === 'fulfilled' ? fixturesDay2.value : [];
    const oddsDay1 = oddsDay1Raw.status === 'fulfilled' ? (oddsDay1Raw.value ?? []) : [];
    const oddsDay2 = oddsDay2Raw.status === 'fulfilled' ? (oddsDay2Raw.value ?? []) : [];

    const allFixtures = [...fixturesDay1Data, ...fixturesDay2Data];
    const allOdds = [...oddsDay1, ...oddsDay2];

    console.log(`[sync] ${allFixtures.length} fixtures, ${allOdds.length} odds items`);

    // Build fixture lookup map
    const fixtureMap = new Map<number, any>();
    for (const f of allFixtures) {
      if (f?.fixture?.id) fixtureMap.set(f.fixture.id, f);
    }

    // Build docs arrays in memory
    const fixtureDocs: Array<{ ref: any; data: any }> = [];
    const oddsDocs: Array<{ ref: any; data: any }> = [];
    const processedIds = new Set<number>();

    // Process real odds (keep best price per market+selection, key markets only)
    for (const item of allOdds) {
      const fid = item?.fixture?.id;
      if (!fid) continue;

      const bookmakers: any[] = item?.bookmakers ?? [];
      const full = fixtureMap.get(fid);
      const fx = full?.fixture || item?.fixture;
      const teams = full?.teams;
      const league = full?.league || item?.league;

      // Extract Match Winner for the summary card
      let homeOdd: number | null = null, drawOdd: number | null = null, awayOdd: number | null = null;

      // Best price map: `betId_selection` → best odd
      const bestMap = new Map<string, { betName: string; betKey: string; selection: string; odd: number }>();

      for (const bm of bookmakers) {
        for (const bet of bm?.bets ?? []) {
          // Save ALL markets (no filter)
          for (const v of bet?.values ?? []) {
            const odd = parseFloat(v.odd) || 0;
            if (!odd) continue;
            // Track Match Winner for fixture summary
            if (bet.id === 1) {
              if (v.value === 'Home' && (!homeOdd || odd > homeOdd)) homeOdd = odd;
              if (v.value === 'Draw' && (!drawOdd || odd > drawOdd)) drawOdd = odd;
              if (v.value === 'Away' && (!awayOdd || odd > awayOdd)) awayOdd = odd;
            }
            // Sanitize key (replace spaces with _, and / with -)
            const key = `${bet.id}_${v.value}`.replace(/\s+/g, '_').replace(/\//g, '-');
            const existing = bestMap.get(key);
            if (!existing || odd > existing.odd) {
              bestMap.set(key, {
                betName: bet.name || '',
                betKey: (bet.name || '').toLowerCase().replace(/\s+/g, '_'),
                selection: v.value || '',
                odd,
              });
            }
          }
        }
      }

      fixtureDocs.push({
        ref: db.collection('fixtures').doc(String(fid)),
        data: {
          api_fixture_id: fid,
          match_date: fx?.date || null,
          status: fx?.status?.short || 'NS',
          elapsed: fx?.status?.elapsed || null,
          referee: fx?.referee || null,
          home_team_id: String(teams?.home?.id || ''),
          away_team_id: String(teams?.away?.id || ''),
          home_team_name: teams?.home?.name || '',
          away_team_name: teams?.away?.name || '',
          home_team_logo: teams?.home?.logo || null,
          away_team_logo: teams?.away?.logo || null,
          home_goals: null,
          away_goals: null,
          league_id: String(league?.id || ''),
          league_name: league?.name || '',
          league_logo: league?.logo || null,
          api_league_id: league?.id || 0,
          country_name: league?.country || null,
          venue_name: fx?.venue?.name || null,
          venue_city: fx?.venue?.city || null,
          home_odds: homeOdd,
          draw_odds: drawOdd,
          away_odds: awayOdd,
          bookmakers_count: bookmakers.length,
          has_odds: true,
          updated_at: new Date().toISOString(),
        },
      });

      // Write one odds doc per unique market+selection (best price), cap total
      for (const [mapKey, { betName, betKey, selection, odd }] of bestMap) {
        if (oddsDocs.length >= MAX_ODDS_DOCS) break;
        oddsDocs.push({
          ref: db.collection('odds').doc(`${fid}_${mapKey}`),
          data: {
            fixture_id: String(fid),
            bookmaker_id: 'best',
            bookmaker_name: 'Best Available',
            market_name: betName,
            market_key: betKey,
            selection,
            odd_value: odd,
            last_update: new Date().toISOString(),
          },
        });
      }

      processedIds.add(fid);
    }

    const realOddsCount = fixtureDocs.length;

    // Pad with mock-odds fixtures so the site always shows 50+ matches
    for (const item of allFixtures) {
      if (fixtureDocs.length >= 80) break;
      const fx = item?.fixture;
      const teams = item?.teams;
      const l = item?.league;
      if (!fx?.id || processedIds.has(fx.id)) continue;

      const h = mockOdd(1.30, 4.20);
      const d = mockOdd(2.80, 3.90);
      const a = mockOdd(1.40, 5.50);

      fixtureDocs.push({
        ref: db.collection('fixtures').doc(String(fx.id)),
        data: {
          api_fixture_id: fx.id,
          match_date: fx?.date || null,
          status: fx?.status?.short || 'NS',
          elapsed: fx?.status?.elapsed || null,
          referee: fx?.referee || null,
          home_team_id: String(teams?.home?.id || ''),
          away_team_id: String(teams?.away?.id || ''),
          home_team_name: teams?.home?.name || '',
          away_team_name: teams?.away?.name || '',
          home_team_logo: teams?.home?.logo || null,
          away_team_logo: teams?.away?.logo || null,
          home_goals: null,
          away_goals: null,
          league_id: String(l?.id || ''),
          league_name: l?.name || '',
          league_logo: l?.logo || null,
          api_league_id: l?.id || 0,
          country_name: l?.country || null,
          venue_name: fx?.venue?.name || null,
          venue_city: fx?.venue?.city || null,
          home_odds: h,
          draw_odds: d,
          away_odds: a,
          bookmakers_count: 1,
          has_odds: true,
          updated_at: new Date().toISOString(),
        },
      });

      // --- Mock odds: 7 standard markets ---
      const pushMock = (docKey: string, market_name: string, market_key: string, selection: string, odd: number) => {
        oddsDocs.push({
          ref: db.collection('odds').doc(`${fx.id}_${docKey}`),
          data: { fixture_id: String(fx.id), bookmaker_id: 'mock', bookmaker_name: 'Mock',
            market_name, market_key, selection, odd_value: odd, last_update: new Date().toISOString() },
        });
      };

      // 1. Match Winner
      pushMock('1_Home', 'Match Winner', 'match_winner', 'Home', h);
      pushMock('1_Draw', 'Match Winner', 'match_winner', 'Draw', d);
      pushMock('1_Away', 'Match Winner', 'match_winner', 'Away', a);

      // 2. Double Chance
      pushMock('3_1X', 'Double Chance', 'double_chance', '1X', mockOdd(1.08, 1.55));
      pushMock('3_X2', 'Double Chance', 'double_chance', 'X2', mockOdd(1.10, 1.65));
      pushMock('3_12', 'Double Chance', 'double_chance', '12', mockOdd(1.12, 1.60));

      // 3. Goals Over/Under
      pushMock('5_over1.5',  'Goals Over/Under', 'goals_over/under', 'Over 1.5',  mockOdd(1.10, 1.60));
      pushMock('5_under1.5', 'Goals Over/Under', 'goals_over/under', 'Under 1.5', mockOdd(2.10, 4.50));
      pushMock('5_over2.5',  'Goals Over/Under', 'goals_over/under', 'Over 2.5',  mockOdd(1.60, 2.80));
      pushMock('5_under2.5', 'Goals Over/Under', 'goals_over/under', 'Under 2.5', mockOdd(1.40, 2.30));
      pushMock('5_over3.5',  'Goals Over/Under', 'goals_over/under', 'Over 3.5',  mockOdd(2.50, 5.00));
      pushMock('5_under3.5', 'Goals Over/Under', 'goals_over/under', 'Under 3.5', mockOdd(1.10, 1.55));

      // 4. Both Teams To Score
      pushMock('8_Yes', 'Both Teams To Score', 'both_teams_to_score', 'Yes', mockOdd(1.60, 2.20));
      pushMock('8_No',  'Both Teams To Score', 'both_teams_to_score', 'No',  mockOdd(1.60, 2.00));

      // 5. First Half Winner
      pushMock('13_Home', 'First Half Winner', 'first_half_winner', 'Home', mockOdd(2.00, 5.00));
      pushMock('13_Draw', 'First Half Winner', 'first_half_winner', 'Draw', mockOdd(1.50, 2.50));
      pushMock('13_Away', 'First Half Winner', 'first_half_winner', 'Away', mockOdd(2.50, 6.00));

      // 6. Asian Handicap -0.5
      pushMock('35_home_-0.5', 'Asian Handicap', 'asian_handicap', `Home -0.5`, mockOdd(1.60, 2.80));
      pushMock('35_away_-0.5', 'Asian Handicap', 'asian_handicap', `Away -0.5`, mockOdd(1.60, 2.80));

      // 7. Home/Away (2-way, no draw)
      pushMock('2_Home', 'Home/Away', 'home/away', 'Home', mockOdd(1.30, 2.80));
      pushMock('2_Away', 'Home/Away', 'home/away', 'Away', mockOdd(1.40, 3.00));

      processedIds.add(fx.id);
    }

    console.log(`[sync] Writing ${fixtureDocs.length} fixtures, ${oddsDocs.length} odds docs...`);

    // Write everything — batchWrite handles auto-chunking into 400-doc batches
    await batchWrite(fixtureDocs);
    await batchWrite(oddsDocs);

    const fixturesStored = fixtureDocs.length;
    console.log(`[sync] Done. ${fixturesStored} fixtures (${realOddsCount} with real odds), ${oddsDocs.length} odds docs.`);

    return NextResponse.json({
      ok: true,
      fixturesStored,
      withRealOdds: realOddsCount,
      oddsDocsWritten: oddsDocs.length,
    });
  } catch (err: any) {
    console.error('[sync] Failed:', err);
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}

export const dynamic = 'force-dynamic';
