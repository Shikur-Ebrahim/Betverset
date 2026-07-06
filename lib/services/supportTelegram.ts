import { supabaseAdmin } from '@/lib/supabase-admin';

const SUPPORT_TELEGRAM_KEY = 'support_telegram';
const TELEGRAM_USERNAME_REGEX = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

export async function getSupportTelegramUsername(): Promise<string | null> {
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', SUPPORT_TELEGRAM_KEY).single();
  if (!data) return null;
  return (data.value as any)?.username || null;
}

export async function setSupportTelegramUsername(rawUsername: string): Promise<string> {
  const username = rawUsername.trim().replace(/^@/, '');
  if (!TELEGRAM_USERNAME_REGEX.test(username)) {
    throw new Error('Invalid Telegram username');
  }
  await supabaseAdmin.from('app_settings').upsert(
    { key: SUPPORT_TELEGRAM_KEY, value: { username } },
    { onConflict: 'key' }
  );
  return username;
}
