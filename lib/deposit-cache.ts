export type DepositMethod = {
  id: number;
  name: string;
  logo_url: string;
  min_amount: number;
  account_details: string;
  account_name: string;
};

import { getPublicApiBaseUrl } from './public-api-url';
import { parseJsonResponse } from './safe-json';

export type DepositBootstrap = {
  hasPending: boolean;
  methods: DepositMethod[];
};

const STORAGE_KEY = 'betvers_deposit_bootstrap_v1';
const TTL_MS = 15 * 60 * 1000;

let memoryCache: DepositBootstrap | null = null;
let memoryAt = 0;
let inflight: Promise<DepositBootstrap> | null = null;

function isFresh(at: number): boolean {
  return Date.now() - at < TTL_MS;
}

export function getCachedDepositBootstrap(): DepositBootstrap | null {
  if (memoryCache && isFresh(memoryAt)) return memoryCache;
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: DepositBootstrap };
    if (!parsed?.data || !isFresh(parsed.at)) return null;
    memoryCache = parsed.data;
    memoryAt = parsed.at;
    return parsed.data;
  } catch {
    return null;
  }
}

export function setCachedDepositBootstrap(data: DepositBootstrap): void {
  memoryCache = data;
  memoryAt = Date.now();
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ at: memoryAt, data }));
  } catch {
    /* quota */
  }
}

export function clearDepositBootstrapCache(): void {
  memoryCache = null;
  memoryAt = 0;
  inflight = null;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export async function fetchDepositBootstrap(): Promise<DepositBootstrap> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) {
    throw new Error('Login required');
  }

  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch(`${getPublicApiBaseUrl()}/user/deposit-bootstrap`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    const data = await parseJsonResponse<DepositBootstrap & { message?: string; error?: string }>(res);
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to load deposit methods');
    }

    const bootstrap: DepositBootstrap = {
      hasPending: Boolean(data.hasPending),
      methods: Array.isArray(data.methods) ? data.methods : [],
    };
    setCachedDepositBootstrap(bootstrap);
    return bootstrap;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Load in background when user is logged in or before they open the sheet. */
export function prefetchDepositBootstrap(): void {
  if (getCachedDepositBootstrap()) return;
  void fetchDepositBootstrap().catch(() => undefined);
}
