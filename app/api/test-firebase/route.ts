import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { apiFetch } from '@/lib/services/apiFootball';

export async function GET() {
  const steps: string[] = [];
  try {
    steps.push('START');

    // Step 1: Fetch fixtures today
    const today = new Date().toISOString().split('T')[0];
    steps.push(`Fetching fixtures for ${today}...`);
    const fixtures = await apiFetch('/fixtures', { date: today });
    steps.push(`Got ${fixtures.length} fixtures`);

    // Step 2: Fetch odds page 1 today
    steps.push('Fetching odds page 1...');
    let odds: any[] = [];
    try {
      odds = await apiFetch('/odds', { date: today, page: 1 });
      steps.push(`Got ${odds.length} odds items`);
    } catch (e: any) {
      steps.push(`Odds failed: ${e.message}`);
    }

    // Step 3: Write 1 test fixture doc
    steps.push('Writing 1 test fixture to Firestore...');
    if (fixtures.length > 0) {
      const f = fixtures[0];
      await db.collection('fixtures').doc(String(f.fixture.id)).set({
        test: true,
        home_team_name: f.teams?.home?.name || 'test',
        match_date: f.fixture?.date || null,
        updated_at: new Date().toISOString(),
      }, { merge: true });
      steps.push('Firestore write OK');
    }

    // Step 4: Write 1 test odds doc
    steps.push('Writing 1 test odds doc...');
    if (odds.length > 0) {
      const bms = odds[0]?.bookmakers ?? [];
      const firstBet = bms[0]?.bets?.[0]?.values?.[0];
      if (firstBet) {
        await db.collection('odds').doc('test_doc').set({
          test: true,
          selection: firstBet.value,
          odd_value: parseFloat(firstBet.odd),
          updated_at: new Date().toISOString(),
        }, { merge: true });
        steps.push('Odds Firestore write OK');
      } else {
        steps.push('No bookmaker data found in odds');
      }
    }

    steps.push('ALL STEPS DONE');
    return NextResponse.json({ ok: true, steps });
  } catch (err: any) {
    return NextResponse.json({ ok: false, steps, error: err.message, stack: err.stack?.slice(0, 500) });
  }
}

export const dynamic = 'force-dynamic';
