import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/** Build a day-bucketed meta object for the dropdown */
function buildMeta(fixtures: any[]) {
  const now = new Date();

  // Create day buckets for next 7 days
  const dayBuckets: { id: string; label: string; date: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const id = i === 0 ? 'today' : i === 1 ? 'tomorrow' : `date:${dateStr}`;
    dayBuckets.push({ id, label: id, date: dateStr });
  }

  // Count fixtures per day bucket
  const dayCounts = new Map<string, number>();
  let total = 0;

  for (const f of fixtures) {
    const matchDate = f.match_date || f.kickoff_at || '';
    if (!matchDate) continue;
    const fixtureDate = matchDate.split('T')[0]; // YYYY-MM-DD
    for (const bucket of dayBuckets) {
      if (fixtureDate === bucket.date) {
        dayCounts.set(bucket.id, (dayCounts.get(bucket.id) || 0) + 1);
        break;
      }
    }
    total++;
  }

  // Build days array - only include days that have matches, always include 'all'
  const days = [
    { id: 'all', count: total },
    ...dayBuckets
      .filter((b) => (dayCounts.get(b.id) || 0) > 0)
      .map((b) => ({ id: b.id, count: dayCounts.get(b.id) || 0 })),
  ];

  // Build countries
  const countriesMap = new Map<string, { name: string; count: number; flag_url: string | null }>();
  for (const f of fixtures) {
    const c = f.country_name || 'International';
    if (!countriesMap.has(c)) {
      countriesMap.set(c, { name: c, count: 0, flag_url: f.flag_url || null });
    }
    countriesMap.get(c)!.count++;
  }
  const countries = [
    { name: 'All countries', count: total, flag_url: null },
    ...Array.from(countriesMap.values()).sort((a, b) => b.count - a.count),
  ];

  return { total, days, countries };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const now = new Date();
    // Show fixtures from 2 hours ago onwards (to catch live matches that started)
    const cutoffDate = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    // Show up to 7 days ahead
    const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: fixturesRows, error } = await supabaseAdmin
      .from('fixtures')
      .select('*')
      .gte('match_date', cutoffDate)
      .lte('match_date', maxDate)
      .order('match_date', { ascending: true })
      .limit(limit);

    if (error) throw error;

    const fixtures = fixturesRows || [];

    // Build odds map: first try inline home/draw/away odds on the fixture row
    const odds: Record<string, any[]> = {};
    fixtures.forEach((f: any) => {
      if (f.home_odds || f.draw_odds || f.away_odds) {
        const fid = String(f.id);
        const items = [
          { fixture_id: f.id, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Home', odd_value: f.home_odds || null },
          { fixture_id: f.id, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Draw', odd_value: f.draw_odds || null },
          { fixture_id: f.id, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Away', odd_value: f.away_odds || null },
        ].filter((o) => o.odd_value !== null);
        if (items.length) odds[fid] = items;
      }
    });

    // Fetch odds from DB (handles both compact JSONB and legacy per-row formats)
    if (fixtures.length > 0) {
      const fixtureIds = fixtures.map((f: any) => f.id);
      const { data: oddsRows } = await supabaseAdmin
        .from('odds')
        .select('fixture_id, market_name, market_key, selection, odd_value, markets')
        .in('fixture_id', fixtureIds.slice(0, 500));

      if (oddsRows && oddsRows.length > 0) {
        // For home page we only need Match Winner (1X2) odds to show on cards
        const MW_KEYS = ['match_winner', 'home_away', '1x2'];
        const MW_NAMES = ['match winner', 'home/away', 'full time result', '1x2'];

        for (const row of oddsRows) {
          const fid = String(row.fixture_id);
          if (!odds[fid]) odds[fid] = [];

          // Compact format: one row with all markets in flat_markets
          if (row.market_key === 'all_markets' && row.markets?.flat_markets) {
            const flatMarkets: any[] = row.markets.flat_markets;
            // Find the match winner market
            const mwMarket = flatMarkets.find((m: any) =>
              MW_KEYS.includes(m.market_key) ||
              MW_NAMES.includes((m.market_name || '').toLowerCase())
            );
            if (mwMarket) {
              for (const val of mwMarket.values || []) {
                if (!val.odd || val.odd <= 0) continue;
                const selLower = (val.selection || '').toLowerCase();
                const exists = odds[fid].some((x: any) => (x.selection || '').toLowerCase() === selLower);
                if (!exists) {
                  odds[fid].push({
                    fixture_id: row.fixture_id,
                    market_name: mwMarket.market_name,
                    market_key: mwMarket.market_key,
                    selection: val.selection,
                    odd_value: val.odd,
                  });
                }
              }
            }
            continue;
          }

          // Legacy per-row format: only include match winner rows
          const mk = (row.market_key || '').toLowerCase();
          const mn = (row.market_name || '').toLowerCase();
          const isMW = MW_KEYS.some(k => mk.includes(k)) || MW_NAMES.some(n => mn.includes(n));
          if (!isMW || !row.odd_value || row.odd_value <= 0 || !row.selection) continue;

          const selLower = (row.selection || '').toLowerCase();
          const exists = odds[fid].some((x: any) => (x.selection || '').toLowerCase() === selLower);
          if (!exists) {
            odds[fid].push({
              fixture_id: row.fixture_id,
              market_name: row.market_name,
              market_key: row.market_key,
              selection: row.selection,
              odd_value: row.odd_value,
            });
          }
        }
      }
    }

    // Top leagues
    const { data: topLeaguesRows } = await supabaseAdmin
      .from('leagues')
      .select('*')
      .eq('is_top', true)
      .limit(15);

    const topLeagues = (topLeaguesRows || []).sort(
      (a: any, b: any) => (a.top_rank ?? 999) - (b.top_rank ?? 999)
    );

    const meta = buildMeta(fixtures);

    return NextResponse.json({ fixtures, odds, meta, topLeagues });
  } catch (err: any) {
    console.error('[fixtures/bootstrap]', err);
    return NextResponse.json({
      fixtures: [],
      odds: {},
      meta: { total: 0, days: [], countries: [] },
      topLeagues: [],
    });
  }
}

export const dynamic = 'force-dynamic';
