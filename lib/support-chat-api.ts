import { fetchWithTimeout } from './fetch-with-timeout';

export type SupportChatRole = 'user' | 'assistant';

export type SupportChatTurn = {
  role: SupportChatRole;
  content: string;
};

export type SupportChatReply = {
  reply: string;
};

/** Send conversation history to the AI support endpoint (via Next.js BFF in the browser). */
export async function sendSupportChatMessage(
  messages: SupportChatTurn[]
): Promise<string> {
  const res = await fetchWithTimeout('/api/support-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    timeoutMs: 35_000,
  });

  const data = (await res.json().catch(() => ({}))) as SupportChatReply & { error?: string };

  if (!res.ok) {
    throw new Error(data.error || 'Support chat is unavailable. Please try again.');
  }

  if (!data.reply?.trim()) {
    throw new Error('No reply received. Please try again.');
  }

  return data.reply.trim();
}
