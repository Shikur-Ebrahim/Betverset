import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as path from 'path';

function stripQuotes(val: string): string {
  return val.trim().replace(/^['"]+|['"]+$/g, '');
}

function getServiceAccount(): object | null {
  // 1. Try full JSON env var (Vercel recommended)
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (jsonEnv) {
    try {
      const parsed = JSON.parse(stripQuotes(jsonEnv));
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      return parsed;
    } catch (e) {
      console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_KEY parse error:', e);
    }
  }

  // 2. Try individual env vars
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && rawKey) {
    return {
      projectId,
      client_email: clientEmail,
      private_key: stripQuotes(rawKey).replace(/\\n/g, '\n'),
    };
  }

  // 3. Local dev fallback: read betverset.json from project root
  try {
    const jsonPath = path.resolve(process.cwd(), 'betverset.json');
    if (fs.existsSync(jsonPath)) {
      const sa = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      console.log('[firebase-admin] Using betverset.json from project root (local dev)');
      return sa;
    }
  } catch (e) {
    console.error('[firebase-admin] Failed to read betverset.json:', e);
  }

  return null;
}

function initAdmin(): App {
  if (getApps().length > 0) return getApp();

  const sa = getServiceAccount();
  if (!sa) {
    throw new Error(
      '[firebase-admin] No credentials found. On Vercel, set FIREBASE_SERVICE_ACCOUNT_KEY ' +
      '(paste the full betverset.json content as a single line, no quotes around it).'
    );
  }

  return initializeApp({ credential: cert(sa as any) });
}

// Lazy getters — these only initialize when first called, so crashes are
// caught inside API route try/catch blocks instead of crashing the module.
let _db: Firestore | null = null;
let _auth: Auth | null = null;

export function getAdminDb(): Firestore {
  if (!_db) {
    initAdmin();
    _db = getFirestore();
  }
  return _db;
}

export function getAdminAuth(): Auth {
  if (!_auth) {
    initAdmin();
    _auth = getAuth();
  }
  return _auth;
}

// Keep backwards-compatible named exports
export const db = new Proxy({} as Firestore, {
  get(_target, prop) {
    return (getAdminDb() as any)[prop];
  },
});

export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    return (getAdminAuth() as any)[prop];
  },
});

export const storage = new Proxy({} as any, {
  get(_target, prop) {
    initAdmin();
    return (getStorage() as any)[prop];
  },
});
