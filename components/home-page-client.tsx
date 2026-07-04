'use client';

import Link from 'next/link';
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api, FIXTURE_LIST_LIMIT, Fixture, FixtureMeta, League, LiveMatch, Odd } from '../lib/api';
import { getPublicApiBaseUrl } from '../lib/public-api-url';
import { getMatchWinnerDisplayOdds, hasMatchWinnerOdds } from '../lib/match-odds-display';
import {
  groupFixturesByLeague,
  HOME_INITIAL_VISIBLE,
  HOME_LOAD_MORE_STEP,
  orderFixturesForHomeList,
  pickCarouselFixtures,
} from '../lib/home-fixture-list';
import { isMatchClosedForBetting } from '../lib/match-status';
import {
  consumeHomeFeedPrefetch,
  hasSeededHomeBootstrap,
  peekHomeBootstrap,
  seedHomeBootstrapFromServer,
  startHomeFeedPrefetch,
} from '../lib/home-bootstrap';
import {
  homeFeedCacheKey,
  peekHomeFeedCache,
  prefetchHomeCountryFeeds,
  prefetchHomeDayFeeds,
  writeHomeFeedCache,
} from '../lib/home-feed-cache';

const PREFETCH_TOP_COUNTRIES = 12;
import { mergeDayCountsIntoMeta } from '../lib/fixture-meta-utils';
import BetSlipDrawer from './BetSlipDrawer';
import TelegramSupportFab from './TelegramSupportFab';
import SupportChat from './support-chat/SupportChat';
import MatchDetailLink from './match-detail-link';
import { useBetSlip } from '../lib/betslip';
import AuthModal from './auth-modal';
import AdminDashboard from './AdminDashboard';
import DepositModal from './DepositModal';
import { prefetchDepositBootstrap } from '@/lib/deposit-cache';
import TransactionHistory from './TransactionHistory';
import AccountSettings from './AccountSettings';
import WithdrawalModal from './WithdrawalModal';
import BetHistory from './BetHistory';
import { BETVERS_AUTH_SUCCESS_EVENT, BETVERS_WALLET_UPDATED_EVENT, BETVERS_WALLET_BROADCAST_CHANNEL } from '../lib/ui-events';

type FeaturedMatch = {
  fixture: Fixture;
  odds: Odd[];
};

type DayOption = {
  id: string;
  label: string;
  count: number;
};

type CountryOption = {
  name: string;
  count: number;
  flagUrl: string | null;
};

type HomePageClientProps = {
  liveMatches: LiveMatch[];
  upcomingFixtures: Fixture[];
  initialOddsMap?: Record<number, Odd[]>;
  initialFixtureMeta?: FixtureMeta | null;
  topLeagues: League[];
  featuredMatches: FeaturedMatch[];
};

function formatMatchDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDayHeader(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
  }).format(d);
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
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

/** Scales balance text so long amounts (e.g. 10000000.00) fit on small screens without overlapping. */
function headerBalanceFontSizes(amountFormatted: string): { amountPx: number; currencyPx: number } {
  const n = amountFormatted.length;
  const amountPx =
    n <= 8 ? 15 : Math.max(8, Math.min(15, Math.round(118 / Math.max(n, 9))));
  const currencyPx = Math.max(7, Math.min(11, amountPx - 1));
  return { amountPx, currencyPx };
}

function getSelectionName(selection: string, fixture: Fixture) {
  const sel = selection.toLowerCase();
  if (sel === 'home' || sel === '1') return fixture.home_team_name;
  if (sel === 'away' || sel === '2') return fixture.away_team_name;
  if (sel === 'x') return 'Draw';
  return selection;
}

/** Live scores + odds — aligned with backend 30s sync. */
const LIVE_POLL_INTERVAL_MS = 45_000;
const LIVE_SIDEBAR_STATUSES = ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'];

function liveMatchToFixture(m: LiveMatch): Fixture {
  return {
    id: m.fixture_id,
    league_id: 0,
    home_team_id: 0,
    away_team_id: 0,
    match_date: m.match_date,
    status: m.status,
    minute: m.minute,
    home_score: m.home_score,
    away_score: m.away_score,
    home_team_name: m.home_team_name,
    home_team_logo: m.home_team_logo,
    away_team_name: m.away_team_name,
    away_team_logo: m.away_team_logo,
    league_name: m.league_name,
    league_logo: m.league_logo || '',
    api_league_id: m.api_league_id,
    country_name: m.country_name || '',
    flag_url: m.flag_url || '',
    venue_name: '',
    venue_city: '',
    referee: '',
  };
}

function isLiveInPlay(match: { status?: string; minute?: number }) {
  const st = match.status?.toUpperCase() || '';
  return LIVE_SIDEBAR_STATUSES.includes(st) && !isMatchClosedForBetting(match);
}
/** Dropdown counts from DB (no full fixture payload). */
const META_REFRESH_INTERVAL_MS = 180_000;

const HOME_PROMO_BANNERS = [
  '/banner/banner1.jpg',
  '/banner/banner8.jpg',
  '/banner/banner6.jpg',
] as const;

function dayIdToLabel(dayId: string) {
  if (dayId === 'all') return 'All Games';
  if (dayId === 'today') return 'Today';
  if (dayId === 'tomorrow') return 'Tomorrow';
  if (dayId.startsWith('date:')) return formatDayHeader(dayId.replace('date:', ''));
  return dayId;
}

function isInSelectedDayRange(fixture: Fixture, dayId: string) {
  if (dayId === 'all') return true;

  const fixtureDate = new Date(fixture.match_date);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  if (dayId === 'today') {
    return fixtureDate >= todayStart && fixtureDate < tomorrowStart;
  }

  if (dayId === 'tomorrow') {
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    return fixtureDate >= tomorrowStart && fixtureDate < tomorrowEnd;
  }

  if (dayId.startsWith('date:')) {
    const ymd = dayId.replace('date:', '');
    const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
    if (!y || !m || !d) return false;
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return fixtureDate >= start && fixtureDate < end;
  }

  return true;
}

export default function HomePageClient({
  liveMatches: initialLiveMatches,
  upcomingFixtures: initialUpcomingFixtures,
  initialOddsMap = {},
  initialFixtureMeta = null,
  topLeagues: initialTopLeagues,
  featuredMatches: _initialFeaturedMatches,
}: HomePageClientProps) {
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>(initialLiveMatches);
  const [upcomingFixtures, setUpcomingFixtures] = useState<Fixture[]>(() => {
    if (initialUpcomingFixtures.length > 0) return initialUpcomingFixtures;
    if (typeof window !== 'undefined') {
      const boot = peekHomeBootstrap();
      if (boot?.fixtures.length) return boot.fixtures;
    }
    return [];
  });
  const [fixtureMeta, setFixtureMeta] = useState<FixtureMeta | null>(() => {
    if (initialFixtureMeta) return initialFixtureMeta;
    if (typeof window !== 'undefined') return peekHomeBootstrap()?.meta ?? null;
    return null;
  });
  const [topLeagues, setTopLeagues] = useState<League[]>(initialTopLeagues);
  const [oddsMap, setOddsMap] = useState<Record<number, Odd[]>>(() => {
    if (Object.keys(initialOddsMap).length > 0) return initialOddsMap;
    if (typeof window !== 'undefined') return peekHomeBootstrap()?.odds ?? {};
    return {};
  });
  const [listFetchSettled, setListFetchSettled] = useState(
    () => initialUpcomingFixtures.length > 0
  );
  const ssrBundleReady =
    initialUpcomingFixtures.length > 0 && Boolean(initialFixtureMeta?.days?.length);
  const filterCacheKey = (
    day: string,
    country: string,
    leagueId: number | null
  ) => homeFeedCacheKey(day, country, leagueId);
  const [activeTab, setActiveTab] = useState<'highlights' | 'upcoming' | 'countries'>('upcoming');
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState('All countries');
  const [openSheet, setOpenSheet] = useState<'day' | 'country' | null>(null);
  const [collapsedLeagues, setCollapsedLeagues] = useState<Set<string>>(new Set());
  const [isMounted, setIsMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [sidebarFilterMode, setSidebarFilterMode] = useState<'all' | 'live'>('all');
  const [isTopLeaguesExpanded, setIsTopLeaguesExpanded] = useState(true);
  const [isCountriesExpanded, setIsCountriesExpanded] = useState(true);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [selectedLeagueName, setSelectedLeagueName] = useState<string | null>(null);
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const [mainSearch, setMainSearch] = useState('');
  const deferredMainSearch = useDeferredValue(mainSearch);
  const [showMainSearch, setShowMainSearch] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const openDepositAfterLoginRef = useRef(false);
  const { addBet, isSelected } = useBetSlip();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [user, setUser] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);
  const [isBetHistoryOpen, setIsBetHistoryOpen] = useState(false);
  const [homePromoBannerIndex, setHomePromoBannerIndex] = useState(0);
  /** Frontend window: how many matches to show (DB may hold up to FIXTURE_LIST_LIMIT). */
  const [visibleLimit, setVisibleLimit] = useState(HOME_INITIAL_VISIBLE);
  const [isLoadingVisibleOdds, setIsLoadingVisibleOdds] = useState(false);
  const fixtureFetchGenRef = useRef(0);
  const fixtureMetaRef = useRef(fixtureMeta);
  const upcomingFixturesRef = useRef(upcomingFixtures);
  const oddsMapRef = useRef(oddsMap);
  fixtureMetaRef.current = fixtureMeta;
  upcomingFixturesRef.current = upcomingFixtures;
  oddsMapRef.current = oddsMap;

  const refreshOddsForFixtureIds = useCallback(async (fixtureIds: number[]) => {
    const ids = [...new Set(fixtureIds.filter((id) => Number.isFinite(id) && id > 0))];
    if (ids.length === 0) return;
    const CHUNK = 80;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const part = await api.getOddsBulk(chunk).catch(() => ({} as Record<number, Odd[]>));
      startTransition(() => {
        setOddsMap((prev) => {
          const next = { ...prev };
          for (const [key, rows] of Object.entries(part)) {
            const fid = Number(key);
            if (Number.isFinite(fid) && hasMatchWinnerOdds(rows)) next[fid] = rows;
          }
          return next;
        });
      });
    }
  }, []);

  const mergeLiveScoresIntoFixtures = useCallback((matches: LiveMatch[]) => {
    if (matches.length === 0) return;
    const byId = new Map(matches.map((m) => [m.fixture_id, m]));
    setUpcomingFixtures((prev) =>
      prev.map((f) => {
        const lm = byId.get(f.id);
        if (!lm) return f;
        return {
          ...f,
          status: lm.status,
          minute: lm.minute,
          home_score: lm.home_score,
          away_score: lm.away_score,
        };
      })
    );
  }, []);

  const scrollCarousel = (dir: 'left' | 'right') => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: dir === 'right' ? 300 : -300, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const syncUser = () => {
      const raw = localStorage.getItem('user');
      if (raw) {
        try {
          setUser(JSON.parse(raw));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener(BETVERS_AUTH_SUCCESS_EVENT, syncUser);
    window.addEventListener(BETVERS_WALLET_UPDATED_EVENT, syncUser);
    return () => {
      window.removeEventListener(BETVERS_AUTH_SUCCESS_EVENT, syncUser);
      window.removeEventListener(BETVERS_WALLET_UPDATED_EVENT, syncUser);
    };
  }, []);

  useEffect(() => {
    const n = HOME_PROMO_BANNERS.length;
    if (n <= 1) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const id = window.setInterval(() => {
      setHomePromoBannerIndex((i) => (i + 1) % n);
    }, 5500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (user?.id && typeof window !== 'undefined' && localStorage.getItem('token')) {
      prefetchDepositBootstrap();
    }
  }, [user?.id]);

  /** Poll wallet + tab broadcast so balance updates when admin approves a deposit (no page refresh). */
  useEffect(() => {
    if (!user?.id || typeof window === 'undefined' || !localStorage.getItem('token')) return;

    const POLL_MS = 30_000;

    const pollWallet = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const { balance } = await api.getWalletBalance();
        setUser((prev: any) => {
          if (!prev?.id) return prev;
          const prevBal = Number(prev.balance ?? 0);
          if (Number.isFinite(prevBal) && Math.abs(prevBal - balance) < 0.005) return prev;
          const next = { ...prev, balance };
          try {
            localStorage.setItem('user', JSON.stringify(next));
          } catch {
            /* ignore */
          }
          queueMicrotask(() =>
            window.dispatchEvent(new CustomEvent(BETVERS_WALLET_UPDATED_EVENT, { detail: { balance } }))
          );
          return next;
        });
      } catch {
        /* offline / expired session */
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(BETVERS_WALLET_BROADCAST_CHANNEL);
      bc.onmessage = () => void pollWallet();
    } catch {
      /* ignore */
    }

    const intervalId = window.setInterval(() => void pollWallet(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pollWallet();
    };
    document.addEventListener('visibilitychange', onVisible);
    void pollWallet();

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      bc?.close();
    };
  }, [user?.id]);

  const handleAuthModalClose = () => {
    openDepositAfterLoginRef.current = false;
    setIsAuthOpen(false);
  };

  const primeDeposit = () => {
    if (typeof window === 'undefined') return;
    if (user?.id && localStorage.getItem('token')) prefetchDepositBootstrap();
    void fetch(`${getPublicApiBaseUrl()}/health`, { cache: 'no-store' }).catch(() => undefined);
  };

  /** Open deposit if logged in; otherwise show login and reopen deposit after successful auth. */
  const openDepositOrAskLogin = () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!user?.id || !token) {
      openDepositAfterLoginRef.current = true;
      setAuthView('login');
      setIsAuthOpen(true);
      return;
    }
    primeDeposit();
    setIsDepositOpen(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    openDepositAfterLoginRef.current = false;
    setUser(null);
    setDropdownOpen(false);
    setShowAdminDashboard(false);
    setIsBetHistoryOpen(false);
    setIsDepositOpen(false);
    setIsWithdrawalOpen(false);
    setIsHistoryOpen(false);
  };

  const toggleLeague = (leagueName: string) => {
    setCollapsedLeagues(prev => {
      const next = new Set(prev);
      if (next.has(leagueName)) {
        next.delete(leagueName);
      } else {
        next.add(leagueName);
      }
      return next;
    });
  };

  useEffect(() => {
    setVisibleLimit(HOME_INITIAL_VISIBLE);
  }, [selectedLeagueId, showLiveOnly]);

  const dayOptions = useMemo<DayOption[]>(() => {
    if (fixtureMeta?.days?.length) {
      return fixtureMeta.days.map((d) => ({
        id: d.id,
        label: dayIdToLabel(d.id),
        count: d.count,
      }));
    }
    return [{ id: 'all', label: 'All Games', count: 0 }];
  }, [fixtureMeta]);

  const selectedDayLabel = useMemo(
    () => dayOptions.find((option) => option.id === selectedDay)?.label || 'Today',
    [dayOptions, selectedDay]
  );

  const countryOptions = useMemo<CountryOption[]>(() => {
    if (fixtureMeta?.countries?.length) {
      const allCount =
        selectedDay !== 'all'
          ? fixtureMeta.days.find((d) => d.id === selectedDay)?.count ?? fixtureMeta.total
          : fixtureMeta.total;
      const countries = fixtureMeta.countries.filter((c) => c.name !== 'All countries');
      return [
        { name: 'All countries', count: allCount, flagUrl: null },
        ...countries.map((c) => ({
          name: c.name,
          count: c.count,
          flagUrl: c.flag_url,
        })),
      ];
    }
    const grouped = new Map<string, CountryOption>();
    for (const f of upcomingFixtures) {
      const name = f.country_name || 'International';
      const cur = grouped.get(name);
      if (cur) cur.count += 1;
      else grouped.set(name, { name, count: 1, flagUrl: f.flag_url || null });
    }
    return [
      { name: 'All countries', count: upcomingFixtures.length, flagUrl: null },
      ...Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name)),
    ];
  }, [fixtureMeta, upcomingFixtures, selectedDay]);

  const filteredTotalCount = useMemo(() => {
    if (fixtureMeta) {
      const dbTotal =
        fixtureMeta.days.find((d) => d.id === 'all')?.count ?? fixtureMeta.total;
      if (selectedCountry !== 'All countries') {
        const c = fixtureMeta.countries.find((x) => x.name === selectedCountry)?.count;
        if (c != null && c > 0) return c;
      }
      if (selectedDay !== 'all') {
        const d = fixtureMeta.days.find((x) => x.id === selectedDay)?.count;
        if (d != null && d > 0) return d;
      }
      if (dbTotal > 0) return dbTotal;
    }
    return 0;
  }, [fixtureMeta, selectedDay, selectedCountry]);

  useEffect(() => {
    if (!countryOptions.some((country) => country.name === selectedCountry)) {
      setSelectedCountry('All countries');
    }
  }, [countryOptions, selectedCountry]);

  const filteredFixtures = useMemo(() => {
    let pool = showLiveOnly
      ? (() => {
          const fromFeed = upcomingFixtures.filter((f) => isLiveInPlay(f));
          const seen = new Set(fromFeed.map((f) => f.id));
          const fromLive = liveMatches
            .filter((m) => m.is_active && isLiveInPlay(m))
            .filter((m) => !seen.has(m.fixture_id))
            .map(liveMatchToFixture);
          return [...fromFeed, ...fromLive];
        })()
      : upcomingFixtures;

    if (selectedDay !== 'all') {
      pool = pool.filter((f) => isInSelectedDayRange(f, selectedDay));
    }
    if (selectedCountry !== 'All countries') {
      pool = pool.filter(
        (f) => (f.country_name || 'International') === selectedCountry
      );
    }

    const q = deferredMainSearch.trim().toLowerCase();
    if (q) {
      pool = pool.filter(
        (f) =>
          f.home_team_name.toLowerCase().includes(q) ||
          f.away_team_name.toLowerCase().includes(q) ||
          f.league_name.toLowerCase().includes(q) ||
          (f.country_name || '').toLowerCase().includes(q)
      );
    }
    return pool;
  }, [upcomingFixtures, liveMatches, showLiveOnly, deferredMainSearch, selectedDay, selectedCountry]);

  const orderedFilteredFixtures = useMemo(
    () => orderFixturesForHomeList(filteredFixtures),
    [filteredFixtures]
  );

  const visibleFixturesPool = useMemo(
    () => orderedFilteredFixtures.slice(0, visibleLimit),
    [orderedFilteredFixtures, visibleLimit]
  );

  const loadedForFilterCount = orderedFilteredFixtures.length;
  const hasMoreMatches =
    !showLiveOnly &&
    !deferredMainSearch.trim() &&
    visibleLimit < filteredTotalCount;

  /** Rows to request from API — never default to 5000 before meta loads (timeouts on Render). */
  const apiFetchLimit = useMemo(() => {
    if (showLiveOnly) return Math.min(400, fixtureMeta?.total ?? 400);
    const metaTotal = fixtureMeta?.total;
    if (!metaTotal || metaTotal <= 0) return HOME_INITIAL_VISIBLE;
    let cap = metaTotal;
    if (selectedCountry !== 'All countries') {
      cap = fixtureMeta?.countries.find((c) => c.name === selectedCountry)?.count ?? cap;
    } else if (selectedDay !== 'all') {
      cap = fixtureMeta?.days.find((d) => d.id === selectedDay)?.count ?? cap;
    }
    return Math.min(Math.max(HOME_INITIAL_VISIBLE, cap), FIXTURE_LIST_LIMIT);
  }, [showLiveOnly, selectedDay, selectedCountry, fixtureMeta]);

  /** List rows from API (has_odds); 1X2 lines load in the background per row. */
  const displayedUpcoming = visibleFixturesPool;

  const liveFixtureIds = useMemo(() => new Set(liveMatches.map((match) => match.fixture_id)), [liveMatches]);

  const [carouselFixtures, setCarouselFixtures] = useState<Fixture[]>(() =>
    pickCarouselFixtures(initialUpcomingFixtures)
  );

  const featuredForCarousel = useMemo(
    () =>
      carouselFixtures.slice(0, 10).map((fixture) => ({
        fixture,
        odds: oddsMap[fixture.id] ?? [],
      })),
    [carouselFixtures, oddsMap]
  );

  const carouselFixtureIds = useMemo(
    () => carouselFixtures.slice(0, 10).map((f) => f.id),
    [carouselFixtures]
  );

  const oddsTargetIds = useMemo(() => {
    const ids = new Set<number>();
    for (const f of visibleFixturesPool) ids.add(f.id);
    for (const id of carouselFixtureIds) ids.add(id);
    for (const m of liveMatches) ids.add(m.fixture_id);
    return [...ids].sort((a, b) => a - b);
  }, [visibleFixturesPool, carouselFixtureIds, liveMatches]);

  useEffect(() => {
    let cancelled = false;
    const needIds = oddsTargetIds.filter((id) => !hasMatchWinnerOdds(oddsMapRef.current[id]));
    if (needIds.length === 0) return;

    const loadOdds = async () => {
      setIsLoadingVisibleOdds(true);
      const CHUNK = 80;
      try {
        for (let i = 0; i < needIds.length; i += CHUNK) {
          if (cancelled) return;
          const chunk = needIds.slice(i, i + CHUNK);
          const part = await api.getOddsBulk(chunk).catch(() => ({} as Record<number, Odd[]>));
          if (cancelled) return;
          startTransition(() => {
            setOddsMap((prev) => {
              const next = { ...prev };
              for (const [key, rows] of Object.entries(part)) {
                const fid = Number(key);
                if (Number.isFinite(fid) && hasMatchWinnerOdds(rows)) next[fid] = rows;
              }
              return next;
            });
          });
        }
      } finally {
        if (!cancelled) setIsLoadingVisibleOdds(false);
      }
    };

    const startDelay = ssrBundleReady ? 2500 : 0;
    const start = () => {
      if (!cancelled) void loadOdds();
    };
    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    if (typeof requestIdleCallback !== 'undefined') {
      idleId = requestIdleCallback(start, { timeout: startDelay + 1500 });
    } else {
      timerId = setTimeout(start, startDelay);
    }
    return () => {
      cancelled = true;
      if (idleId != null && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleId);
      }
      if (timerId) clearTimeout(timerId);
    };
  }, [oddsTargetIds, ssrBundleReady]);

  const applyFeedToState = useCallback(
    (fixtures: Fixture[], odds: Record<number, Odd[]>, replace = true) => {
      if (fixtures.length === 0 && !replace) return;
      if (fixtures.length > 0) {
        setUpcomingFixtures(fixtures);
        writeHomeFeedCache(
          filterCacheKey(selectedDay, selectedCountry, selectedLeagueId),
          fixtures,
          odds,
          fixtureMetaRef.current
        );
      }
      if (Object.keys(odds).length > 0) {
        setOddsMap((prev) => ({ ...prev, ...odds }));
      }
    },
    [selectedDay, selectedCountry, selectedLeagueId]
  );

  const loadFixtureList = useCallback(
    async (opts?: { background?: boolean }) => {
      const background = opts?.background === true;
      const gen = ++fixtureFetchGenRef.current;
      const metaCap =
        filteredTotalCount > 0 ? filteredTotalCount : fixtureMetaRef.current?.total ?? 0;
      const fetchLimit = showLiveOnly
        ? Math.min(400, Math.max(visibleLimit, apiFetchLimit))
        : Math.min(
            FIXTURE_LIST_LIMIT,
            Math.max(HOME_INITIAL_VISIBLE, visibleLimit, apiFetchLimit, metaCap || 0)
          );
      try {
        let feed = await api.getHomeFeed({
          limit: fetchLimit,
          day: selectedDay !== 'all' ? selectedDay : undefined,
          country: selectedCountry !== 'All countries' ? selectedCountry : undefined,
          api_league_id: selectedLeagueId ?? undefined,
        });
        if (gen !== fixtureFetchGenRef.current) return;

        if (feed.fixtures.length === 0) {
          const fixtures = await api.getFixtures({
            limit: fetchLimit,
            has_odds: true,
            day: selectedDay !== 'all' ? selectedDay : undefined,
            country: selectedCountry !== 'All countries' ? selectedCountry : undefined,
            api_league_id: selectedLeagueId ?? undefined,
          });
          if (gen !== fixtureFetchGenRef.current) return;
          feed = { fixtures, odds: {} };
        }

        const apply = () => applyFeedToState(feed.fixtures, feed.odds, !background);
        if (background) startTransition(apply);
        else apply();
      } finally {
        if (gen === fixtureFetchGenRef.current) {
          setListFetchSettled(true);
        }
      }
    },
    [
      apiFetchLimit,
      visibleLimit,
      showLiveOnly,
      selectedDay,
      selectedCountry,
      selectedLeagueId,
      applyFeedToState,
      filteredTotalCount,
    ]
  );

  const hydrateFromCache = useCallback(
    (day: string, country: string, leagueId: number | null) => {
      const cached = peekHomeFeedCache(filterCacheKey(day, country, leagueId));
      if (!cached?.fixtures.length) return false;
      setUpcomingFixtures(cached.fixtures);
      setOddsMap((prev) => ({ ...prev, ...cached.odds }));
      if (cached.meta) setFixtureMeta(cached.meta);
      setListFetchSettled(true);
      return true;
    },
    []
  );

  const applyBootstrapSnapshot = useCallback(
    (fixtures: Fixture[], odds: Record<number, Odd[]>, meta: FixtureMeta | null) => {
      if (fixtures.length > 0) {
        setUpcomingFixtures(fixtures);
        if (Object.keys(odds).length > 0) {
          setOddsMap((prev) => ({ ...prev, ...odds }));
        }
        if (meta) setFixtureMeta(meta);
        writeHomeFeedCache(
          filterCacheKey('all', 'All countries', null),
          fixtures,
          odds,
          meta
        );
      }
      setListFetchSettled(true);
    },
    []
  );

  useLayoutEffect(() => {
    if (ssrBundleReady) {
      seedHomeBootstrapFromServer({
        fixtures: initialUpcomingFixtures,
        odds: initialOddsMap,
        meta: initialFixtureMeta,
        topLeagues: initialTopLeagues,
      });
      writeHomeFeedCache(
        filterCacheKey('all', 'All countries', null),
        initialUpcomingFixtures,
        initialOddsMap,
        initialFixtureMeta
      );
      setListFetchSettled(true);
      return;
    }

    startHomeFeedPrefetch();

    const hasCountryList = initialFixtureMeta?.countries?.some(
      (c) => c.name !== 'All countries'
    );
    if (!hasCountryList && !ssrBundleReady) {
      void api.getFixturesMeta({ has_odds: true }).then((meta) => {
        if (meta?.countries?.length) setFixtureMeta(meta);
      });
    }

    if (!initialFixtureMeta?.days?.length) {
      void api.getFixturesDayCounts().then((counts) => {
        if (counts?.days?.length) {
          setFixtureMeta((prev) => mergeDayCountsIntoMeta(prev, counts));
        }
      });
    }

    if (initialUpcomingFixtures.length > 0) {
      writeHomeFeedCache(
        filterCacheKey('all', 'All countries', null),
        initialUpcomingFixtures,
        initialOddsMap,
        initialFixtureMeta
      );
      setListFetchSettled(true);
      void loadFixtureList({ background: true });
      return;
    }

    if (upcomingFixtures.length > 0) {
      setListFetchSettled(true);
      void loadFixtureList({ background: true });
      return;
    }

    const boot = peekHomeBootstrap();
    if (boot?.fixtures.length) {
      applyBootstrapSnapshot(boot.fixtures, boot.odds, boot.meta);
      void loadFixtureList({ background: true });
      return;
    }

    hydrateFromCache(selectedDay, selectedCountry, selectedLeagueId);

    const pending = consumeHomeFeedPrefetch();
    if (pending) {
      void pending.then((snap) => {
        if (snap.fixtures.length > 0) {
          applyBootstrapSnapshot(snap.fixtures, snap.odds, snap.meta);
        }
        void loadFixtureList({ background: true }).finally(() => setListFetchSettled(true));
      });
      return;
    }

    void loadFixtureList().finally(() => setListFetchSettled(true));
  }, []);

  useEffect(() => {
    if (selectedDay === 'all' && selectedCountry === 'All countries' && selectedLeagueId === null) {
      return;
    }
    const cacheKey = filterCacheKey(selectedDay, selectedCountry, selectedLeagueId);
    const cached = peekHomeFeedCache(cacheKey);
    if (cached?.fixtures.length) {
      setUpcomingFixtures(cached.fixtures);
      setOddsMap((prev) => ({ ...prev, ...cached.odds }));
      if (cached.meta) setFixtureMeta(cached.meta);
    }
    setListFetchSettled(true);
    void loadFixtureList({ background: true });
  }, [selectedDay, selectedCountry, selectedLeagueId, loadFixtureList]);

  /** Warm day/country caches after first paint (never compete with initial load). */
  useEffect(() => {
    if (!fixtureMeta?.days?.length) return;
    const delay = ssrBundleReady ? 12_000 : 1500;
    const timer = window.setTimeout(() => {
      const dayIds = fixtureMeta.days.map((d) => d.id);
      prefetchHomeDayFeeds(dayIds, HOME_INITIAL_VISIBLE, (day) =>
        api.getHomeFeed({ limit: HOME_INITIAL_VISIBLE, day })
      );
      const topCountries = fixtureMeta.countries
        .filter((c) => c.name !== 'All countries' && (c.count ?? 0) > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, PREFETCH_TOP_COUNTRIES)
        .map((c) => c.name);
      if (topCountries.length) {
        prefetchHomeCountryFeeds('all', topCountries, HOME_INITIAL_VISIBLE, (params) =>
          api.getHomeFeed({ limit: HOME_INITIAL_VISIBLE, ...params })
        );
        if (selectedDay !== 'all') {
          prefetchHomeCountryFeeds(selectedDay, topCountries, HOME_INITIAL_VISIBLE, (params) =>
            api.getHomeFeed({ limit: HOME_INITIAL_VISIBLE, ...params })
          );
        }
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [fixtureMeta?.days, fixtureMeta?.countries, selectedDay, ssrBundleReady]);

  /** After meta loads, prefetch full filter list in background (deferred so first paint stays instant). */
  useEffect(() => {
    if (ssrBundleReady) return;
    if (showLiveOnly || deferredMainSearch.trim()) return;
    if (!fixtureMeta?.total) return;
    const target = Math.min(FIXTURE_LIST_LIMIT, fixtureMeta.total);
    if (upcomingFixturesRef.current.length >= target) return;
    void loadFixtureList({ background: true });
  }, [
    ssrBundleReady,
    fixtureMeta?.total,
    apiFetchLimit,
    showLiveOnly,
    deferredMainSearch,
    selectedDay,
    selectedCountry,
    selectedLeagueId,
    loadFixtureList,
  ]);

  useEffect(() => {
    let cancelled = false;
    let metaTimer: ReturnType<typeof setTimeout> | undefined;

    const loadMeta = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      const counts = await api.getFixturesDayCounts();
      if (!cancelled && counts?.days?.length) {
        startTransition(() =>
          setFixtureMeta((prev) => mergeDayCountsIntoMeta(prev, counts))
        );
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const meta = await api.getFixturesMeta({ has_odds: true });
          if (!cancelled && meta) {
            startTransition(() => {
              setFixtureMeta(meta);
              const fixtures = upcomingFixturesRef.current;
              if (fixtures.length > 0) {
                writeHomeFeedCache(
                  filterCacheKey(selectedDay, selectedCountry, selectedLeagueId),
                  fixtures,
                  oddsMapRef.current,
                  meta
                );
              }
            });
          }
          return;
        } catch {
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
    };

    if (!ssrBundleReady) {
      void loadMeta();
    }
    metaTimer = setInterval(() => void loadMeta(), META_REFRESH_INTERVAL_MS);

    const onBootstrapMeta = (e: Event) => {
      const meta = (e as CustomEvent<FixtureMeta>).detail;
      if (!meta?.days?.length) return;
      setFixtureMeta((prev) =>
        meta.countries.length > 1
          ? meta
          : mergeDayCountsIntoMeta(prev, { total: meta.total, days: meta.days })
      );
    };
    window.addEventListener('betvers:home-meta', onBootstrapMeta);

    return () => {
      cancelled = true;
      if (metaTimer) clearInterval(metaTimer);
      window.removeEventListener('betvers:home-meta', onBootstrapMeta);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCountryMeta = async () => {
      if (selectedDay === 'all') return;
      try {
        const meta = await api.getFixturesMeta({
          has_odds: true,
          day: selectedDay,
        });
        if (!cancelled && meta) {
          const countries = meta.countries.filter((c) => c.name !== 'All countries');
          const allCount = countries.reduce((sum, c) => sum + (c.count || 0), 0);
          startTransition(() =>
            setFixtureMeta((prev) =>
              prev
                ? {
                    ...prev,
                    countries: [
                      {
                        name: 'All countries',
                        count: allCount || prev.total,
                        flag_url: null,
                      },
                      ...countries,
                    ],
                  }
                : meta
            )
          );
        }
      } catch {
        /* keep previous country counts */
      }
    };
    void loadCountryMeta();
    return () => {
      cancelled = true;
    };
  }, [selectedDay]);

  useEffect(() => {
    if (carouselFixtures.length > 0) return;
    const picked = pickCarouselFixtures(upcomingFixtures);
    if (picked.length > 0) {
      setCarouselFixtures(picked);
      return;
    }
    let cancelled = false;
    void api
      .getHomeFeed({ limit: 12 })
      .then((feed) => {
        if (cancelled) return;
        const pickedFeed = pickCarouselFixtures(feed.fixtures);
        if (pickedFeed.length > 0) {
          setCarouselFixtures(pickedFeed);
          if (Object.keys(feed.odds).length > 0) {
            setOddsMap((prev) => ({ ...prev, ...feed.odds }));
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [carouselFixtures.length, upcomingFixtures]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const pollLive = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        timer = setTimeout(() => void pollLive(), LIVE_POLL_INTERVAL_MS);
        return;
      }
      try {
        const nextLive = await api.getLiveMatches().catch(() => [] as LiveMatch[]);
        const rows = Array.isArray(nextLive) ? nextLive : [];
        if (!cancelled) {
          startTransition(() => setLiveMatches(rows));
          mergeLiveScoresIntoFixtures(rows);
          const liveIds = rows
            .filter((m) => m.is_active && isLiveInPlay(m))
            .map((m) => m.fixture_id);
          const feedLiveIds = upcomingFixturesRef.current
            .filter((f) => isLiveInPlay(f))
            .map((f) => f.id);
          const oddsIds = [...new Set([...liveIds, ...feedLiveIds])];
          if (oddsIds.length > 0) {
            await refreshOddsForFixtureIds(oddsIds);
          }
        }
      } finally {
        if (!cancelled) timer = setTimeout(() => void pollLive(), LIVE_POLL_INTERVAL_MS);
      }
    };

    void pollLive();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [mergeLiveScoresIntoFixtures, refreshOddsForFixtureIds]);

  const loadFixtureListRef = useRef(loadFixtureList);
  loadFixtureListRef.current = loadFixtureList;

  useEffect(() => {
    if (!showLiveOnly) return;
    void api.getLiveMatches().then((rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      startTransition(() => setLiveMatches(rows));
      mergeLiveScoresIntoFixtures(rows);
      const ids = rows.filter((m) => m.is_active && isLiveInPlay(m)).map((m) => m.fixture_id);
      if (ids.length > 0) void refreshOddsForFixtureIds(ids);
    });
    void loadFixtureListRef.current({ background: true });
  }, [showLiveOnly, mergeLiveScoresIntoFixtures, refreshOddsForFixtureIds]);

  const fetchTopLeagues = useCallback(async () => {
    let list = await api.getTopLeagues();
    if (!Array.isArray(list) || list.length === 0) {
      const all = await api.getLeagues();
      const marked = all.filter((l) => l.is_top);
      list = marked.length > 0 ? marked : all;
    }
    if (list.length > 0) {
      startTransition(() => setTopLeagues(list.slice(0, 15)));
    }
  }, []);

  useEffect(() => {
    void fetchTopLeagues();
  }, [fetchTopLeagues]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    setIsTopLeaguesExpanded(true);
    setIsCountriesExpanded(true);
    void fetchTopLeagues();
    if (sidebarFilterMode === 'live') {
      void api.getLiveMatches().then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) {
          startTransition(() => setLiveMatches(rows));
        }
      });
    }
  }, [isSidebarOpen, sidebarFilterMode, fetchTopLeagues]);

  const liveFixturesInFeed = useMemo(
    () =>
      upcomingFixtures.filter((f) => {
        const st = f.status?.toUpperCase() || '';
        return LIVE_SIDEBAR_STATUSES.includes(st) && !isMatchClosedForBetting(f);
      }),
    [upcomingFixtures]
  );

  const leaguesFromFeed = useMemo(() => {
    const map = new Map<number, League>();
    for (const f of upcomingFixtures) {
      const apiId = f.api_league_id;
      if (!apiId || map.has(apiId)) continue;
      map.set(apiId, {
        id: apiId,
        country_id: 0,
        name: f.league_name,
        logo: f.league_logo,
        type: '',
        season_current: '',
        api_league_id: apiId,
        is_top: false,
        top_rank: 0,
        country_name: f.country_name || '',
        flag_url: f.flag_url || '',
      });
    }
    return [...map.values()].slice(0, 15);
  }, [upcomingFixtures]);

  const sportSidebarLeagues = useMemo(() => {
    const base = topLeagues.length > 0 ? topLeagues : leaguesFromFeed;
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.country_name || '').toLowerCase().includes(q)
    );
  }, [topLeagues, leaguesFromFeed, sidebarSearch]);

  const sportSidebarCountries = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    return countryOptions.filter((c) => {
      if (c.name === 'All countries') return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q);
    });
  }, [countryOptions, sidebarSearch]);

  const liveSidebarLeagues = useMemo(() => {
    const map = new Map<number, League & { matchCount: number }>();
    const merge = (
      apiId: number | null | undefined,
      name: string,
      logo: string | null | undefined,
      country: string
    ) => {
      if (!apiId) return;
      const existing = map.get(apiId);
      if (existing) {
        existing.matchCount += 1;
        return;
      }
      map.set(apiId, {
        id: apiId,
        country_id: 0,
        name: name || 'League',
        logo: logo || '',
        type: '',
        season_current: '',
        api_league_id: apiId,
        is_top: false,
        top_rank: 0,
        country_name: country,
        flag_url: '',
        matchCount: 1,
      });
    };
    for (const m of liveMatches) {
      merge(m.api_league_id, m.league_name, m.league_logo, m.country_name || '');
    }
    for (const f of liveFixturesInFeed) {
      merge(f.api_league_id, f.league_name, f.league_logo, f.country_name || '');
    }
    const q = sidebarSearch.trim().toLowerCase();
    return [...map.values()]
      .filter(
        (l) =>
          !q ||
          l.name.toLowerCase().includes(q) ||
          (l.country_name || '').toLowerCase().includes(q)
      )
      .sort((a, b) => b.matchCount - a.matchCount)
      .map(({ matchCount: _mc, ...league }) => league);
  }, [liveMatches, liveFixturesInFeed, sidebarSearch]);

  const liveSidebarCountries = useMemo(() => {
    const counts = new Map<string, { count: number; flagUrl: string | null }>();
    const add = (name: string, flag: string | null | undefined) => {
      const n = name || 'International';
      const cur = counts.get(n);
      if (cur) cur.count += 1;
      else counts.set(n, { count: 1, flagUrl: flag || null });
    };
    for (const m of liveMatches) add(m.country_name, m.flag_url);
    for (const f of liveFixturesInFeed) add(f.country_name || 'International', f.flag_url);
    const q = sidebarSearch.trim().toLowerCase();
    return [...counts.entries()]
      .filter(([name]) => !q || name.toLowerCase().includes(q))
      .map(([name, v]) => ({ name, count: v.count, flagUrl: v.flagUrl }))
      .sort((a, b) => b.count - a.count);
  }, [liveMatches, liveFixturesInFeed, sidebarSearch]);

  const groupedMatches = useMemo(
    () => groupFixturesByLeague(displayedUpcoming),
    [displayedUpcoming]
  );

  const handleLoadMoreMatches = () => {
    const next = Math.min(visibleLimit + HOME_LOAD_MORE_STEP, filteredTotalCount);
    setVisibleLimit(next);
    if (
      next > loadedForFilterCount &&
      next <= filteredTotalCount &&
      loadedForFilterCount < apiFetchLimit
    ) {
      void loadFixtureList({ background: true });
    }
  };

  const applyFilterCache = useCallback(
    (day: string, country: string, leagueId: number | null = null) => {
      const cached = peekHomeFeedCache(filterCacheKey(day, country, leagueId));
      if (!cached?.fixtures.length) return false;
      setUpcomingFixtures(cached.fixtures);
      setOddsMap((prev) => ({ ...prev, ...cached.odds }));
      if (cached.meta) setFixtureMeta(cached.meta);
      return true;
    },
    []
  );

  const restoreBroaderFeedPool = useCallback(
    (day: string) => {
      if (applyFilterCache(day, 'All countries', null)) return;
      if (day !== 'all') applyFilterCache('all', 'All countries', null);
    },
    [applyFilterCache]
  );

  const selectDay = useCallback((dayId: string) => {
    setOpenSheet(null);
    setSelectedCountry('All countries');
    setVisibleLimit(HOME_INITIAL_VISIBLE);
    setSelectedDay(dayId);
    setListFetchSettled(true);

    const cached = peekHomeFeedCache(filterCacheKey(dayId, 'All countries', null));
    if (cached?.fixtures.length) {
      setUpcomingFixtures(cached.fixtures);
      setOddsMap((prev) => ({ ...prev, ...cached.odds }));
      if (cached.meta) setFixtureMeta(cached.meta);
    } else if (dayId === 'all') {
      const allCached = peekHomeFeedCache(filterCacheKey('all', 'All countries', null));
      if (allCached?.fixtures.length) {
        setUpcomingFixtures(allCached.fixtures);
        setOddsMap((prev) => ({ ...prev, ...allCached.odds }));
        if (allCached.meta) setFixtureMeta(allCached.meta);
      } else {
        void loadFixtureList({ background: true });
      }
    }
  }, [loadFixtureList]);

  const selectCountry = useCallback((name: string) => {
    setOpenSheet(null);
    setVisibleLimit(HOME_INITIAL_VISIBLE);
    setSelectedCountry(name);
    setListFetchSettled(true);

    const cached = peekHomeFeedCache(filterCacheKey(selectedDay, name, null));
    if (cached?.fixtures.length) {
      setUpcomingFixtures(cached.fixtures);
      setOddsMap((prev) => ({ ...prev, ...cached.odds }));
      if (cached.meta) setFixtureMeta(cached.meta);
    }
  }, [selectedDay]);

  return (
    <div className="site-shell overflow-x-hidden bg-[#F8FAFC] min-h-screen text-[#111827] pb-[70px]">
      <AuthModal
        isOpen={isAuthOpen}
        onClose={handleAuthModalClose}
        initialView={authView}
        key={authView}
        onSuccess={(u) => {
          setUser(u);
          const depositQueued = openDepositAfterLoginRef.current;
          if (depositQueued) {
            openDepositAfterLoginRef.current = false;
            primeDeposit();
            setIsDepositOpen(true);
          } else if (u.role === 'admin') {
            setShowAdminDashboard(true);
          }
        }}
      />
      {showAdminDashboard && user && user.role === 'admin' && (
        <AdminDashboard user={user} onLogout={handleLogout} onClose={() => setShowAdminDashboard(false)} />
      )}
      {user ? (
        <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} user={user} />
      ) : null}
      {user ? <TransactionHistory isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} user={user} /> : null}
      <AccountSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} user={user} />
      {user ? (
        <WithdrawalModal isOpen={isWithdrawalOpen} onClose={() => setIsWithdrawalOpen(false)} user={user} />
      ) : null}
      {user ? <BetHistory isOpen={isBetHistoryOpen} onClose={() => setIsBetHistoryOpen(false)} user={user} /> : null}
      <header className="site-header sticky top-0 z-[60] bg-[#FFFFFF] border-b border-[rgba(0,0,0,0.08)]">
        <div className="mx-auto flex h-14 min-w-0 items-center justify-between gap-2 px-2 sm:gap-3 sm:px-4">
          <div className="site-brand min-w-0 shrink-0 truncate text-lg italic tracking-tight text-[#111827] sm:text-xl">
            BETVERS
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-3">
            {user ? (
              <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-3">
                {(() => {
                  const amountStr = Number(user.balance ?? 0).toFixed(2);
                  const { amountPx, currencyPx } = headerBalanceFontSizes(amountStr);
                  return (
                    <div className="flex min-w-0 max-w-[min(11.5rem,calc(100vw-9.5rem))] flex-col items-end leading-none sm:max-w-[min(14rem,calc(100vw-12rem))]">
                      <span className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-[#6B7280] sm:text-[10px]">
                        Balance
                      </span>
                      <span
                        className="max-w-full text-right font-black tabular-nums tracking-tight text-[#111827]"
                        style={{ fontSize: `${amountPx}px`, lineHeight: 1.15 }}
                      >
                        {amountStr}{' '}
                        <span className="font-bold text-[#10B981]" style={{ fontSize: `${currencyPx}px` }}>
                          ETB
                        </span>
                      </span>
                    </div>
                  );
                })()}
                <div className="relative shrink-0">
                  <button onClick={() => setDropdownOpen(!dropdownOpen)} className="w-9 h-9 rounded-full bg-[#F1F5F9] border border-[rgba(0,0,0,0.08)] flex items-center justify-center text-[#111827] hover:bg-[#F3F4F6] transition-colors relative z-10 focus:outline-none focus:ring-2 focus:ring-[#10B981]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span className="absolute -right-1 bottom-1 text-[#6B7280]">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                    </span>
                  </button>
                  {dropdownOpen && (
                    <div className="absolute top-full right-0 mt-3 w-52 bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                      {user.role === 'admin' && (
                        <button 
                          onClick={() => { setShowAdminDashboard(true); setDropdownOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-[#10B981] hover:bg-[rgba(16,185,129,0.08)] font-bold transition-colors border-b border-[rgba(0,0,0,0.08)] flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                          Admin Dashboard
                        </button>
                      )}
                      <button 
                        onPointerEnter={primeDeposit}
                        onClick={() => { openDepositOrAskLogin(); setDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#111827] hover:bg-[#F3F4F6] font-semibold transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-[#6B7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                        Deposit
                      </button>
                      <button 
                        onClick={() => { setIsWithdrawalOpen(true); setDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#111827] hover:bg-[#F3F4F6] font-semibold transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-[#6B7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg>
                        Withdrawal
                      </button>
                      <button 
                        onClick={() => { setIsBetHistoryOpen(true); setDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#111827] hover:bg-[#F3F4F6] font-semibold transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-[#6B7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        Bet History
                      </button>
                      <button 
                        onClick={() => { setIsHistoryOpen(true); setDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#111827] hover:bg-[#F3F4F6] font-semibold transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-[#6B7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        Transaction History
                      </button>
                      <button 
                        onClick={() => { setIsSettingsOpen(true); setDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#111827] hover:bg-[#F3F4F6] font-semibold transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-[#6B7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        Account settings
                      </button>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-[#DC2626] hover:bg-[rgba(239,68,68,0.10)] font-semibold transition-colors border-t border-[rgba(0,0,0,0.08)] mt-1 pt-3 flex items-center gap-2"><svg className="w-4 h-4 text-[#DC2626]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>Log out</button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onPointerEnter={primeDeposit}
                  onClick={() => openDepositOrAskLogin()}
                  className="h-9 shrink-0 rounded-md bg-[#10B981] px-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-[#059669] sm:px-4 sm:text-sm"
                >
                  Deposit
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => { setAuthView('login'); setIsAuthOpen(true); }} className="text-sm font-semibold text-[#4B5563] hover:text-[#111827] px-3 py-1.5 rounded-lg transition-colors border border-[rgba(0,0,0,0.08)] hover:border-[rgba(255,255,255,0.16)]">Log In</button>
                <button onClick={() => { setAuthView('signup'); setIsAuthOpen(true); }} className="bg-[#10B981] hover:bg-[#059669] rounded-lg px-4 py-1.5 text-sm font-bold text-white transition-all active:scale-95" style={{boxShadow:'0 0 16px rgba(16,185,129,0.3)'}}>Sign Up</button>
              </>
            )}
          </div>
        </div>
        

      </header>

      <section className="w-full" aria-label="Promotions">
        <div className="w-full mx-auto px-3 pt-3">
          <div className="relative w-full rounded-[18px] overflow-hidden" style={{aspectRatio:'16/7', maxHeight:'260px', boxShadow:'0 8px 40px rgba(0,0,0,0.5)'}}>
            <img
              key={homePromoBannerIndex}
              src={HOME_PROMO_BANNERS[homePromoBannerIndex]}
              alt=""
              className="absolute inset-0 block h-full w-full object-cover object-center"
              style={{animation:'fadeInBanner 0.5s ease forwards'}}
              loading="eager"
              decoding="async"
              draggable={false}
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{background:'linear-gradient(to top, rgba(9,9,11,0.5) 0%, transparent 50%)'}} />
            {/* Pagination dots over banner */}
            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
              {HOME_PROMO_BANNERS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Show promotion ${i + 1}`}
                  aria-current={i === homePromoBannerIndex ? 'true' : undefined}
                  onClick={() => setHomePromoBannerIndex(i)}
                  className="shrink-0 rounded-full transition-all duration-300"
                  style={i === homePromoBannerIndex ? {width:'20px', height:'6px', background:'#10B981', boxShadow:'0 0 8px rgba(124,255,0,0.6)'} : {width:'6px', height:'6px', background:'rgba(255,255,255,0.4)'}}
                />
              ))}
            </div>
          </div>
        </div>
        <style>{`@keyframes fadeInBanner{from{opacity:0}to{opacity:1}}`}</style>
      </section>

      <main className="overflow-x-hidden p-3 space-y-4">
        {/* Filter Bar with Wrap to prevent clipping */}
        <div className="flex flex-wrap gap-2 py-1 relative z-50">
           <div className="relative">
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 setOpenSheet(openSheet === 'day' ? null : 'day');
               }} 
               className="site-chip rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap flex items-center gap-1"
             >
               {selectedDayLabel} ▾
             </button>
             {openSheet === 'day' && (
               <div className="absolute top-full left-0 mt-1 w-[160px] bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-xl shadow-2xl z-[100] py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {dayOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => selectDay(option.id)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#F1F5F9] transition-colors ${option.id === selectedDay ? 'text-[#10B981]' : 'text-[#111827]'}`}
                    >
                      <span className="text-[12px] font-semibold">{option.label}</span>
                      <span className="text-[10px] opacity-50">{option.count}</span>
                    </button>
                  ))}
               </div>
             )}
           </div>

           <div className="relative">
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 setOpenSheet(openSheet === 'country' ? null : 'country');
               }} 
               className="site-chip rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap flex items-center gap-1"
             >
               {selectedCountry} ▾
             </button>
             {openSheet === 'country' && (
               <div className="absolute top-full left-0 mt-1 w-[180px] bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-xl shadow-2xl z-[100] py-1 max-h-[300px] overflow-y-auto hide-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
                  {countryOptions.map((country) => (
                    <button
                      key={country.name}
                      onClick={() => selectCountry(country.name)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#F1F5F9] transition-colors ${country.name === selectedCountry ? 'text-[#10B981]' : 'text-[#111827]'}`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-[18px] h-[18px] rounded-full overflow-hidden border border-[rgba(0,0,0,0.08)] shrink-0 bg-[#F8FAFC] flex items-center justify-center">
                          {country.flagUrl ? (
                            <img src={country.flagUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-[8px] h-[8px] bg-[#8B949E] rounded-full opacity-50"></div>
                          )}
                        </div>
                        <span className="text-[12px] font-semibold truncate">{country.name}</span>
                      </div>
                      <span className="text-[10px] opacity-50 ml-2">{country.count}</span>
                    </button>
                  ))}
               </div>
             )}
           </div>

           {/* Active filter indicator */}
           {selectedLeagueId !== null ? (
             <button
               onClick={() => { setSelectedLeagueId(null); setSelectedLeagueName(null); }}
               className="flex items-center gap-1.5 bg-[rgba(16,185,129,0.12)] border border-[rgba(124,255,0,0.4)] text-[#10B981] rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap max-w-[160px]"
             >
               <span className="truncate">{selectedLeagueName}</span>
               <span className="text-[#10B981] opacity-70 shrink-0">✕</span>
             </button>
           ) : selectedCountry !== 'All countries' ? (
             <button
               onClick={() => selectCountry('All countries')}
               className="flex items-center gap-1.5 bg-[rgba(16,185,129,0.12)] border border-[rgba(124,255,0,0.4)] text-[#10B981] rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap max-w-[160px]"
             >
               <span className="truncate">{selectedCountry}</span>
               <span className="text-[#10B981] opacity-70 shrink-0">✕</span>
             </button>
           ) : (
             <button 
               onClick={() => selectDay('all')} 
               className="bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.3)] text-[#10B981] rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
             >
               All{filteredTotalCount > 0 ? ` ${filteredTotalCount}` : ''}
             </button>
           )}

           {/* Search Button */}
           <div className="flex items-center gap-2 ml-auto">
             {showMainSearch ? (
               <div className="flex items-center gap-1.5 bg-[#FFFFFF] border border-[#10B981] rounded-full px-3 py-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                 <svg className="w-3.5 h-3.5 text-[#10B981] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                 <input
                   type="text"
                   autoFocus
                   placeholder="Search team, league..."
                   value={mainSearch}
                   onChange={(e) => setMainSearch(e.target.value)}
                   className="bg-transparent text-[#111827] text-xs placeholder-[#8B949E] outline-none w-[130px]"
                 />
                 {mainSearch && (
                   <button onClick={() => setMainSearch('')} className="text-[#6B7280] hover:text-[#111827] shrink-0">✕</button>
                 )}
                 <button onClick={() => { setShowMainSearch(false); setMainSearch(''); }} className="text-[#6B7280] hover:text-[#111827] shrink-0 ml-1">✕</button>
               </div>
             ) : (
               <button
                 onClick={() => setShowMainSearch(true)}
                 className="w-8 h-8 rounded-full bg-[#F1F5F9] border border-[rgba(0,0,0,0.08)] flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
               >
                 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
               </button>
             )}
           </div>
         </div>

        {/* Popular Events Carousel */}
        {featuredForCarousel.length > 0 && !showLiveOnly && selectedLeagueId === null && selectedCountry === 'All countries' && selectedDay === 'all' && (
          <section>
            <div className="flex items-center mb-3 px-1">
              <h2 className="text-[15px] font-bold flex items-center gap-2 text-[#111827]">
                <span className="w-[3px] h-[14px] bg-[#10B981] rounded-sm"></span>
                Popular Events
              </h2>
            </div>
            <div className="relative">
              <button
                onClick={() => scrollCarousel('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/70 border border-[rgba(0,0,0,0.12)]/10 backdrop-blur-sm flex items-center justify-center text-[#111827] hover:bg-black/90 transition-all active:scale-90 shadow-lg"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button
                onClick={() => scrollCarousel('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/70 border border-[rgba(0,0,0,0.12)]/10 backdrop-blur-sm flex items-center justify-center text-[#111827] hover:bg-black/90 transition-all active:scale-90 shadow-lg"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <div ref={carouselRef} className="flex overflow-x-auto hide-scrollbar gap-3 pb-2 -mx-3 px-3">
              {featuredForCarousel.map(({ fixture, odds }) => (
                <MatchDetailLink key={fixture.id} fixture={fixture} odds={odds} className="site-card rounded-xl p-3.5 min-w-[280px] shrink-0 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span
                      className="text-[10px] text-[#10B981] font-bold bg-[rgba(16,185,129,0.10)] px-2 py-1 rounded"
                      suppressHydrationWarning
                    >
                      {formatMatchDate(fixture.match_date)}
                    </span>
                    <span className="text-[10px] text-[#6B7280] uppercase font-bold tracking-tight">
                      {fixture.country_name ? `${fixture.country_name}: ` : ''}{fixture.league_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between my-1">
                    <div className="flex flex-col items-center gap-2 w-[40%] text-center">
                       <div className="w-11 h-11 rounded-full bg-[#F8FAFC] flex items-center justify-center overflow-hidden p-1.5 border border-[rgba(0,0,0,0.08)]">
                         {fixture.home_team_logo ? <img src={fixture.home_team_logo} alt="" className="w-full h-full object-contain" /> : <span className="text-xs font-bold text-[#6B7280]">{getInitials(fixture.home_team_name)}</span>}
                       </div>
                       <span className="text-[11px] font-semibold truncate w-full text-[#111827]">{fixture.home_team_name}</span>
                    </div>
                    <div className="text-[11px] font-black text-[#30363D] italic bg-[#F8FAFC] rounded-full w-6 h-6 flex items-center justify-center">VS</div>
                    <div className="flex flex-col items-center gap-2 w-[40%] text-center">
                       <div className="w-11 h-11 rounded-full bg-[#F8FAFC] flex items-center justify-center overflow-hidden p-1.5 border border-[rgba(0,0,0,0.08)]">
                         {fixture.away_team_logo ? <img src={fixture.away_team_logo} alt="" className="w-full h-full object-contain" /> : <span className="text-xs font-bold text-[#6B7280]">{getInitials(fixture.away_team_name)}</span>}
                       </div>
                       <span className="text-[11px] font-semibold truncate w-full text-[#111827]">{fixture.away_team_name}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-auto">
                     {(() => {
                       const isFinished = isMatchClosedForBetting(fixture);
                       if (odds && odds.length > 0) {
                         return getMatchWinnerDisplayOdds(odds).map((odd) => {
                           const betId = `${fixture.id}-Match Winner-${odd.selection}`;
                           const selected = isSelected(betId);
                           return (
                             <button 
                               key={odd.id} 
                               onClick={(e) => {
                                 e.preventDefault();
                                 e.stopPropagation();
                                 if (isFinished) return;
                                 addBet({
                                   id: betId,
                                   fixtureId: fixture.id,
                                   homeTeam: fixture.home_team_name,
                                   awayTeam: fixture.away_team_name,
                                   league: fixture.league_name,
                                   market: 'Match Winner',
                                   selection: getSelectionName(odd.selection, fixture),
                                   odds: Number(odd.odd_value),
                                 });
                               }}
                               className={`champx-odds-btn flex-col items-center justify-center ${isFinished ? 'opacity-50 cursor-not-allowed' : selected ? 'bg-[#10B981] shadow-inner text-[#111827]' : 'hover:bg-[#F3F4F6] transition-colors'}`}>
                               <span className={`label ${selected ? 'text-[#111827]/80' : ''}`}>{odd.selection}</span>
                               <span className={`value ${selected ? 'text-[#111827]' : 'text-[#10B981]'}`}>{isFinished ? 'CLOSED' : odd.odd_value}</span>
                             </button>
                           );
                         });
                       }
                       return (
                         <div className="champx-odds-btn flex-row hover:bg-[#F3F4F6] transition-colors">
                            <span className="value text-[#10B981]">View Markets +</span>
                         </div>
                       );
                     })()}
                  </div>
                </MatchDetailLink>
              ))}
            </div>  {/* closes the scrollable div */}
            </div>  {/* closes the relative wrapper */}
          </section>
        )}

         {/* Match List Grouped by League */}
         {showLiveOnly && (
           <div className="flex items-center gap-2 px-1 py-2">
             <span className="flex items-center gap-1.5 text-[#16A34A] font-bold text-[13px]">
               <span className="relative flex h-2.5 w-2.5">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#16A34A]"></span>
               </span>
               LIVE NOW — {filteredFixtures.length} match{filteredFixtures.length !== 1 ? 'es' : ''}
             </span>
             <button
               onClick={() => setShowLiveOnly(false)}
               className="ml-auto text-[10px] text-[#6B7280] hover:text-[#111827] border border-[rgba(0,0,0,0.08)] rounded-full px-2 py-0.5 transition-colors"
             >
               Show All
             </button>
           </div>
         )}
         <section className="space-y-4 pb-4" suppressHydrationWarning>
            {groupedMatches.length > 0 ? groupedMatches.map(([leagueName, matches]) => {
              const isCollapsed = collapsedLeagues.has(leagueName);
              const firstFixture = matches[0];
              const leagueIcon = firstFixture.league_logo || firstFixture.flag_url;
              
              return (
                <div key={leagueName} className="rounded-xl overflow-hidden border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] shadow-sm">
                  <div 
                    onClick={() => toggleLeague(leagueName)}
                    className="bg-[#10B981] px-3.5 py-2.5 flex items-center justify-between text-[#111827] font-bold text-[13px] cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      {leagueIcon ? (
                        <div className="w-[20px] h-[20px] rounded-full overflow-hidden border border-[rgba(0,0,0,0.12)]/40 shadow-sm">
                          <img src={leagueIcon} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-[rgba(0,0,0,0.12)] flex items-center justify-center bg-transparent">
                          <div className="w-[8px] h-[8px] bg-[#FFFFFF] rounded-full"></div>
                        </div>
                      )}
                      <span className="truncate uppercase tracking-tight">{leagueName}</span>
                    </div>
                    <svg className={`w-4 h-4 text-[#111827] opacity-90 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
                  </div>
                  {!isCollapsed && (
                    <div className="bg-[#E8EDF5] p-[2px] flex flex-col gap-[2px]">
                      {matches.map((fixture) => {
                        const isLive = liveFixtureIds.has(fixture.id);
                                           const renderStatus = () => {
                          const status = fixture.status?.toUpperCase() || 'NS';
                          if (status === 'NS' || status === 'TBD') {
                            return (
                              <>
                                <span className="text-[11px] font-black text-[#111827]">
                                  {isMounted ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(fixture.match_date)) : ''}
                                </span>
                                <span className="text-[9px] text-[#4B5563] font-bold mt-0.5">
                                  {isMounted ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit' }).format(new Date(fixture.match_date)) : ''}
                                </span>
                              </>
                            );
                          }
                          
                          if (isMatchClosedForBetting(fixture)) {
                            return (
                              <span className="text-[9px] font-bold text-[#4B5563] bg-[#E2E8F0] px-1 py-0.5 rounded tracking-wide text-center w-full">
                                Finished
                              </span>
                            );
                          }

                          if (['PST', 'CANC', 'ABD', 'SUSP'].includes(status)) {
                            const label = status === 'PST' ? 'Postponed' : status === 'CANC' ? 'Cancelled' : status === 'ABD' ? 'Abandoned' : 'Suspended';
                            return (
                              <span className="text-[8px] font-bold text-[#DC2626] bg-[rgba(239,68,68,0.10)] px-1 py-0.5 rounded uppercase tracking-wider text-center w-full">
                                {label}
                              </span>
                            );
                          }

                          if (isLive || ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(status)) {
                            const displayStatus = status === 'HT' ? 'HT' : status === '1H' ? '1st' : status === '2H' ? '2nd' : status;
                            return (
                              <div className="flex flex-col items-center justify-center">
                                <span className="text-[10px] font-black text-[#16A34A] leading-none mb-1 animate-pulse">
                                  {displayStatus}
                                </span>
                                <span className="text-[10px] font-black text-[#16A34A] leading-none">
                                  {fixture.minute ? `${fixture.minute}'` : 'LIVE'}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <span className="text-[8px] font-bold text-[#6B7280] bg-[#F3F4F6] px-1 py-0.5 rounded uppercase tracking-wider text-center w-full">
                              {status}
                            </span>
                          );
                        };

                        const isFinished = isMatchClosedForBetting(fixture);
                        const isLiveStatus =
                          ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(fixture.status?.toUpperCase() || '') &&
                          !isFinished;
                        const shouldShowScore = isLive || isLiveStatus || isFinished;

                        return (
                          <MatchDetailLink key={fixture.id} fixture={fixture} odds={oddsMap[fixture.id] ?? []} className="block p-3 bg-[#E8EDF5] hover:bg-[#DDE4EE] transition-colors rounded-[5px]">
                            <div className="flex gap-3 mb-2.5">
                               <div className="flex flex-col items-center justify-center w-[52px] min-w-[52px] h-[48px] bg-[#FFFFFF] rounded-lg shadow-sm border border-[rgba(0,0,0,0.08)]">
                                 {renderStatus()}
                               </div>
                               <div className="flex flex-col gap-1.5 w-full justify-center">
                                  <div className="flex items-center gap-2.5">
                                    {fixture.home_team_logo ? <img src={fixture.home_team_logo} className="w-4.5 h-4.5 object-contain" alt="" /> : <div className="w-4.5 h-4.5 bg-[#FFFFFF] rounded-sm flex items-center justify-center text-[8px] text-white font-bold border border-[rgba(0,0,0,0.08)]">{getInitials(fixture.home_team_name)}</div>}
                                    <span className="text-[14px] font-bold text-[#111827] truncate tracking-tight">{fixture.home_team_name}</span>
                                    {shouldShowScore && <span className={`ml-auto font-black text-[14px] ${isLiveStatus ? 'text-[#16A34A]' : 'text-[#111827]'}`}>{fixture.home_score}</span>}
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    {fixture.away_team_logo ? <img src={fixture.away_team_logo} className="w-4.5 h-4.5 object-contain" alt="" /> : <div className="w-4.5 h-4.5 bg-[#FFFFFF] rounded-sm flex items-center justify-center text-[8px] text-white font-bold border border-[rgba(0,0,0,0.08)]">{getInitials(fixture.away_team_name)}</div>}
                                    <span className="text-[14px] font-bold text-[#111827] truncate tracking-tight">{fixture.away_team_name}</span>
                                    {shouldShowScore && <span className={`ml-auto font-black text-[14px] ${isLiveStatus ? 'text-[#16A34A]' : 'text-[#111827]'}`}>{fixture.away_score}</span>}
                                  </div>
                               </div>
                            </div>
                             {(() => {
                               const isFinished = isMatchClosedForBetting(fixture);
                               const rowOdds = oddsMap[fixture.id];
                               const displayOdds = getMatchWinnerDisplayOdds(rowOdds || []);
                               if (displayOdds.length === 0 && !isFinished) {
                                 return (
                                   <div className="flex gap-1.5 mt-2">
                                     {[0, 1, 2].map((i) => (
                                       <div
                                         key={i}
                                         className="flex-1 rounded-md py-2 bg-[#D3DBE8] animate-pulse"
                                       />
                                     ))}
                                   </div>
                                 );
                               }
                               if (displayOdds.length > 0) {
                                 return (
                                   <div className="flex gap-1.5 mt-2">
                                     {displayOdds.map((odd) => {
                                       const betId = `${fixture.id}-Match Winner-${odd.selection}`;
                                       const selected = isSelected(betId);
                                       return (
                                         <button
                                           key={odd.id}
                                           onClick={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             if (isFinished) return;
                                             addBet({
                                               id: betId,
                                               fixtureId: fixture.id,
                                               homeTeam: fixture.home_team_name,
                                               awayTeam: fixture.away_team_name,
                                               league: fixture.league_name,
                                               market: 'Match Winner',
                                               selection: getSelectionName(odd.selection, fixture),
                                               odds: Number(odd.odd_value),
                                               homeLogo: fixture.home_team_logo,
                                               awayLogo: fixture.away_team_logo,
                                             });
                                           }}
                                           className={`flex-1 rounded-md py-2 flex items-center justify-center transition-all ${
                                             isFinished
                                               ? 'bg-[#E2E8F0]'
                                               : selected
                                                 ? 'bg-[#10B981] shadow-inner text-[#111827]'
                                                 : 'bg-[#D3DBE8] hover:bg-[#C9D2E0] shadow-inner text-[#111827]'
                                           }`}
                                         >
                                           {selected && (
                                             <svg
                                               className="w-3.5 h-3.5 text-[#111827] mr-1.5"
                                               viewBox="0 0 24 24"
                                               fill="none"
                                               stroke="currentColor"
                                               strokeWidth="3"
                                             >
                                               <polyline points="20 6 9 17 4 12" />
                                             </svg>
                                           )}
                                           <span
                                             className={`text-[13px] font-black ${isFinished ? 'text-[#6B7280]' : selected ? 'text-[#111827]' : ''}`}
                                           >
                                             {isFinished ? 'CLOSED' : Number(odd.odd_value).toFixed(2)}
                                           </span>
                                         </button>
                                       );
                                     })}
                                   </div>
                                 );
                               }
                               if (!isFinished) {
                                 return null;
                               }
                               return (
                                 <div className="flex gap-1.5 mt-2">
                                   <div className="flex-1 rounded-md py-2 text-center text-[11px] font-bold text-[#6B7280] bg-[#E2E8F0]">
                                     CLOSED
                                   </div>
                                 </div>
                               );
                             })()}
                           </MatchDetailLink>
                         )
                      })}
                    </div>
                  )}
                </div>
              );
            }) : listFetchSettled && displayedUpcoming.length === 0 ? (
             <div className="site-card rounded-xl p-8 text-center flex flex-col items-center justify-center border border-[rgba(0,0,0,0.08)]">
               <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B949E" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
               </div>
               <p className="text-sm font-semibold text-[#111827]">No matches with odds right now</p>
               <p className="text-xs text-[#6B7280] mt-1">Try another day or filter, or check back after the server sync finishes.</p>
             </div>
           ) : null}
            {hasMoreMatches && groupedMatches.length > 0 && (
              <div className="flex justify-center pt-4 pb-2">
                <button
                  type="button"
                  onClick={handleLoadMoreMatches}
                  className="rounded-full border border-[#10B981] bg-[rgba(16,185,129,0.10)] px-8 py-2.5 text-sm font-bold text-[#10B981] transition-colors hover:bg-[rgba(16,185,129,0.2)]"
                >
                  See more
                </button>
              </div>
            )}
        </section>
      </main>

      <TelegramSupportFab />
      <SupportChat />

      {/* Fixed Bottom Navigation */}
      <nav className="champx-bottom-nav">
        <button 
          onClick={() => {
            setSidebarFilterMode('all');
            setShowLiveOnly(false);
            setIsSidebarOpen(prev => !prev);
          }}
          className={`champx-nav-item ${!showLiveOnly && isSidebarOpen && sidebarFilterMode === 'all' ? 'active' : ''}`}
        >
          <svg className="champx-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path><path d="M2 12h20"></path></svg>
          <span className="font-semibold">Sport</span>
        </button>
        <button 
          onClick={() => {
            setSidebarFilterMode('live');
            setShowLiveOnly(true);
            setSelectedLeagueId(null);
            setSelectedLeagueName(null);
            setSelectedCountry('All countries');
            setIsSidebarOpen(prev => !prev);
          }}
          className={`champx-nav-item ${showLiveOnly ? 'active' : ''}`}
        >
          <svg className="champx-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
          <span className="font-semibold">Live</span>
        </button>
        <button
          type="button"
          onPointerEnter={primeDeposit}
          onClick={() => openDepositOrAskLogin()}
          className="champx-nav-item relative"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all" style={{background:'linear-gradient(135deg,#10B981,#059669)',boxShadow:'0 0 16px rgba(124,255,0,0.4)'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
          </div>
          <span className="font-bold text-[#10B981] text-[10px]">Deposit</span>
        </button>
        <Link href="/check-ticket" className="champx-nav-item">
          <svg className="champx-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span className="font-semibold">Check</span>
        </Link>
        <BetSlipDrawer
          onAuthTrigger={() => {
            setAuthView('login');
            setIsAuthOpen(true);
          }}
          onBetPlaced={() => setIsBetHistoryOpen(true)}
        />
      </nav>
      
      {/* Sports Sidebar */}
      <div className={`fixed inset-0 z-[100] transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute inset-0 bg-black/60" onClick={() => setIsSidebarOpen(false)}></div>
        <div className="absolute top-0 left-0 bottom-0 w-[280px] bg-[#F8FAFC] border-r border-[rgba(0,0,0,0.08)] flex flex-col shadow-2xl">
          <div className="h-14 border-b border-[rgba(0,0,0,0.08)] flex items-center justify-between px-4 bg-[#FFFFFF]">
            <span className="font-bold text-[#10B981]">{sidebarFilterMode === 'live' ? 'LIVE MENU' : 'SPORTS MENU'}</span>
            <button onClick={() => setIsSidebarOpen(false)} className="text-[#6B7280] hover:text-[#111827]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          <div className="border-b border-[rgba(0,0,0,0.08)] p-3 space-y-3 bg-[#F8FAFC]">
            {/* Search Bar */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search" 
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-lg py-2.5 pl-10 pr-3 text-sm text-[#111827] placeholder-[#8B949E] focus:outline-none focus:border-[#10B981] transition-colors shadow-inner"
              />
              <svg className="absolute left-3.5 top-3 w-4 h-4 text-[#6B7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto hide-scrollbar p-3 pt-4 space-y-6">
            {/* Top Leagues Section */}
            {(() => {
              const filteredTopLeagues =
                sidebarFilterMode === 'live' ? liveSidebarLeagues : sportSidebarLeagues;

              return (
                <section>
                  <button 
                    onClick={() => setIsTopLeaguesExpanded(!isTopLeaguesExpanded)}
                    className="w-full flex items-center justify-between px-1 mb-2 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-[#10B981] flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 1L9 9H1L7 14L5 22L12 17L19 22L17 14L23 9H15L12 1Z"/></svg>
                      </div>
                      <h3 className="text-[13px] font-bold text-[#111827] uppercase tracking-tight">
                        {sidebarFilterMode === 'live' ? 'Live Leagues' : 'Top Leagues'}
                      </h3>
                    </div>
                    <svg className={`w-4 h-4 text-[#6B7280] transition-transform duration-200 ${isTopLeaguesExpanded ? '' : '-rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                  </button>

                  {isTopLeaguesExpanded && (
                    <div className="space-y-0.5 ml-2.5 border-l border-[rgba(0,0,0,0.08)]">
                      {filteredTopLeagues.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-[#6B7280]">
                          {sidebarFilterMode === 'live'
                            ? 'No live leagues right now.'
                            : 'No leagues yet — try a country below.'}
                        </p>
                      ) : null}
                      {filteredTopLeagues.slice(0, 15).map((league) => (
                        <button 
                          key={league.api_league_id}
                          onClick={() => {
                            setSelectedLeagueId(league.api_league_id);
                            setSelectedLeagueName(league.name);
                            setSelectedCountry('All countries');
                            setIsSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group relative ${selectedLeagueId === league.api_league_id ? 'bg-[#10B981]/10' : 'hover:bg-[#F1F5F9]'}`}
                        >
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-px bg-[#F3F4F6]"></div>
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-[#FFFFFF]/10 flex items-center justify-center p-0.5 border border-[rgba(0,0,0,0.08)] ml-2">
                            {league.logo ? <img src={league.logo} alt="" className="w-full h-full object-contain" /> : <div className="w-2 h-2 bg-[#10B981] rounded-full"></div>}
                          </div>
                          <span className={`text-[13px] font-medium transition-colors truncate ${selectedLeagueId === league.api_league_id ? 'text-[#10B981]' : 'text-[#4B5563] group-hover:text-[#111827]'}`}>{league.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })()}

            {/* Countries Section */}
            {(() => {
              const filteredCountries =
                sidebarFilterMode === 'live' ? liveSidebarCountries : sportSidebarCountries;

              return (
                <section>
                  <button 
                    onClick={() => setIsCountriesExpanded(!isCountriesExpanded)}
                    className="w-full flex items-center justify-between px-1 mb-2 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-[#F1F5F9] flex items-center justify-center border border-[rgba(0,0,0,0.08)]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#8B949E"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                      </div>
                      <h3 className="text-[13px] font-bold text-[#111827] uppercase tracking-tight">Countries</h3>
                    </div>
                    <svg className={`w-4 h-4 text-[#6B7280] transition-transform duration-200 ${isCountriesExpanded ? '' : '-rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                  </button>

                  {isCountriesExpanded && (
                    <div className="space-y-0.5 ml-2.5 border-l border-[rgba(0,0,0,0.08)]">
                      {filteredCountries.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-[#6B7280]">
                          {sidebarFilterMode === 'live'
                            ? 'No live matches by country right now.'
                            : 'No countries loaded yet.'}
                        </p>
                      ) : null}
                      {filteredCountries.map((country) => (
                        <button 
                          key={country.name}
                          onClick={() => {
                            selectCountry(country.name);
                            setIsSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group relative ${selectedCountry === country.name && selectedLeagueId === null ? 'bg-[#10B981]/10' : 'hover:bg-[#F1F5F9]'}`}
                        >
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-px bg-[#F3F4F6]"></div>
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-[#FFFFFF] flex items-center justify-center p-0.5 border border-[rgba(0,0,0,0.08)] ml-2 shrink-0">
                            {country.flagUrl ? (
                              <img src={country.flagUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-2 h-2 bg-[#8B949E] rounded-full opacity-30"></div>
                            )}
                          </div>
                          <div className="flex-1 flex items-center justify-between min-w-0">
                            <span className={`text-[13px] font-semibold truncate ${selectedCountry === country.name ? 'text-[#10B981]' : 'text-[#4B5563] group-hover:text-[#111827]'}`}>{country.name}</span>
                            <span className={`text-[10px] ml-2 shrink-0 font-bold ${sidebarFilterMode === 'live' ? 'text-[#16A34A]' : 'text-[#6B7280]'}`}>
                              {'count' in country ? country.count : 0}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })()}
          </div>
        </div>
      </div>

    </div>
  );
}
