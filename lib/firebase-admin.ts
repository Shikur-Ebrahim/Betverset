import * as fs from 'fs';
import * as path from 'path';

let _initialized = false;

function stripQuotes(val: string): string {
  return val.trim().replace(/^['"]+|['"]+$/g, '');
}

function initAdmin(): void {
  const mod = 'firebase-admin/app';
  const { initializeApp, getApps, cert } = eval('require(' + mod + ')');
  
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

let _db: any = null;
let _auth: any = null;

export function getAdminDb() {
  initAdmin();
  if (!_db) {
    const mod = 'firebase-admin/firestore';
    const { getFirestore } = eval('require(' + mod + ')');
    _db = getFirestore();
  }
  return _db;
}

export function getAdminAuth() {
  initAdmin();
  if (!_auth) {
    const mod = 'firebase-admin/auth';
    const { getAuth } = eval('require(' + mod + ')');
    _auth = getAuth();
  }
  return _auth;
}

// Backward-compatible exports — these are proxies that initialize on first use
export const db: any = new Proxy({}, {
  get(_t, prop: string) {
    const instance = getAdminDb();
    const val = instance[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});

export const auth: any = new Proxy({}, {
  get(_t, prop: string) {
    const instance = getAdminAuth();
    const val = instance[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});

export const storage: any = new Proxy({}, {
  get(_t, prop: string) {
    initAdmin();
    const mod = 'firebase-admin/storage';
    const { getStorage } = eval('require(' + mod + ')');
    const instance = getStorage();
    const val = instance[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});
