import Link from 'next/link';
import { api, Fixture, LiveMatch, League, Odd } from '../../lib/api';
import { isMatchClosedForBetting } from '../../lib/match-status';
import { getMatchWinnerDisplayOdds } from '../../lib/match-odds-display';

export const dynamic = 'force-dynamic';

function formatMatchDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getLiveBadge(match: LiveMatch) {
  if (isMatchClosedForBetting({ status: match.status, minute: match.minute })) {
    return 'FT';
  }
  if (match.minute) {
    return `${match.status || 'LIVE'} ${match.minute}'`;
  }

  return match.status || 'LIVE';
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function getSelectionLabel(selection: string, fixture: Fixture) {
  const sel = selection.toLowerCase();
  if (sel === 'home' || sel === '1') return '1';
  if (sel === 'draw' || sel === 'x') return 'X';
  if (sel === 'away' || sel === '2') return '2';
  return selection;
}

async function safeLoad<T>(loader: () => Promise<T>, fallback: T) {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

async function loadMatchesPageData() {
  const [bootstrap, liveMatches, topLeagues] = await Promise.all([
    safeLoad(() => api.getHomeBootstrap(), {
      fixtures: [] as Fixture[],
      odds: {} as Record<number, Odd[]>,
      meta: null,
      topLeagues: [] as League[],
    }),
    safeLoad(() => api.getLiveMatches(), [] as LiveMatch[]),
    safeLoad(() => api.getTopLeagues(), [] as League[]),
  ]);

  const liveFixtureIds = new Set(liveMatches.map((match) => match.fixture_id));

  return {
    fixtures: bootstrap.fixtures,
    oddsMap: bootstrap.odds,
    liveMatches,
    topLeagues: topLeagues.slice(0, 6),
    liveFixtureIds,
    metaTotal: bootstrap.meta?.total ?? bootstrap.fixtures.length,
  };
}

export default async function MatchesPage() {
  const { fixtures, oddsMap, liveMatches, topLeagues, liveFixtureIds, metaTotal } =
    await loadMatchesPageData();

  return (
    <div className="site-shell">
      <header className="site-header sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--site-primary)' }}>Betvers</p>
            <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Match cards</h1>
          </div>
          <Link href="/" className="site-outline-btn rounded-full px-4 py-2 text-sm font-medium">
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="site-soft-card site-glow-card rounded-[1.9rem] p-5">
            <p className="site-muted text-sm">Saved upcoming games</p>
            <p className="mt-3 text-3xl font-bold text-white">{metaTotal}</p>
            <p className="site-muted mt-2 text-sm">Up to 50 matches per day for the next 7 days (350 max).</p>
          </div>
          <div className="site-soft-card rounded-[1.9rem] p-5">
            <p className="site-muted text-sm">Live games</p>
            <p className="mt-3 text-3xl font-bold" style={{ color: 'var(--site-primary)' }}>{liveMatches.length}</p>
            <p className="site-muted mt-2 text-sm">Updated automatically from the saved database flow.</p>
          </div>
          <div className="site-soft-card rounded-[1.9rem] p-5">
            <p className="site-muted text-sm">Top synced leagues</p>
            <p className="mt-3 text-3xl font-bold text-white">{topLeagues.length}</p>
            <p className="site-muted mt-2 text-sm">Only matches with saved odds are shown here.</p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="site-accent-line mb-4" />
              <h2 className="site-section-title text-lg font-semibold sm:text-2xl">Upcoming football cards</h2>
              <p className="site-muted mt-1 text-sm">Tap a card to open the full match detail page.</p>
            </div>
            <div className="hidden gap-2 md:flex">
              <span className="site-chip rounded-full px-4 py-2 text-xs font-semibold">Prematch</span>
              <span className="site-chip rounded-full px-4 py-2 text-xs font-semibold">With odds</span>
            </div>
          </div>

          {fixtures.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {fixtures.map((fixture) => {
                const isLive = liveFixtureIds.has(fixture.id);
                const displayOdds = getMatchWinnerDisplayOdds(oddsMap[fixture.id] || []);
                const isFinished = isMatchClosedForBetting(fixture);
                const shouldShowScore = isLive || isFinished;

                return (
                  <Link
                    key={fixture.id}
                    href={`/matches/${fixture.id}`}
                    className="site-card site-card-hover rounded-[1.9rem] p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em]" style={{ color: 'var(--site-primary)' }}>{fixture.league_name}</p>
                        <p className="site-muted mt-2 text-sm">{formatMatchDate(fixture.match_date)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isLive ? 'site-live-pill' : 'site-blue-pill'}`}>
                        {isLive ? 'LIVE' : fixture.status || 'NS'}
                      </span>
                    </div>

                    <div className="mt-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex flex-1 items-center gap-3">
                          <div className="site-logo-shell h-12 w-12 rounded-2xl">
                            {fixture.home_team_logo ? (
                              <img src={fixture.home_team_logo} alt={fixture.home_team_name} className="h-8 w-8 object-contain" />
                            ) : (
                              <span className="text-xs font-bold text-white">{getInitials(fixture.home_team_name)}</span>
                            )}
                          </div>
                          <p className="truncate text-base font-semibold sm:text-lg">{fixture.home_team_name}</p>
                        </div>
                        {shouldShowScore && (
                          <div className="site-score-box rounded-2xl px-4 py-2 text-lg font-bold text-white">
                            {fixture.home_score}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex flex-1 items-center gap-3">
                          <div className="site-logo-shell h-12 w-12 rounded-2xl">
                            {fixture.away_team_logo ? (
                              <img src={fixture.away_team_logo} alt={fixture.away_team_name} className="h-8 w-8 object-contain" />
                            ) : (
                              <span className="text-xs font-bold text-white">{getInitials(fixture.away_team_name)}</span>
                            )}
                          </div>
                          <p className="truncate text-base font-semibold sm:text-lg">{fixture.away_team_name}</p>
                        </div>
                        {shouldShowScore && (
                          <div className="site-score-box rounded-2xl px-4 py-2 text-lg font-bold text-white">
                            {fixture.away_score}
                          </div>
                        )}
                      </div>
                    </div>

                    {displayOdds.length > 0 && (
                      <div className="mt-4 flex gap-2">
                        {displayOdds.map((odd) => (
                          <div
                            key={`${fixture.id}-${odd.selection}`}
                            className="site-score-box flex-1 rounded-xl px-2 py-2 text-center text-sm font-bold text-white"
                          >
                            <span className="site-muted block text-[10px] uppercase">
                              {getSelectionLabel(odd.selection, fixture)}
                            </span>
                            {Number(odd.odd_value).toFixed(2)}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="site-score-box site-muted mt-5 rounded-2xl p-4 text-sm">
                      <p>{fixture.venue_name || 'Venue pending'}</p>
                      <p className="mt-1">{fixture.venue_city || 'City pending'}</p>
                    </div>
                    <div className="site-divider my-4" />
                    <div className="flex items-center justify-between gap-3">
                      <span className="site-muted text-sm">Open betting card</span>
                      <span className="site-secondary-btn rounded-full px-4 py-2 text-xs font-semibold">View detail</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="site-card site-muted rounded-[1.9rem] p-6 text-sm">
              No saved matches with odds are available right now. The daily bootstrap cron adds up to 50 matches per day.
            </div>
          )}
        </section>

        <section className="site-panel rounded-[1.9rem] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="site-accent-line mb-4" />
              <h2 className="site-section-title text-lg font-semibold sm:text-2xl">Live tracker</h2>
              <p className="site-muted mt-1 text-sm">Live cards below are loaded from your backend database only.</p>
            </div>
            <span className="site-live-pill w-fit rounded-full px-4 py-2 text-xs font-semibold">
              Live list: ~45s refresh
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {liveMatches.length > 0 ? (
              liveMatches.map((match) => (
                <Link
                  key={match.fixture_id}
                  href={`/matches/${match.fixture_id}`}
                  className="site-card site-card-hover rounded-[1.9rem] p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="site-soft-text text-sm font-medium">{match.league_name}</p>
                    <span className="site-live-pill rounded-full px-3 py-1 text-xs font-semibold">
                      {getLiveBadge(match)}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="site-logo-shell h-11 w-11 rounded-2xl">
                          {match.home_team_logo ? (
                            <img src={match.home_team_logo} alt={match.home_team_name} className="h-7 w-7 object-contain" />
                          ) : (
                            <span className="text-xs font-bold text-white">{getInitials(match.home_team_name)}</span>
                          )}
                        </div>
                        <p className="truncate font-semibold">{match.home_team_name}</p>
                      </div>
                      <p className="text-2xl font-bold">{match.home_score}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="site-logo-shell h-11 w-11 rounded-2xl">
                          {match.away_team_logo ? (
                            <img src={match.away_team_logo} alt={match.away_team_name} className="h-7 w-7 object-contain" />
                          ) : (
                            <span className="text-xs font-bold text-white">{getInitials(match.away_team_name)}</span>
                          )}
                        </div>
                        <p className="truncate font-semibold">{match.away_team_name}</p>
                      </div>
                      <p className="text-2xl font-bold">{match.away_score}</p>
                    </div>
                  </div>
                  <div className="site-divider my-4" />
                  <span className="site-muted text-sm">Open live detail</span>
                </Link>
              ))
            ) : (
              <div className="site-card site-muted rounded-[1.9rem] p-5 text-sm md:col-span-2">
                No live games are active right now.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
