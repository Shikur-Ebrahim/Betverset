'use client';

import { useEffect, useState } from 'react';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';

const API_BASE = getPublicApiBaseUrl();
const DEFAULT_USERNAME = '@BetversEt';

function toTelegramUrl(username: string): string {
  const handle = username.trim().replace(/^@+/, '');
  return `https://t.me/${encodeURIComponent(handle || 'BetversEt')}`;
}

export default function TelegramSupportFab() {
  const [telegramUrl, setTelegramUrl] = useState(() => toTelegramUrl(DEFAULT_USERNAME));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/support-telegram`);
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const username = (data as { username?: string }).username;
        if (typeof username === 'string' && username.trim()) {
          setTelegramUrl(toTelegramUrl(username));
        }
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <a
      href={telegramUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-[72px] left-3 z-[55] flex h-12 w-12 items-center justify-center overflow-hidden rounded-full shadow-lg shadow-black/35 transition-transform active:scale-95 sm:left-4 sm:h-[52px] sm:w-[52px]"
      aria-label="Contact support on Telegram"
    >
      <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
        <circle cx="24" cy="24" r="24" fill="#27A7E7" />
        <path
          fill="#fff"
          d="M10.49 26.73l2.83 9.4c.36 1.17 1.05 1.41 2.13.88l5.89-4.35 2.89 2.78c.53.53.98.97 2 .97l-.43-6.07 10.9-9.86c.9-.8-.2-1.24-1.39-.46L15.7 29.83l-6.2-1.93c-1.35-.42-1.37-1.3.28-1.93l24.1-9.28c1.12-.51 2.1.27 1.73 2.01l-3.69 17.37c-.27 1.24-1.01 1.54-2.05.96L22.1 34.62l-4.79 3.5c-.54.42-1.03.19-1.26-.43l-1.82-5.86-5.74-3.6z"
        />
      </svg>
    </a>
  );
}
