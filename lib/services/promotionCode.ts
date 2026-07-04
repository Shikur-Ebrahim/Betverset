import { db } from '@/lib/firebase-admin';

const CODE_PATTERN = /^B\d{2}[A-Z]{2}\d{2}[A-Z]{2}\d$/;

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
  const codesRef = db.collection('user_promotion_codes');
  for (let i = 0; i < maxAttempts; i++) {
    const code = buildPromotionCode();
    if (!CODE_PATTERN.test(code)) continue;
    const existing = await codesRef.where('code', '==', code).get();
    if (existing.empty) return code;
  }
  throw new Error('Could not allocate a unique promotion code');
}

export async function generatePromotionCodeForPhone(phone: string): Promise<{
  phone: string;
  code: string;
  created: boolean;
}> {
  const normalized = normalizePhone(phone);
  const codesRef = db.collection('user_promotion_codes');
  const existing = await codesRef.where('phone', '==', normalized).get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    return {
      phone: doc.data().phone,
      code: doc.data().code,
      created: false,
    };
  }

  const code = await allocateUniquePromotionCode();
  await codesRef.add({
    phone: normalized,
    code,
    createdAt: new Date().toISOString()
  });

  return {
    phone: normalized,
    code,
    created: true,
  };
}

export async function validatePromotionCodeForUser(
  userId: string, // now string for Firebase UID
  promoCode: string
): Promise<{ valid: boolean; message?: string }> {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    return { valid: false, message: 'User not found' };
  }

  const userPhone = userDoc.data()?.phone;
  if (!userPhone) return { valid: false, message: 'User phone missing' };

  const lookupPhone = normalizePhone(userPhone);
  const code = String(promoCode ?? '').trim().toUpperCase();
  
  if (!code || !CODE_PATTERN.test(code)) {
    return { valid: false, message: 'Please enter correct agent ID code' };
  }

  const codesRef = db.collection('user_promotion_codes');
  const row = await codesRef.where('phone', 'in', [userPhone, lookupPhone]).get();
  
  if (row.empty) {
    return {
      valid: false,
      message: 'No promotion code has been issued for your account. Contact support.',
    };
  }
  
  const matched = row.docs.some(doc => doc.data().code === code);
  
  if (!matched) {
    return { valid: false, message: 'Please enter correct agent ID code' };
  }
  return { valid: true };
}
