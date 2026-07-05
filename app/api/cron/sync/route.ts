import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { apiFetch } from '@/lib/services/apiFootball';

const CRON_SECRET = process.env.CRON_SECRET || '';

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization');
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;
  if (!CRON_SECRET) return true;
  return false;
}

const mockOdd = (min: number, max: number) =>
  Number((Math.random() * (max - min) + min).toFixed(2));

/** Commit a list of {ref, data, merge} docs in batches of 400 */
async function commitDocs(docs: Array<{ ref: any; data: any; merge?: boolean }>) {
  const BATCH_SIZE = 400;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const slice = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const { ref, data, merge } of slice) {
      batch.set(ref, data, merge ? { merge: true } : {});
    }
    await batch.commit();
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

    console.log(`[sync] Starting multi-day sync for ${d1} and ${d2}`);

    // 1. Fetch fixtures for today + tomorrow in parallel (2 API calls)
    const [fixturesDay1, fixturesDay2] = await Promise.all([
      apiFetch('/fixtures', { date: d1 }),
      apiFetch('/fixtures', { date: d2 }),
    ]);
    const fixturesPage = [...fixturesDay1, ...fixturesDay2];

    // 2. Fetch odds for today + tomorrow — page 1 only (2 API calls, fast & avoids timeout)
    let allOdds: any[] = [];
    let isMockOdds = false;
    try {
      const [oddsToday, oddsTomorrow] = await Promise.all([
        apiFetch('/odds', { date: d1, page: 1 }),
        apiFetch('/odds', { date: d2, page: 1 }),
      ]);
      allOdds = [...(oddsToday || []), ...(oddsTomorrow || [])];
      
    } catch (err: any) {
      console.log(`[sync] Odds fetch failed (${err.message}). Using mock odds.`);
      isMockOdds = true;
    }

    if (allOdds.length === 0) {
      console.log('[sync] No real odds — using mock odds.');
      isMockOdds = true;
    }

    console.log(`[sync] Got ${fixturesPage.length} fixtures, ${allOdds.length} odds items.`);

    // 3. Build a lookup map: fixture ID → full fixture object
    const fixtureInfoMap = new Map<number, any>();
    for (const f of fixturesPage) {
      if (f?.fixture?.id) fixtureInfoMap.set(f.fixture.id, f);
    }

    // 4. Collect all docs in memory before writing — avoids sequential commits
    const fixtureDocs: Array<{ ref: FirebaseFirestore.DocumentReference; data: any; merge: boolean }> = [];
    const oddsDocs: Array<{ ref: FirebaseFirestore.DocumentReference; data: any; merge: boolean }> = [];

    const processedFixtureIds = new Set<number>();
    let fixturesStored = 0;

    // 4a. Process real odds items
    if (!isMockOdds) {
      for (const item of allOdds) {
        const fixture = item?.fixture;
        const league = item?.league;
        const bookmakers: any[] = item?.bookmakers ?? [];

        if (!fixture?.id || bookmakers.length === 0) continue;

        // Extract Match Winner (Bet ID 1) odds for the fixture summary card
        let homeOdd: number | null = null;
        let drawOdd: number | null = null;
        let awayOdd: number | null = null;
        outer: for (const bm of bookmakers) {
          for (const bet of bm?.bets ?? []) {
            if (bet?.id !== 1 && !bet?.name?.toLowerCase().includes('match winner')) continue;
            for (const v of bet?.values ?? []) {
              if (v.value === 'Home' && !homeOdd) homeOdd = parseFloat(v.odd) || null;
              if (v.value === 'Draw' && !drawOdd) drawOdd = parseFloat(v.odd) || null;
              if (v.value === 'Away' && !awayOdd) awayOdd = parseFloat(v.odd) || null;
            }
            if (homeOdd && drawOdd && awayOdd) break outer;
          }
        }

        const full = fixtureInfoMap.get(fixture.id);
        const f = full?.fixture || fixture;
        const teams = full?.teams;
        const l = full?.league || league;

        // Fixture summary doc
        fixtureDocs.push({
          ref: db.collection('fixtures').doc(String(fixture.id)),
          data: {
            api_fixture_id: fixture.id,
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
            home_goals: null,
            away_goals: null,
            league_id: String(l?.id || ''),
            league_name: l?.name || '',
            league_logo: l?.logo || null,
            api_league_id: l?.id || 0,
            country_name: l?.country || null,
            venue_name: f.venue?.name || null,
            venue_city: f.venue?.city || null,
            home_odds: homeOdd,
            draw_odds: drawOdd,
            away_odds: awayOdd,
            bookmakers_count: bookmakers.length,
            has_odds: true,
            updated_at: new Date().toISOString(),
          },
          merge: true,
        });

        // Collect best odds per market+selection (deduplicate across bookmakers)
        // Key: `fixtureId_marketId_selection` → best odd value
        const bestOddsMap = new Map<string, { marketName: string; marketKey: string; selection: string; odd: number }>();
        for (const bm of bookmakers) {
          if (!bm?.id) continue;
          for (const bet of bm?.bets ?? []) {
            for (const value of bet?.values ?? []) {
              const odd = parseFloat(value.odd) || 0;
              if (!odd) continue;
              const key = `${fixture.id}_${bet.id}_${value.value}`.replace(/\s+/g, '_');
              const existing = bestOddsMap.get(key);
              // Keep the highest available odd (best price for user)
              if (!existing || odd > existing.odd) {
                bestOddsMap.set(key, {
                  marketName: bet.name || '',
                  marketKey: bet.name?.toLowerCase().replace(/\s+/g, '_') || '',
                  selection: value.value || '',
                  odd,
                });
              }
            }
          }
        }
        // Write one doc per unique market+selection
        for (const [key, { marketName, marketKey, selection, odd }] of bestOddsMap) {
          oddsDocs.push({
            ref: db.collection('odds').doc(key),
            data: {
              fixture_id: String(fixture.id),
              bookmaker_id: 'best',
              bookmaker_name: 'Best Available',
              market_id: key.split('_')[2] || '',
              market_name: marketName,
              market_key: marketKey,
              selection,
              odd_value: odd,
              last_update: new Date().toISOString(),
            },
            merge: true,
          });
        }

        processedFixtureIds.add(fixture.id);
        fixturesStored++;
      }
    }

    // 4b. Pad with mock-odds fixtures up to 100
    for (const item of fixturesPage) {
      if (fixturesStored >= 100) break;
      const f = item?.fixture;
      const teams = item?.teams;
      const l = item?.league;
      if (!f?.id || processedFixtureIds.has(f.id)) continue;

      const hOdd = mockOdd(1.20, 4.50);
      const dOdd = mockOdd(2.80, 4.00);
      const aOdd = mockOdd(1.50, 6.00);

      fixtureDocs.push({
        ref: db.collection('fixtures').doc(String(f.id)),
        data: {
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
          home_goals: null,
          away_goals: null,
          league_id: String(l?.id || ''),
          league_name: l?.name || '',
          league_logo: l?.logo || null,
          api_league_id: l?.id || 0,
          country_name: l?.country || null,
          venue_name: f.venue?.name || null,
          venue_city: f.venue?.city || null,
          home_odds: hOdd,
          draw_odds: dOdd,
          away_odds: aOdd,
          bookmakers_count: 1,
          has_odds: true,
          updated_at: new Date().toISOString(),
        },
        merge: true,
      });

      // Add mock Match Winner rows to the odds collection too
      for (const [sel, oddVal] of [['Home', hOdd], ['Draw', dOdd], ['Away', aOdd]] as const) {
        oddsDocs.push({
          ref: db.collection('odds').doc(`${f.id}_mock_1_${sel}`),
          data: {
            fixture_id: String(f.id),
            bookmaker_id: 'mock',
            bookmaker_name: 'Mock',
            market_id: '1',
            market_name: 'Match Winner',
            market_key: 'match_winner',
            selection: sel,
            odd_value: oddVal,
            last_update: new Date().toISOString(),
          },
          merge: true,
        });
      }

      processedFixtureIds.add(f.id);
      fixturesStored++;
    }

    // 5. Write everything in batches of 400 (no sequential per-fixture commits)
    console.log(`[sync] Writing ${fixtureDocs.length} fixture docs and ${oddsDocs.length} odds docs...`);
    await Promise.all([
      commitDocs(fixtureDocs),
      commitDocs(oddsDocs),
    ]);

    console.log(`[sync] Done. ${fixturesStored} fixtures stored.`);
    return NextResponse.json({ ok: true, fixturesStored, oddsDocsWritten: oddsDocs.length });
  } catch (err: any) {
    console.error('[sync] Failed:', err);
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}

export const dynamic = 'force-dynamic';
