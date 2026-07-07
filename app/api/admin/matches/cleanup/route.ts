import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  try {
    const log: string[] = [];
    const push = (msg: string) => {
      console.log(`[MatchCleanup] ${msg}`);
      log.push(msg);
    };

    push('Starting automated match cleanup...');

    // 1. Delete matches finished more than 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Statuses that mean the match is finished
    const finishedStatuses = ['FT', 'AET', 'PEN', 'ABD', 'AWD', 'WO'];

    push(`Looking for matches finished before ${twentyFourHoursAgo}...`);

    const { data: oldMatches, error: oldErr } = await supabaseAdmin
      .from('fixtures')
      .select('id')
      .in('status', finishedStatuses)
      .lt('kickoff_at', twentyFourHoursAgo);

    if (oldErr) throw oldErr;

    if (oldMatches && oldMatches.length > 0) {
      const idsToDelete = oldMatches.map(m => m.id);
      push(`Found ${idsToDelete.length} matches older than 24h. Deleting...`);
      
      // Delete odds first to avoid FK constraints if they exist (though cascade should handle it)
      await supabaseAdmin.from('odds').delete().in('fixture_id', idsToDelete);
      
      const { error: delErr } = await supabaseAdmin
        .from('fixtures')
        .delete()
        .in('id', idsToDelete);
        
      if (delErr) push(`WARNING: Failed to delete old matches: ${delErr.message}`);
      else push(`Successfully deleted ${idsToDelete.length} old matches.`);
    } else {
      push('No matches older than 24h found.');
    }

    // 2. Enforce absolute max of 350 matches in DB
    const { data: allMatchIds, error: countErr } = await supabaseAdmin
      .from('fixtures')
      .select('id')
      .order('kickoff_at', { ascending: false });

    if (countErr) throw countErr;

    if (allMatchIds && allMatchIds.length > 350) {
      const overLimitCount = allMatchIds.length - 350;
      // The ids from index 350 onwards are the oldest ones that exceed the limit
      const idsToPrune = allMatchIds.slice(350).map(m => m.id);
      
      push(`Database has ${allMatchIds.length} matches (Limit 350). Pruning ${idsToPrune.length} oldest matches...`);
      
      await supabaseAdmin.from('odds').delete().in('fixture_id', idsToPrune);
      
      const { error: pruneErr } = await supabaseAdmin
        .from('fixtures')
        .delete()
        .in('id', idsToPrune);
        
      if (pruneErr) push(`WARNING: Failed to prune excess matches: ${pruneErr.message}`);
      else push(`Successfully pruned ${idsToPrune.length} matches to keep DB size under 350.`);
    } else {
      push(`Database size is within limits (${allMatchIds?.length || 0} / 350).`);
    }

    push('Cleanup finished successfully.');

    return NextResponse.json({
      ok: true,
      log,
      message: 'Automated cleanup completed successfully.'
    });
  } catch (err: any) {
    console.error('[MatchCleanup] Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
