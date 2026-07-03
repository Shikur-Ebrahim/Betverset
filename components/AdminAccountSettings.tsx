'use client';

import { useEffect, useState } from 'react';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';

const API_BASE = getPublicApiBaseUrl();

type AdminAccountSettingsProps = {
  user: { id: number; phone?: string; role?: string } | null;
  onClose: () => void;
};

export default function AdminAccountSettings({ user, onClose }: AdminAccountSettingsProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError((data as { message?: string }).message || 'Failed to change password');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex flex-col bg-[#F8FAFC] text-[#1A202C]">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight tracking-tight text-slate-900 sm:text-xl">Settings</h1>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-xs">Change your admin password</p>
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
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Signed in as</p>
          <p className="mt-1 break-all text-base font-semibold text-slate-900">{user?.phone ?? '—'}</p>
          {user?.role ? (
            <p className="mt-1 text-xs font-medium capitalize text-slate-500">Role: {user.role}</p>
          ) : null}
        </section>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="admin-curr-pw" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Current password
            </label>
            <input
              id="admin-curr-pw"
              type="password"
              autoComplete="current-password"
              required
              className="min-h-[48px] w-full rounded-2xl border-2 border-transparent bg-white px-4 text-base text-slate-900 shadow-sm outline-none ring-1 ring-slate-200 transition focus:border-orange-500 focus:ring-orange-200"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="admin-new-pw" className="mb-1.5 block text-sm font-semibold text-slate-700">
              New password
            </label>
            <input
              id="admin-new-pw"
              type="password"
              autoComplete="new-password"
              required
              className="min-h-[48px] w-full rounded-2xl border-2 border-transparent bg-white px-4 text-base text-slate-900 shadow-sm outline-none ring-1 ring-slate-200 transition focus:border-orange-500 focus:ring-orange-200"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="admin-confirm-pw" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Confirm new password
            </label>
            <input
              id="admin-confirm-pw"
              type="password"
              autoComplete="new-password"
              required
              className="min-h-[48px] w-full rounded-2xl border-2 border-transparent bg-white px-4 text-base text-slate-900 shadow-sm outline-none ring-1 ring-slate-200 transition focus:border-orange-500 focus:ring-orange-200"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="min-h-[52px] w-full rounded-2xl bg-slate-900 text-base font-semibold text-white shadow-md transition active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
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
            Password updated successfully.
          </div>
        </div>
      ) : null}
    </div>
  );
}
