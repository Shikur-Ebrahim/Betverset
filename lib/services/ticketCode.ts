import { db } from '@/lib/firebase-admin';

function randomDigit(): string {
  return String(Math.floor(Math.random() * 10));
}

function randomLetter(): string {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

function buildTicketCode(): string {
  return (
    'B' +
    randomDigit() +
    randomDigit() +
    randomLetter() +
    randomLetter() +
    randomDigit() +
    randomDigit()
  );
}

export async function allocateUniqueTicketCode(): Promise<string> {
  const slipsRef = db.collection('bet_slips');
  for (let i = 0; i < 40; i++) {
    const code = buildTicketCode();
    const existing = await slipsRef.where('ticket_code', '==', code).get();
    if (existing.empty) return code;
  }
  throw new Error('Could not allocate a unique ticket code');
}
