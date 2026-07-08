import { resolveApiUrl } from './api-base';
import { fetchWithTimeout } from './fetch-with-timeout';
import { getPublicApiBaseUrl } from './public-api-url';

const API_URL = getPublicApiBaseUrl();

/** Max matches in the 7-day window (50/day × 7 days). */
export const FIXTURE_LIST_LIMIT = 350;

async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const url = resolveApiUrl(endpoint);
  const res = await fetchWithTimeout(url, {
    headers: { 'Content-Type': 'application/json' },
    cache: typeof window !== 'undefined' ? 'default' : 'no-store',
    timeoutMs: options?.timeoutMs ?? 8_000,
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface League {
  id: number;
  country_id: number;
  name: string;
  logo: string;
  type: string;
  season_current: string;
  api_league_id: number;
  is_top: boolean;
  top_rank: number;
  country_name: string;
  flag_url: string;
}

export type FixtureMeta = {
  total: number;
  days: { id: string; count: number }[];
  countries: { name: string; count: number; flag_url: string | null }[];
};

export type FixtureDayCounts = {
  total: number;
  days: { id: string; count: number }[];
  countries?: { name: string; count: number; flag_url: string | null }[];
};

export type HomeFeedResponse = {
  fixtures: Fixture[];
  odds: Record<string, Odd[]>;
};

export type HomeBootstrapResponse = HomeFeedResponse & {
  meta: FixtureMeta;
  topLeagues: League[];
};

export interface Fixture {
  id: number;
  league_id: number;
  home_team_id: number;
  away_team_id: number;
  match_date: string;
  kickoff_at?: string;
  status: string;
  elapsed?: number | null;
  minute: number;
  home_score: number;
  away_score: number;
  home_goals?: number | null;
  away_goals?: number | null;
  home_team_name: string;
  home_team_logo: string;
  away_team_name: string;
  away_team_logo: string;
  home_odds?: number | null;
  draw_odds?: number | null;
  away_odds?: number | null;
  league_name: string;
  league_logo: string;
  api_league_id: number;
  country_name: string;
  flag_url: string;
  venue_name: string;
  venue_city: string;
  referee: string;
}


export interface LiveMatch {
  id: number;
  fixture_id: number;
  status: string;
  minute: number;
  home_score: number;
  away_score: number;
  is_active: boolean;
  match_date: string;
  home_team_name: string;
  home_team_logo: string;
  away_team_name: string;
  away_team_logo: string;
  league_name: string;
  league_logo?: string;
  api_league_id: number;
  country_name: string;
  flag_url?: string;
}

export interface Team {
  id: number;
  name: string;
  logo: string;
  founded: number;
  league_name: string;
  country_name: string;
}

export interface Odd {
  id: number;
  fixture_id: number;
  bookmaker_name: string;
  bookmaker_logo: string;
  market_name: string;
  market_key: string;
  selection: string;
  odd_value: number;
}

export type TicketByCodeSelection = {
  fixture_id: number | null;
  selection: string;
  odd: number;
  home_team: string;
  away_team: string;
  home_logo: string;
  away_logo: string;
  league_name: string;
  market_name: string;
  fixture_status: string;
  manual_kickoff_at?: string | null;
  manual_end_at?: string | null;
  is_manual?: boolean;
  blocked: boolean;
};

export type TicketByCodeResponse = {
  ticket_code: string;
  selections: TicketByCodeSelection[];
  can_place: boolean;
  message: string | null;
};

export type TicketCheckSelection = {
  fixture_id: number | null;
  selection: string;
  odd: number | string;
  result: string | null;
  home_team: string;
  away_team: string;
  home_logo: string;
  away_logo: string;
  league_name: string;
  market_name: string;
  kickoff_at?: string | null;
};

export type TicketCheckResponse = {
  id: number;
  ticket_code: string | null;
  stake: string | number;
  total_odds: string | number;
  possible_win: string | number;
  status: 'pending' | 'won' | 'lost' | string;
  created_at: string;
  selections: TicketCheckSelection[];
};

/** Admin manual preset ticket list row (matches GET /admin/manual-tickets). */
export type AdminManualTicketRow = {
  id: number;
  ticket_code: string;
  total_odds: number;
  status: string;
  created_at: string;
  selections: Array<{
    selection: string;
    odd: number;
    result: string | null;
    home_team: string;
    away_team: string;
    league_name: string;
    market_name: string;
    manual_kickoff_at: string;
    manual_end_at: string;
  }>;
};




export const api = {
  getLeagues: async () => {
    try {
      return await fetchAPI<League[]>('/leagues');
    } catch {
      return [];
    }
  },
  getTopLeagues: async () => {
    try {
      return await fetchAPI<League[]>('/leagues/top');
    } catch {
      return [];
    }
  },
  getLeague: (id: number) => fetchAPI<League>(`/leagues/${id}`),

  getFixtures: async (params?: {
    league_id?: number;
    api_league_id?: number;
    country?: string;
    day?: string;
    status?: string;
    date?: string;
    page?: number;
    limit?: number;
    has_odds?: boolean;
  }) => {
    const search = new URLSearchParams();
    if (params?.league_id) search.set('league_id', String(params.league_id));
    if (params?.api_league_id) search.set('api_league_id', String(params.api_league_id));
    if (params?.country) search.set('country', params.country);
    if (params?.day) search.set('day', params.day);
    if (params?.status) search.set('status', params.status);
    if (params?.date) search.set('date', params.date);
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.has_odds) search.set('has_odds', '1');
    const qs = search.toString();
    const path = `/fixtures${qs ? `?${qs}` : ''}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fetchAPI<Fixture[]>(path, { timeoutMs: 60_000 });
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }
    return [];
  },
  getHomeFeed: async (params?: {
    limit?: number;
    day?: string;
    country?: string;
    api_league_id?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.day) search.set('day', params.day);
    if (params?.country) search.set('country', params.country);
    if (params?.api_league_id) search.set('api_league_id', String(params.api_league_id));
    const qs = search.toString();
    const path = `/fixtures/home${qs ? `?${qs}` : ''}`;
    try {
      const raw = await fetchAPI<HomeFeedResponse>(path, { timeoutMs: 8_000 });
      const fixtures = Array.isArray(raw?.fixtures) ? raw.fixtures : [];
      const odds = raw?.odds && typeof raw.odds === 'object' ? raw.odds : {};
      const oddsOut: Record<number, Odd[]> = {};
      for (const [key, rows] of Object.entries(odds)) {
        const id = parseInt(key, 10);
        if (Number.isFinite(id) && Array.isArray(rows)) oddsOut[id] = rows;
      }
      return { fixtures, odds: oddsOut };
    } catch {
      return { fixtures: [] as Fixture[], odds: {} as Record<number, Odd[]> };
    }
  },
  /** Landing page bundle: matches + 7-day meta + countries + top leagues (one call). */
  getHomeBootstrap: async (limit?: number) => {
    const search = new URLSearchParams();
    if (limit) search.set('limit', String(limit));
    const qs = search.toString();
    const path = `/fixtures/bootstrap${qs ? `?${qs}` : ''}`;
    try {
      const raw = await fetchAPI<HomeBootstrapResponse>(path, { timeoutMs: 12_000 });
      const fixtures = Array.isArray(raw?.fixtures) ? raw.fixtures : [];
      const odds = raw?.odds && typeof raw.odds === 'object' ? raw.odds : {};
      const oddsOut: Record<number, Odd[]> = {};
      for (const [key, rows] of Object.entries(odds)) {
        const id = parseInt(key, 10);
        if (Number.isFinite(id) && Array.isArray(rows)) oddsOut[id] = rows;
      }
      return {
        fixtures,
        odds: oddsOut,
        meta: raw?.meta ?? null,
        topLeagues: Array.isArray(raw?.topLeagues) ? raw.topLeagues : [],
      };
    } catch {
      return {
        fixtures: [] as Fixture[],
        odds: {} as Record<number, Odd[]>,
        meta: null,
        topLeagues: [] as League[],
      };
    }
  },
  /** Fast DB counts for day dropdown (target under 5s). */
  getFixturesDayCounts: async () => {
    try {
      return await fetchAPI<FixtureDayCounts>('/fixtures/meta/summary?has_odds=1', {
        timeoutMs: 5_000,
      });
    } catch {
      return null;
    }
  },
  getFixturesMeta: async (params?: { has_odds?: boolean; day?: string }) => {
    const search = new URLSearchParams();
    if (params?.has_odds) search.set('has_odds', '1');
    if (params?.day) search.set('day', params.day);
    const qs = search.toString();
    try {
      return await fetchAPI<FixtureMeta>(`/fixtures/meta${qs ? `?${qs}` : ''}`, { timeoutMs: 10_000 });
    } catch {
      return null;
    }
  },
  getFixture: async (id: number, opts?: { refresh?: boolean }) => {
    const bust = opts?.refresh ? `?_=${Date.now()}` : '';
    try {
      return await fetchAPI<Fixture>(`/fixtures/${id}${bust}`, {
        timeoutMs: 12_000,
        cache: opts?.refresh ? 'no-store' : undefined,
      });
    } catch {
      return null;
    }
  },
  getLiveFixtures: () => fetchAPI<Fixture[]>('/fixtures/live'),

  getLiveMatches: async () => {
    try {
      return await fetchAPI<LiveMatch[]>(`/live/matches?_=${Date.now()}`, {
        cache: 'no-store',
      });
    } catch {
      return [];
    }
  },

  getTeams: (leagueId?: number) => {
    const qs = leagueId ? `?league_id=${leagueId}` : '';
    return fetchAPI<Team[]>(`/teams${qs}`);
  },
  getTeam: (id: number) => fetchAPI<Team>(`/teams/${id}`),

  getOdds: async (fixtureId: number, opts?: { refresh?: boolean }) => {
    const bust = opts?.refresh ? `?_=${Date.now()}` : '';
    try {
      const rows = await fetchAPI<Odd[]>(`/odds/fixture/${fixtureId}${bust}`, {
        timeoutMs: 12_000,
        cache: opts?.refresh ? 'no-store' : undefined,
      });
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  },

  /** One request for up to 120 fixtures (server cap). */
  getOddsBulk: async (fixtureIds: number[]): Promise<Record<number, Odd[]>> => {
    const ids = [...new Set(fixtureIds.filter((id) => Number.isFinite(id) && id > 0))].slice(0, 120);
    if (ids.length === 0) return {};
    const qs = `ids=${ids.join(',')}&_=${Date.now()}`;
    const raw = await fetchAPI<Record<string, Odd[]>>(`/odds/bulk?${qs}`, {
      timeoutMs: 45_000,
      cache: 'no-store',
    });
    const out: Record<number, Odd[]> = {};
    for (const [key, rows] of Object.entries(raw || {})) {
      const id = parseInt(key, 10);
      if (Number.isFinite(id) && Array.isArray(rows)) out[id] = rows;
    }
    return out;
  },

  /** Load odds for many fixtures using chunked bulk requests (home list up to FIXTURE_LIST_LIMIT). */
  getOddsBulkAll: async (fixtureIds: number[]): Promise<Record<number, Odd[]>> => {
    const ids = [...new Set(fixtureIds.filter((id) => Number.isFinite(id) && id > 0))].slice(
      0,
      FIXTURE_LIST_LIMIT
    );
    if (ids.length === 0) return {};
    const merged: Record<number, Odd[]> = {};
    const CHUNK = 120;
    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      chunks.push(ids.slice(i, i + CHUNK));
    }
    const parts = await Promise.all(
      chunks.map((chunk) => api.getOddsBulk(chunk).catch(() => ({} as Record<number, Odd[]>)))
    );
    for (const part of parts) {
      Object.assign(merged, part);
    }
    return merged;
  },

  getWalletBalance: async (): Promise<{ balance: number; currency: string }> => {
    if (typeof window === 'undefined') {
      throw new Error('Wallet is only available in the browser');
    }
    const token = localStorage.getItem('token');
    const res = await fetchWithTimeout(`${API_URL}/betting/wallet`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
      timeoutMs: 15_000,
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error((data.message as string) || `Could not load wallet (${res.status})`);
    }
    return {
      balance: parseFloat(String(data.balance ?? 0)),
      currency: (data.currency as string) || 'ETB',
    };
  },

  getTicketByCode: async (rawCode: string): Promise<TicketByCodeResponse> => {
    const normalized = String(rawCode || '')
      .trim()
      .replace(/^#/i, '')
      .replace(/^code:\s*/i, '')
      .trim();
    if (!normalized) {
      throw new Error('Enter a ticket code');
    }
    const res = await fetchWithTimeout(`${API_URL}/betting/ticket-code/${encodeURIComponent(normalized)}`, {
      cache: 'no-store',
      timeoutMs: 20_000,
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error((data.message as string) || `Lookup failed (${res.status})`);
    }
    return data as unknown as TicketByCodeResponse;
  },

  getTicketCheckByCode: async (rawCode: string): Promise<TicketCheckResponse> => {
    const normalized = String(rawCode || '')
      .trim()
      .replace(/^#/i, '')
      .replace(/^code:\s*/i, '')
      .trim()
      .toUpperCase();
    if (!normalized) {
      throw new Error('Enter a ticket code');
    }
    const res = await fetchWithTimeout(`${API_URL}/betting/ticket-check/${encodeURIComponent(normalized)}`, {
      cache: 'no-store',
      timeoutMs: 20_000,
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error((data.message as string) || `Lookup failed (${res.status})`);
    }
    return data as unknown as TicketCheckResponse;
  },

  getBetHistory: async (userId: number) => {
    if (typeof window === 'undefined') {
      return [];
    }
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Login required to view bet history');
    }
    const res = await fetchWithTimeout(`${API_URL}/betting/history/${userId}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      timeoutMs: 20_000,
    });
    const text = await res.text();
    let parsed: unknown = [];
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {};
      }
    }
    if (!res.ok) {
      const body =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      const msg =
        (typeof body.message === 'string' && body.message) ||
        (typeof body.error === 'string' && body.error) ||
        `Could not load bet history (${res.status})`;
      throw new Error(msg);
    }
    return Array.isArray(parsed) ? parsed : [];
  },

  placeBet: async (payload: {
    user_id: number;
    stake: number;
    /** Only true when slip was loaded from a ticket code; then server blocks non–pre-match legs. */
    enforce_prematch_from_ticket?: boolean;
    selections: Array<{
      fixture_id: number | null;
      market_id: number | null;
      selection: string;
      odd: number;
      home_team: string;
      away_team: string;
      home_logo?: string;
      away_logo?: string;
      league_name: string;
      market_name: string;
      manual_kickoff_at?: string;
      manual_end_at?: string;
    }>;
  }) => {
    if (typeof window === 'undefined') {
      throw new Error('placeBet is only available in the browser');
    }
    const token = localStorage.getItem('token');
    const res = await fetchWithTimeout(`${API_URL}/betting/bet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      timeoutMs: 30_000,
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error((data.message as string) || `Bet failed (${res.status})`);
    }
    return data as Record<string, unknown> & {
      balance?: number;
      currency?: string;
      ticket_code?: string | null;
    };
  },

  refreshAdminManualTicketMatches: async () => {
    if (typeof window === 'undefined') throw new Error('Admin API is browser-only');
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/admin/manual-ticket-matches/refresh`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: 'no-store',
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error((data.message as string) || `Refresh failed (${res.status})`);
    return data as { message: string; saved: number };
  },

  getAdminManualTicketClubs: async (date?: string) => {
    if (typeof window === 'undefined') throw new Error('Admin API is browser-only');
    const token = localStorage.getItem('token');
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await fetch(`${API_URL}/admin/manual-ticket-clubs${qs}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: 'no-store',
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error((data.message as string) || `Clubs failed (${res.status})`);
    return data as {
      date: string;
      matches?: any[];
      clubs: Array<{
        id: string;
        name: string;
        logo: string | null;
        league_name: string | null;
        country_code: string | null;
        country_name: string | null;
      }>;
      small_leagues: Array<{
        id: number;
        league_name: string | null;
        country_code: string | null;
        country_name: string | null;
      }>;
    };
  },

  createAdminManualTicket: async (
    matches: Array<{
      home_team_id: string;
      away_team_id: string;
      home_team_name?: string;
      away_team_name?: string;
      home_team_logo?: string | null;
      away_team_logo?: string | null;
      league_name?: string;
      selection: string;
      odd: number;
      market_name?: string;
      manual_kickoff_at: string;
      manual_end_at: string;
    }>
  ) => {
    if (typeof window === 'undefined') throw new Error('Admin API is browser-only');
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/admin/manual-tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ matches }),
      cache: 'no-store',
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error((data.message as string) || `Create failed (${res.status})`);
    return data as { id: number; ticket_code: string; total_odds: number; created_at: string };
  },

  listAdminManualTickets: async (): Promise<AdminManualTicketRow[]> => {
    if (typeof window === 'undefined') throw new Error('Admin API is browser-only');
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/admin/manual-tickets`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: 'no-store',
    });
    const text = await res.text();
    let parsed: unknown = [];
    try {
      parsed = text ? JSON.parse(text) : [];
    } catch {
      parsed = [];
    }
    if (!res.ok) {
      const msg =
        parsed && typeof parsed === 'object' && parsed !== null && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : `List failed (${res.status})`;
      throw new Error(msg);
    }
    if (!Array.isArray(parsed)) return [];
    return parsed as AdminManualTicketRow[];
  },
};
