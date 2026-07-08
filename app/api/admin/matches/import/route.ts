import { NextResponse } from 'next/server';
import { importFixturesForDate, MATCHES_PER_DAY } from '@/lib/services/apiFootball';

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.get('authorization');
  if (secret && auth === `Bearer ${secret}`) return true;
  if (!secret) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'Invalid or missing date parameter (YYYY-MM-DD)' }, { status: 400 });
  }

  const log: string[] = [];
  const push = (msg: string) => {
    log.push(msg);
    console.log(`[MatchImport] ${msg}`);
  };

  try {
    push(`Starting import for ${dateStr} (max ${MATCHES_PER_DAY} with odds)...`);
    const result = await importFixturesForDate(dateStr, MATCHES_PER_DAY);

    push(`Cleared ${result.cleared} old scheduled fixtures for ${dateStr}`);
    push(`Imported ${result.imported} fixtures with odds`);
    push(`Saved odds for ${result.oddsSaved} fixtures`);

    if (result.imported === 0) {
      return NextResponse.json({
        ok: true,
        log,
        imported: 0,
        message: 'No fixtures with odds found for this date.',
      });
    }

    push(`✅ Import complete! ${result.imported} matches imported with odds for ${dateStr}.`);

    return NextResponse.json({
      ok: true,
      log,
      imported: result.imported,
      oddsSaved: result.oddsSaved,
      date: dateStr,
    });
  } catch (err: any) {
    push(`❌ Error: ${err.message}`);
    return NextResponse.json({ ok: false, log, error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
