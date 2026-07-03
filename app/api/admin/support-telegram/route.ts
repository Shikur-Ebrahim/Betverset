import { NextResponse } from 'next/server';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';
import {

  getSupportTelegramUsername,
  setSupportTelegramUsername,
} from '@/lib/services/supportTelegram';

// GET /api/admin/support-telegram (public read for site FAB)
export async function GET() {
  try {
    const username = await getSupportTelegramUsername();
    return NextResponse.json({ username });
  } catch (err: any) {
    console.error('support-telegram get error:', err);
    return NextResponse.json({ message: 'Failed to fetch support Telegram' }, { status: 500 });
  }
}

// PUT /api/admin/support-telegram (admin write)
export async function PUT(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const body = await req.json();
    const raw = typeof body?.username === 'string' ? body.username : '';
    if (!raw.trim()) {
      return NextResponse.json({ message: 'Telegram username is required' }, { status: 400 });
    }
    const username = await setSupportTelegramUsername(raw);
    return NextResponse.json({ username });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Failed to save';
    if (message === 'Invalid Telegram username') {
      return NextResponse.json(
        { message: 'Enter a valid Telegram username (5–32 letters, numbers, or _)' },
        { status: 400 }
      );
    }
    console.error('support-telegram put error:', err);
    return NextResponse.json({ message: 'Failed to save support Telegram' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
