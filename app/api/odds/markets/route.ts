import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Markets are no longer maintained in a separate table, they are embedded in odds.
    return NextResponse.json([]);
  } catch (err: any) {
    console.error('Failed to fetch markets:', err);
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
