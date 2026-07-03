import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as path from 'path';

let _initialized = false;

function stripQuotes(val: string): string {
  return val.trim().replace(/^['"]+|['"]+$/g, '');
}

function initAdmin(): void {
  if (_initialized || getApps().length > 0) {
    _initialized = true;
    return;
  }

  // 1. FIREBASE_SERVICE_ACCOUNT_KEY (full JSON string)
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (jsonEnv) {
    try {
      const sa = JSON.parse(stripQuotes(jsonEnv));
      if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      initializeApp({ credential: cert(sa) });
      _initialized = true;
      return;
    } catch (e) {
      console.error('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    }
  }

  // 2. Individual fields
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && rawKey) {
    const privateKey = stripQuotes(rawKey).replace(/\\n/g, '\n');
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    _initialized = true;
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
    'Firebase Admin not configured. On Vercel set FIREBASE_SERVICE_ACCOUNT_KEY ' +
    '(the full content of betverset.json as a single line, no surrounding quotes).'
  );
}

function makeProxy<T extends object>(): T {
  return new Proxy({} as T, {
    get(_target, prop: string) {
      initAdmin();
      const instance = prop.startsWith('auth') || prop === 'createUser' || prop === 'getUser' || prop === 'updateUser' || prop === 'listUsers' || prop === 'verifyIdToken'
        ? getAuth()
        : getFirestore();
      const val = (instance as any)[prop];
      return typeof val === 'function' ? val.bind(instance) : val;
    },
  });
}

let _db: Firestore | null = null;
let _auth: Auth | null = null;

export function getAdminDb(): Firestore {
  initAdmin();
  if (!_db) _db = getFirestore();
  return _db;
}

export function getAdminAuth(): Auth {
  initAdmin();
  if (!_auth) _auth = getAuth();
  return _auth;
}

// Backward-compatible exports — these are proxies that initialize on first use
export const db: Firestore = new Proxy({} as Firestore, {
  get(_t, prop: string) {
    const instance = getAdminDb();
    const val = (instance as any)[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});

export const auth: Auth = new Proxy({} as Auth, {
  get(_t, prop: string) {
    const instance = getAdminAuth();
    const val = (instance as any)[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});

export const storage = new Proxy({} as any, {
  get(_t, prop: string) {
    initAdmin();
    const instance = getStorage();
    const val = (instance as any)[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});
