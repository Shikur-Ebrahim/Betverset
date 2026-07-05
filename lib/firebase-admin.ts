import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

let _initialized = false;
let _app: App | null = null;

function stripQuotes(val: string): string {
  return val.trim().replace(/^['\"]+|['\"]+$/g, '');
}

function initAdmin(): void {
  if (_initialized || getApps().length > 0) {
    _initialized = true;
    return;
  }

  // 1. Individual env vars — most reliable on Vercel (set separately in dashboard)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && rawKey) {
    const privateKey = stripQuotes(rawKey).replace(/\\n/g, '\n');
    _app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    _initialized = true;
    console.log('[firebase-admin] Initialized from individual env vars');
    return;
  }

  // 2. Full JSON env var — FIREBASE_SERVICE_ACCOUNT_KEY
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (jsonEnv) {
    let sa: any = null;

    // Attempt A: direct JSON parse
    try { sa = JSON.parse(jsonEnv); } catch {}

    // Attempt B: strip surrounding quotes
    if (!sa) {
      try { sa = JSON.parse(stripQuotes(jsonEnv)); } catch {}
    }

    // Attempt C: escape literal newlines
    if (!sa) {
      try {
        let clean = stripQuotes(jsonEnv);
        clean = clean.replace(/\n/g, '\\n').replace(/\\\\n/g, '\\n');
        sa = JSON.parse(clean);
      } catch {}
    }

    if (sa) {
      if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      _app = initializeApp({ credential: cert(sa) });
      _initialized = true;
      console.log('[firebase-admin] Initialized from FIREBASE_SERVICE_ACCOUNT_KEY');
      return;
    }
    console.error('[firebase-admin] All JSON parse attempts failed for FIREBASE_SERVICE_ACCOUNT_KEY');
  }

  // 3. Local dev: read betverset.json
  try {
    const jsonPath = path.resolve(process.cwd(), 'betverset.json');
    if (fs.existsSync(jsonPath)) {
      const sa = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      _app = initializeApp({ credential: cert(sa) });
      _initialized = true;
      console.log('[firebase-admin] Initialized from betverset.json (local dev)');
      return;
    }
  } catch (e) {
    console.error('[firebase-admin] Failed to load betverset.json:', e);
  }

  throw new Error(
    'Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY on Vercel ' +
    '(full JSON as a single line), or set FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
  );
}

// Lazy-initialized singletons
let _db: ReturnType<typeof getFirestore> | null = null;
let _auth: ReturnType<typeof getAuth> | null = null;
let _storage: ReturnType<typeof getStorage> | null = null;

export function getAdminDb() {
  initAdmin();
  if (!_db) _db = getFirestore();
  return _db;
}

export function getAdminAuth() {
  initAdmin();
  if (!_auth) _auth = getAuth();
  return _auth;
}

export function getAdminStorage() {
  initAdmin();
  if (!_storage) _storage = getStorage();
  return _storage;
}

// Backward-compatible proxy exports
export const db: ReturnType<typeof getFirestore> = new Proxy({} as any, {
  get(_t, prop: string) {
    const instance = getAdminDb();
    const val = (instance as any)[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});

export const auth: ReturnType<typeof getAuth> = new Proxy({} as any, {
  get(_t, prop: string) {
    const instance = getAdminAuth();
    const val = (instance as any)[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});

export const storage: ReturnType<typeof getStorage> = new Proxy({} as any, {
  get(_t, prop: string) {
    const instance = getAdminStorage();
    const val = (instance as any)[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});
