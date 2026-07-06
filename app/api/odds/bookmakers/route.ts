import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Bookmakers are no longer maintained in a separate table, they are embedded in odds.
    return NextResponse.json([]);
  } catch (err: any) {
    console.error('Failed to fetch bookmakers:', err);
    return NextResponse.json({ error: 'Failed to fetch bookmakers' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
