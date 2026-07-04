import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/services/apiFootball';

export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const data = await apiFetch('/odds', { date: today, page: 1 });
  
  return NextResponse.json({
    date: today,
    count: data.length,
    first: data.length > 0 ? data[0].fixture.id : null,
  });
}
export const dynamic = 'force-dynamic';
