import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

function stripQuotes(val: string): string {
  // Remove wrapping single or double quotes that some env systems add
  return val.trim().replace(/^['"]+|['"]+$/g, '');
}

function getCredential() {
  // Option 1: Full JSON key as a single env var (recommended for Vercel)
  let serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      serviceAccountJson = stripQuotes(serviceAccountJson);
      const serviceAccount = JSON.parse(serviceAccountJson);
      // Ensure private key newlines are always real newlines
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      return cert(serviceAccount);
    } catch (e) {
      console.error('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', e);
    }
  }

  // Option 2: Individual fields
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey
    ? stripQuotes(rawKey).replace(/\\n/g, '\n')
    : undefined;

  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  if (process.env.npm_lifecycle_event === 'build' || process.env.NEXT_PHASE === 'phase-production-build') {
    return { projectId: 'dummy-build-project' };
  }

  throw new Error(
    '[firebase-admin] Credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY (full JSON) ' +
    'or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in Vercel env vars.'
  );
}

if (!getApps().length) {
  const creds = getCredential();
  if ('projectId' in creds && creds.projectId === 'dummy-build-project') {
    initializeApp({ projectId: 'dummy-build-project' });
  } else {
    initializeApp({ credential: creds as any });
  }
}

export const db = getFirestore();
export const auth = getAuth();
export const storage = getStorage();
// Removed export default admin since it's now modular
