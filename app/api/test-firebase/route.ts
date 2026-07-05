import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/services/apiFootball';

export async function GET() {
  try {
    const data = await apiFetch('/fixtures', { next: 50 });
    return NextResponse.json({ length: data.length, data: data.slice(0, 2) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
export const dynamic = 'force-dynamic';
