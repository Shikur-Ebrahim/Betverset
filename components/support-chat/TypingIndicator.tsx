'use client';

function SupportBotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3a7 7 0 0 0-7 7v2.5a2.5 2.5 0 0 0 2.5 2.5H9v3l3-2 3 2v-3h1.5a2.5 2.5 0 0 0 2.5-2.5V10a7 7 0 0 0-7-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="11" r="1" fill="currentColor" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
    </svg>
  );
}

/** Animated typing dots shown while the assistant is generating a reply. */
export default function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-green-200 text-green-700 ring-1 ring-green-300/60"
        aria-hidden
      >
        <SupportBotIcon className="h-4 w-4" />
      </div>
      <div
        className="rounded-2xl rounded-bl-md border border-green-200 bg-[var(--site-surface)] px-4 py-3 shadow-sm"
        role="status"
        aria-label="Assistant is typing"
      >
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 animate-bounce rounded-full bg-green-500"
              style={{ animationDelay: `${delay}ms`, animationDuration: '0.9s' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
