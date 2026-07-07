'use client';

import { useEffect, useState } from 'react';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';

const API_BASE = getPublicApiBaseUrl();

type AdminDepositRuleSettingsProps = {
  onClose: () => void;
};

export default function AdminDepositRuleSettings({ onClose }: AdminDepositRuleSettingsProps) {
  const [minTotalDeposit, setMinTotalDeposit] = useState('');
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
        const res = await fetch(`${API_BASE}/admin/deposit-rule`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data as { message?: string }).message || 'Failed to load deposit rule');
          return;
        }
        const n = Number((data as { minTotalDeposit?: number }).minTotalDeposit);
        setMinTotalDeposit(Number.isFinite(n) ? String(n) : '6665');
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
    const amount = parseFloat(minTotalDeposit);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid amount greater than 0');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/deposit-rule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ minTotalDeposit: amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(true);
        const saved = Number((data as { minTotalDeposit?: number }).minTotalDeposit);
        if (Number.isFinite(saved)) setMinTotalDeposit(String(saved));
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
          <h1 className="text-lg font-bold leading-tight tracking-tight text-white sm:text-xl">Deposit Rule</h1>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-xs">
            Minimum total approved deposits before users can withdraw
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
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950 shadow-sm">
          Users can withdraw only after their <strong>total approved deposits</strong> reach this amount (ETB).
          Pending or rejected deposits do not count.
        </section>

        {loading ? (
          <div className="mt-8 flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--site-border)] border-t-orange-500" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="min-deposit-rule" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Minimum total deposit (ETB)
              </label>
              <input
                id="min-deposit-rule"
                type="number"
                min={1}
                step={1}
                required
                className="min-h-[48px] w-full rounded-2xl border-2 border-transparent bg-[var(--site-surface)] px-4 text-base font-bold text-slate-900 shadow-sm outline-none ring-1 ring-slate-200 transition focus:border-orange-500 focus:ring-orange-200"
                placeholder="e.g. 6665"
                value={minTotalDeposit}
                onChange={(e) => setMinTotalDeposit(e.target.value)}
              />
              <p className="mt-2 text-xs text-slate-500">Default when not set: 6665 ETB</p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[52px] w-full rounded-2xl bg-slate-900 text-base font-semibold text-white shadow-md transition active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save deposit rule'}
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
            Deposit rule saved.
          </div>
        </div>
      ) : null}
    </div>
  );
}
