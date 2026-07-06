'use client';

import { useEffect, useState } from 'react';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';

const API_BASE = getPublicApiBaseUrl();

type AdminPromoCodeGeneratorProps = {
  onClose: () => void;
};

export default function AdminPromoCodeGenerator({ onClose }: AdminPromoCodeGeneratorProps) {
  const [phone, setPhone] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wasExisting, setWasExisting] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3500);
    return () => clearTimeout(t);
  }, [error]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) {
      setError('Enter the user signup phone number');
      return;
    }
    setLoading(true);
    setError(null);
    setGeneratedCode(null);
    setSavedPhone(null);
    setWasExisting(false);
    try {
      const res = await fetch(`${API_BASE}/admin/promo-codes/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ phone: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { message?: string }).message || 'Failed to generate code');
        return;
      }
      const code = (data as { code?: string }).code;
      const normalizedPhone = (data as { phone?: string }).phone;
      if (!code) {
        setError('No code returned');
        return;
      }
      setGeneratedCode(code);
      setSavedPhone(normalizedPhone ?? trimmed);
      setWasExisting(!(data as { created?: boolean }).created);
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
    } catch {
      setError('Could not copy to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex flex-col bg-[var(--site-bg)] text-white">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight tracking-tight text-white sm:text-xl">Promo</h1>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-xs">
            Generate a unique withdrawal code for a signup phone
          </p>
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
        <section className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 text-sm leading-relaxed text-slate-700 shadow-sm">
          Format: <span className="font-mono font-bold text-white">T##AA##BB#</span> (T, 2 digits, 2 letters, 2
          digits, 2 letters, 1 digit). One code per phone; codes are unique across all users.
        </section>

        <form onSubmit={handleGenerate} className="mt-5 space-y-4">
          <div>
            <label htmlFor="promo-phone" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Signup phone number
            </label>
            <input
              id="promo-phone"
              type="tel"
              autoComplete="tel"
              className="min-h-[48px] w-full rounded-2xl border-2 border-transparent bg-[var(--site-surface)] px-4 text-base font-bold text-white shadow-sm outline-none ring-1 ring-slate-200 transition focus:border-orange-500 focus:ring-orange-200"
              placeholder="e.g. +251912345678 or 0912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="mt-2 text-xs text-slate-500">Must match the phone used at user signup.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="min-h-[52px] w-full rounded-2xl bg-slate-900 text-base font-semibold text-white shadow-md transition active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate promotion code'}
          </button>
        </form>

        {generatedCode ? (
          <section className="mt-6 animate-in fade-in duration-300 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            {wasExisting ? (
              <p className="mb-2 text-xs font-semibold text-emerald-800">Existing code for this phone</p>
            ) : (
              <p className="mb-2 text-xs font-semibold text-emerald-800">New code saved</p>
            )}
            {savedPhone ? (
              <p className="mb-3 break-all text-xs text-emerald-900/80">
                Phone: <span className="font-bold">{savedPhone}</span>
              </p>
            ) : null}
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/80">Promotion code</p>
            <p className="mt-1 font-mono text-2xl font-black tracking-wider text-emerald-950">{generatedCode}</p>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 text-sm font-bold text-white transition active:scale-[0.99]"
            >
              {copied ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy code
                </>
              )}
            </button>
          </section>
        ) : null}
      </main>

      {error ? (
        <div className="pointer-events-none fixed bottom-20 left-4 right-4 z-[170] sm:left-auto sm:right-4 sm:max-w-md">
          <div className="pointer-events-auto rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 shadow-lg">
            {error}
          </div>
        </div>
      ) : null}
    </div>
  );
}
