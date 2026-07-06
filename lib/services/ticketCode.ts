import { supabaseAdmin } from '@/lib/supabase-admin';

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
  for (let i = 0; i < 40; i++) {
    const code = buildTicketCode();
    const { data } = await supabaseAdmin.from('bet_slips').select('id').eq('ticket_code', code).limit(1);
    if (!data || data.length === 0) return code;
  }
  throw new Error('Could not allocate a unique ticket code');
}
