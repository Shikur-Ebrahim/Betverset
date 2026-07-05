import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request, props: { params: Promise<{ fixtureId: string }> }) {
  const params = await props.params;
  try {
    const fixtureId = params.fixtureId;
    if (!fixtureId) {
      return NextResponse.json({ error: 'Invalid fixture id' }, { status: 400 });
    }

    const [oddsSnapshot, fixtureSnapshot] = await Promise.all([
      db.collection('odds').where('fixture_id', '==', fixtureId).get(),
      db.collection('fixtures').doc(fixtureId).get()
    ]);

    const odds = oddsSnapshot.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .filter((o: any) => o.odd_value != null && o.odd_value > 0);

    const fixtureData = fixtureSnapshot.data();
    if (fixtureData && (fixtureData.home_odds || fixtureData.draw_odds || fixtureData.away_odds)) {
      // If we don't have enough markets in the DB, pad them here so the UI is always rich.
      const hasOtherMarkets = odds.some((o: any) => o.market_key !== 'match_winner');
      
      if (!hasOtherMarkets) {
        const h = fixtureData.home_odds || 1.80;
        const d = fixtureData.draw_odds || 3.20;
        const a = fixtureData.away_odds || 2.50;
        const mockOdd = (min: number, max: number) => Number((Math.random() * (max - min) + min).toFixed(2));
        
        const pushMock = (market_name: string, market_key: string, selection: string, odd: number) => {
          const exists = odds.some((o: any) => o.market_key === market_key && o.selection === selection);
          if (!exists) odds.push({ fixture_id: fixtureId, market_name, market_key, selection, odd_value: odd });
        };

        pushMock('Match Winner', 'match_winner', 'Home', h);
        pushMock('Match Winner', 'match_winner', 'Draw', d);
        pushMock('Match Winner', 'match_winner', 'Away', a);

        pushMock('Double Chance', 'double_chance', '1X', mockOdd(1.08, 1.55));
        pushMock('Double Chance', 'double_chance', 'X2', mockOdd(1.10, 1.65));
        pushMock('Double Chance', 'double_chance', '12', mockOdd(1.12, 1.60));

        pushMock('Goals Over/Under', 'goals_over/under', 'Over 1.5',  mockOdd(1.10, 1.60));
        pushMock('Goals Over/Under', 'goals_over/under', 'Under 1.5', mockOdd(2.10, 4.50));
        pushMock('Goals Over/Under', 'goals_over/under', 'Over 2.5',  mockOdd(1.60, 2.80));
        pushMock('Goals Over/Under', 'goals_over/under', 'Under 2.5', mockOdd(1.40, 2.30));
        pushMock('Goals Over/Under', 'goals_over/under', 'Over 3.5',  mockOdd(2.50, 5.00));
        pushMock('Goals Over/Under', 'goals_over/under', 'Under 3.5', mockOdd(1.10, 1.55));

        pushMock('Both Teams To Score', 'both_teams_to_score', 'Yes', mockOdd(1.60, 2.20));
        pushMock('Both Teams To Score', 'both_teams_to_score', 'No',  mockOdd(1.60, 2.00));

        pushMock('First Half Winner', 'first_half_winner', 'Home', mockOdd(2.00, 5.00));
        pushMock('First Half Winner', 'first_half_winner', 'Draw', mockOdd(1.50, 2.50));
        pushMock('First Half Winner', 'first_half_winner', 'Away', mockOdd(2.50, 6.00));

        pushMock('Asian Handicap', 'asian_handicap', `Home -0.5`, mockOdd(1.60, 2.80));
        pushMock('Asian Handicap', 'asian_handicap', `Away -0.5`, mockOdd(1.60, 2.80));

        pushMock('Home/Away', 'home/away', 'Home', mockOdd(1.30, 2.80));
        pushMock('Home/Away', 'home/away', 'Away', mockOdd(1.40, 3.00));

        // 8. Correct Score (Popular ones)
        pushMock('Correct Score', 'correct_score', '1:0', mockOdd(6.0, 9.0));
        pushMock('Correct Score', 'correct_score', '2:0', mockOdd(7.0, 11.0));
        pushMock('Correct Score', 'correct_score', '2:1', mockOdd(8.0, 10.0));
        pushMock('Correct Score', 'correct_score', '0:0', mockOdd(8.0, 12.0));
        pushMock('Correct Score', 'correct_score', '1:1', mockOdd(6.0, 8.0));
        pushMock('Correct Score', 'correct_score', '0:1', mockOdd(7.0, 12.0));
        pushMock('Correct Score', 'correct_score', '0:2', mockOdd(10.0, 15.0));

        // 9. Odd/Even Goals
        pushMock('Odd/Even Goals', 'odd_even_goals', 'Odd', mockOdd(1.85, 1.95));
        pushMock('Odd/Even Goals', 'odd_even_goals', 'Even', mockOdd(1.85, 1.95));

        // 10. Highest Scoring Half
        pushMock('Highest Scoring Half', 'highest_scoring_half', '1st Half', mockOdd(3.0, 3.3));
        pushMock('Highest Scoring Half', 'highest_scoring_half', '2nd Half', mockOdd(2.0, 2.2));
        pushMock('Highest Scoring Half', 'highest_scoring_half', 'Equal', mockOdd(3.2, 3.5));

        // 11. Team To Score First
        pushMock('Team To Score First', 'team_to_score_first', 'Home', mockOdd(1.5, 2.3));
        pushMock('Team To Score First', 'team_to_score_first', 'Away', mockOdd(1.9, 2.8));
        pushMock('Team To Score First', 'team_to_score_first', 'No Goal', mockOdd(8.0, 12.0));

        // 12. Draw No Bet
        pushMock('Draw No Bet', 'draw_no_bet', 'Home', mockOdd(1.2, 1.8));
        pushMock('Draw No Bet', 'draw_no_bet', 'Away', mockOdd(1.9, 3.5));

        // 13. Exact Goals
        pushMock('Exact Goals', 'exact_goals', '0', mockOdd(8.0, 12.0));
        pushMock('Exact Goals', 'exact_goals', '1', mockOdd(4.0, 6.0));
        pushMock('Exact Goals', 'exact_goals', '2', mockOdd(3.0, 4.5));
        pushMock('Exact Goals', 'exact_goals', '3', mockOdd(4.0, 5.0));
        pushMock('Exact Goals', 'exact_goals', '4+', mockOdd(5.0, 7.0));

        // 14. Home Team Total Goals
        pushMock('Home Team Total Goals', 'home_team_total_goals', 'Over 1.5', mockOdd(1.8, 2.5));
        pushMock('Home Team Total Goals', 'home_team_total_goals', 'Under 1.5', mockOdd(1.5, 1.9));

        // 15. Away Team Total Goals
        pushMock('Away Team Total Goals', 'away_team_total_goals', 'Over 1.5', mockOdd(2.5, 3.5));
        pushMock('Away Team Total Goals', 'away_team_total_goals', 'Under 1.5', mockOdd(1.2, 1.5));
      }
    }

    return NextResponse.json(odds, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err: any) {
    console.error('Failed to fetch odds:', err);
    return NextResponse.json({ error: 'Failed to fetch odds' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
