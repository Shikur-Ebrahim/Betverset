import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const { data: fixtures, error } = await supabaseAdmin.from('fixtures').select('id').limit(1);
    
    if (error) {
      return NextResponse.json({
        status: 'error',
        message: 'Supabase connection failed',
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'success',
      message: 'Supabase connection successful',
      fixtureCount: fixtures ? fixtures.length : 0
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: 'Unexpected error testing Supabase',
      error: error.message
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
