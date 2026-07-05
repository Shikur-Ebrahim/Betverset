import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let _initialized = false;

function stripQuotes(val: string): string {
  return val.trim().replace(/^['\"]+|['\"]+$/g, '');
}

function initAdmin(): void {
  if (_initialized || getApps().length > 0) {
    _initialized = true;
    return;
  }

  // 1. Full JSON env var — FIREBASE_SERVICE_ACCOUNT_KEY
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (jsonEnv) {
    let sa: any = null;
    try { sa = JSON.parse(jsonEnv); } catch {}
    if (!sa) { try { sa = JSON.parse(stripQuotes(jsonEnv)); } catch {} }
    if (!sa) {
      try {
        let clean = stripQuotes(jsonEnv);
        clean = clean.replace(/\n/g, '\\n').replace(/\\\\n/g, '\\n');
        sa = JSON.parse(clean);
      } catch {}
    }
    if (sa) {
      if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      initializeApp({ credential: cert(sa) });
      _initialized = true;
      console.log('[firebase-admin] Initialized from FIREBASE_SERVICE_ACCOUNT_KEY');
      return;
    }
    console.error('[firebase-admin] All JSON parse attempts failed for FIREBASE_SERVICE_ACCOUNT_KEY');
  }

  // 2. Individual env vars
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && rawKey) {
    const privateKey = stripQuotes(rawKey).replace(/\\n/g, '\n');
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    _initialized = true;
    console.log('[firebase-admin] Initialized from individual env vars');
    return;
  }

  // 3. Local dev: read betverset.json
  try {
    const jsonPath = path.resolve(process.cwd(), 'betverset.json');
    if (fs.existsSync(jsonPath)) {
      const sa = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      initializeApp({ credential: cert(sa) });
      _initialized = true;
      console.log('[firebase-admin] Initialized from betverset.json (local dev)');
      return;
    }
  } catch (e) {
    console.error('[firebase-admin] Failed to load betverset.json:', e);
  }

  throw new Error(
    'Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY on Vercel.'
  );
}

// Lazy-initialized singletons
let _db: ReturnType<typeof getFirestore> | null = null;
let _auth: ReturnType<typeof getAuth> | null = null;

export function getAdminDb() {
  initAdmin();
  if (!_db) {
    _db = getFirestore();
    // CRITICAL: Use REST instead of gRPC to avoid Vercel cold-start timeouts.
    // gRPC takes 3-8s to establish a connection on cold starts, exceeding
    // Vercel Hobby's 10s function timeout. REST starts instantly.
    (_db as any).settings({ preferRest: true });
  }
  return _db;
}

export function getAdminAuth() {
  initAdmin();
  if (!_auth) _auth = getAuth();
  return _auth;
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

export const storage: any = new Proxy({} as any, {
  get(_t, prop: string) {
    initAdmin();
    // lazy import to avoid bundling issues
    const { getStorage } = require('firebase-admin/storage');
    const instance = getStorage();
    const val = instance[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});
