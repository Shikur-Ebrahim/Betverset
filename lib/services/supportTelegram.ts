import { db } from '@/lib/firebase-admin';

const SUPPORT_TELEGRAM_KEY = 'support_telegram';
const TELEGRAM_USERNAME_REGEX = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

export async function getSupportTelegramUsername(): Promise<string | null> {
  const doc = await db.collection('app_settings').doc(SUPPORT_TELEGRAM_KEY).get();
  if (!doc.exists) return null;
  return doc.data()?.value?.username || null;
}

export async function setSupportTelegramUsername(rawUsername: string): Promise<string> {
  const username = rawUsername.trim().replace(/^@/, '');
  if (!TELEGRAM_USERNAME_REGEX.test(username)) {
    throw new Error('Invalid Telegram username');
  }
  await db.collection('app_settings').doc(SUPPORT_TELEGRAM_KEY).set({
    value: { username },
    updated_at: new Date().toISOString(),
  });
  return username;
}
