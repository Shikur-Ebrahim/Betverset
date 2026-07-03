import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

function getCredential() {
  // Option 1: Full JSON key as a single env var (recommended for Vercel)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      return cert(serviceAccount);
    } catch {
      console.error('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON');
    }
  }

  // Option 2: Individual fields
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  if (process.env.npm_lifecycle_event === 'build' || process.env.NEXT_PHASE === 'phase-production-build') {
    return { projectId: 'dummy-build-project' };
  }

  throw new Error(
    'Firebase Admin credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY or ' +
    'FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in your environment.'
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
