'use client';

import type { SupportChatRole } from '@/lib/support-chat-api';

export type UiChatMessage = {
  id: string;
  role: SupportChatRole;
  content: string;
};

type ChatMessageProps = {
  message: UiChatMessage;
};

function BotAvatar() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-green-200 text-green-700 ring-1 ring-green-300/60"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path
          d="M12 3a7 7 0 0 0-7 7v2.5a2.5 2.5 0 0 0 2.5 2.5H9v3l3-2 3 2v-3h1.5a2.5 2.5 0 0 0 2.5-2.5V10a7 7 0 0 0-7-7Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="11" r="1" fill="currentColor" />
        <circle cx="15" cy="11" r="1" fill="currentColor" />
      </svg>
    </div>
  );
}

/** Single chat bubble — user on the right, assistant on the left. */
export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex w-full gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      data-role={message.role}
    >
      {!isUser && <BotAvatar />}
      <p
        className={`max-w-[82%] whitespace-pre-wrap break-words px-3.5 py-2.5 text-[13px] leading-relaxed sm:max-w-[78%] sm:text-sm ${
          isUser
            ? 'rounded-2xl rounded-br-md bg-gradient-to-br from-green-500 to-green-700 font-medium text-white shadow-md shadow-green-600/25'
            : 'rounded-2xl rounded-bl-md border border-green-200 bg-white text-slate-700 shadow-sm'
        }`}
      >
        {message.content}
      </p>
    </div>
  );
}
