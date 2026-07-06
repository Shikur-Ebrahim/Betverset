import { supabaseAdmin } from '@/lib/supabase-admin';

const CODE_PATTERN = /^[BT]\d{2}[A-Z]{2}\d{2}[A-Z]{2}\d$/;

function randomDigit(): string {
  return String(Math.floor(Math.random() * 10));
}

function randomLetter(): string {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

export function buildPromotionCode(): string {
  return (
    'B' +
    randomDigit() +
    randomDigit() +
    randomLetter() +
    randomLetter() +
    randomDigit() +
    randomDigit() +
    randomLetter() +
    randomLetter() +
    randomDigit()
  );
}

export function normalizePhone(raw: string): string {
  let p = String(raw ?? '').trim().replace(/\s+/g, '');
  if (!p) return '';
  
  if (p.includes('@')) {
    p = p.split('@')[0];
  }

  if (p.startsWith('+')) {
    return p;
  }
  if (p.startsWith('251')) {
    return `+${p}`;
  }
  if (p.startsWith('0') && p.length >= 10) {
    return `+251${p.slice(1)}`;
  }
  if (/^\d{9}$/.test(p)) {
    return `+251${p}`;
  }
  return p.startsWith('+') ? p : `+${p}`;
}

export async function allocateUniquePromotionCode(maxAttempts = 40): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = buildPromotionCode();
    if (!CODE_PATTERN.test(code)) continue;
    const { data } = await supabaseAdmin.from('user_promotion_codes').select('id').eq('code', code).limit(1);
    if (!data || data.length === 0) return code;
  }
  throw new Error('Could not allocate a unique promotion code');
}

export async function generatePromotionCodeForPhone(phone: string): Promise<{
  phone: string;
  code: string;
  created: boolean;
}> {
  const normalized = normalizePhone(phone);
  const { data: existing } = await supabaseAdmin
    .from('user_promotion_codes')
    .select('*')
    .eq('phone', normalized)
    .limit(1);

  if (existing && existing.length > 0) {
    return {
      phone: existing[0].phone,
      code: existing[0].code,
      created: false,
    };
  }

  const code = await allocateUniquePromotionCode();
  await supabaseAdmin.from('user_promotion_codes').insert({
    phone: normalized,
    code,
    created_at: new Date().toISOString()
  });

  return {
    phone: normalized,
    code,
    created: true,
  };
}

export async function validatePromotionCodeForUser(
  userId: string,
  promoCode: string
): Promise<{ valid: boolean; message?: string }> {
  const { data: userData } = await supabaseAdmin.from('users').select('phone').eq('id', userId).single();
  if (!userData) {
    return { valid: false, message: 'User not found' };
  }

  const userPhone = userData.phone;
  if (!userPhone) return { valid: false, message: 'User phone missing' };

  const lookupPhone = normalizePhone(userPhone);
  const code = String(promoCode ?? '').trim().toUpperCase();
  
  if (!code) {
    return { valid: false, message: 'Please enter correct agent ID code' };
  }

  const { data: rows } = await supabaseAdmin
    .from('user_promotion_codes')
    .select('code')
    .in('phone', [userPhone, lookupPhone]);
  
  if (!rows || rows.length === 0) {
    return {
      valid: false,
      message: 'No promotion code has been issued for your account. Contact support.',
    };
  }
  
  const matched = rows.some((row: any) => row.code === code);
  
  if (!matched) {
    return { valid: false, message: 'Please enter correct agent ID code' };
  }
  
  return { valid: true };
}
