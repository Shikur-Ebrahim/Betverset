'use client';

import { useEffect, useState } from 'react';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';

const API_BASE = getPublicApiBaseUrl();
const DEFAULT_USERNAME = '@BetversEt';

type AdminTelegramSettingsProps = {
  onClose: () => void;
};

export default function AdminTelegramSettings({ onClose }: AdminTelegramSettingsProps) {
  const [username, setUsername] = useState(DEFAULT_USERNAME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setError('Not signed in');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/support-telegram`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data as { message?: string }).message || 'Failed to load Telegram settings');
          return;
        }
        const saved = (data as { username?: string }).username;
        setUsername(typeof saved === 'string' && saved.trim() ? saved : DEFAULT_USERNAME);
      } catch {
        setError('Connection error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!error && !success) return;
    const t = setTimeout(() => {
      setError(null);
      setSuccess(false);
    }, 3200);
    return () => clearTimeout(t);
  }, [error, success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Enter a Telegram username');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/support-telegram`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(true);
        const saved = (data as { username?: string }).username;
        if (typeof saved === 'string' && saved.trim()) setUsername(saved);
      } else {
        setError((data as { message?: string }).message || 'Failed to save');
      }
    } catch {
      setError('Connection error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex flex-col bg-[var(--site-bg)] text-white">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight tracking-tight text-white sm:text-xl">Support Team</h1>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-xs">Telegram contact for users</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-95"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <main className="mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-28 sm:px-5">
        <section className="rounded-2xl border border-sky-200/80 bg-sky-50 p-4 text-sm leading-relaxed text-sky-950 shadow-sm">
          Users tap the Telegram icon on the home page to open a chat with this username.
        </section>

        {loading ? (
          <div className="mt-8 flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--site-border)] border-t-sky-500" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="support-telegram-username" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Telegram username
              </label>
              <input
                id="support-telegram-username"
                type="text"
                required
                autoComplete="off"
                className="min-h-[48px] w-full rounded-2xl border-2 border-transparent bg-[var(--site-surface)] px-4 text-base font-bold text-white shadow-sm outline-none ring-1 ring-slate-200 transition focus:border-sky-500 focus:ring-sky-200"
                placeholder="@BetversEt"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p className="mt-2 text-xs text-slate-500">Default: {DEFAULT_USERNAME}</p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[52px] w-full rounded-2xl bg-slate-900 text-base font-semibold text-white shadow-md transition active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Telegram username'}
            </button>
          </form>
        )}
      </main>

      {error ? (
        <div className="pointer-events-none fixed bottom-20 left-4 right-4 z-[170] sm:left-auto sm:right-4 sm:max-w-md">
          <div className="pointer-events-auto rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 shadow-lg">
            {error}
          </div>
        </div>
      ) : null}
      {success ? (
        <div className="pointer-events-none fixed bottom-20 left-4 right-4 z-[170] sm:left-auto sm:right-4 sm:max-w-md">
          <div className="pointer-events-auto rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg">
            Telegram username saved.
          </div>
        </div>
      ) : null}
    </div>
  );
}
