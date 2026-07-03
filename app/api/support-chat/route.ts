import { NextRequest, NextResponse } from 'next/server';
import { getGroqSupportReply, normalizeChatHistory } from '@/lib/groq-support-chat';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const history = normalizeChatHistory(
    body && typeof body === 'object' ? (body as { messages?: unknown }).messages : undefined
  );

  if (history.length === 0) {
    return NextResponse.json({ error: 'At least one message is required' }, { status: 400 });
  }

  const last = history[history.length - 1];
  if (last.role !== 'user') {
    return NextResponse.json({ error: 'The latest message must be from the user' }, { status: 400 });
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();

  if (!groqKey) {
    return NextResponse.json(
      { error: 'Support chat is not configured. Add GROQ_API_KEY.' },
      { status: 503 }
    );
  }

  try {
    const reply = await getGroqSupportReply(history, groqKey);
    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[support-chat] Groq direct:', err);
    const message = err instanceof Error ? err.message : 'Chat request failed';
    const isAuth =
      message.toLowerCase().includes('invalid api key') ||
      message.toLowerCase().includes('unauthorized');
    return NextResponse.json(
      {
        error: isAuth
          ? 'Support chat is misconfigured. Please contact the site administrator.'
          : 'Could not get a reply. Please try again.',
      },
      { status: isAuth ? 503 : 502 }
    );
  }
}

export const dynamic = 'force-dynamic';
