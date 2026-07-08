import { NextResponse } from 'next/server';
import { cleanupMatchDatabase } from '@/lib/services/apiFootball';

export async function GET() {
  try {
    const result = await cleanupMatchDatabase();
    return NextResponse.json({
      ok: true,
      ...result,
      message: 'Automated cleanup completed successfully.',
    });
  } catch (err: any) {
    console.error('[MatchCleanup] Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
