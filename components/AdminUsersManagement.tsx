'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';

const API_BASE = getPublicApiBaseUrl();

export type AdminUserRow = {
  id: number;
  phone: string;
  role: string;
  created_at: string;
  balance: string;
  currency: string;
};

type AdminUsersManagementProps = {
  onClose: () => void;
};

export default function AdminUsersManagement({ onClose }: AdminUsersManagementProps) {
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingBalanceId, setSavingBalanceId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editBalance, setEditBalance] = useState('');
  const usersRef = useRef<AdminUserRow[]>([]);
  const fetchGenRef = useRef(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  usersRef.current = users;

  const fetchUsers = useCallback(async (search?: string) => {
    setError(null);
    const gen = ++fetchGenRef.current;
    const block = usersRef.current.length === 0 && !search;
    if (block) setLoading(true);
    try {
      const term = (search ?? searchPhone).trim();
      const qs = term ? `?q=${encodeURIComponent(term)}` : '';
      const res = await fetch(`${API_BASE}/admin/users${qs}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (fetchGenRef.current !== gen) return;
      if (!res.ok) {
        setError((data as { message?: string }).message || 'Could not load users');
        if (usersRef.current.length === 0) setUsers([]);
        return;
      }
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      if (fetchGenRef.current !== gen) return;
      setError('Connection error');
      if (usersRef.current.length === 0) setUsers([]);
    } finally {
      if (fetchGenRef.current === gen) setLoading(false);
    }
  }, [searchPhone]);

  const isFirstSearchEffect = useRef(true);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const delay = isFirstSearchEffect.current ? 0 : 350;
    isFirstSearchEffect.current = false;
    searchDebounceRef.current = setTimeout(() => {
      void fetchUsers(searchPhone);
    }, delay);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchPhone, fetchUsers]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [success]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone.trim() || !password) {
      setError('Enter phone and password');
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { message?: string }).message || 'Could not create user');
        return;
      }
      setSuccess('User created');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setAddFormOpen(false);
      void fetchUsers(searchPhone);
    } catch {
      setError('Connection error');
    } finally {
      setCreating(false);
    }
  };

  const startEditBalance = (u: AdminUserRow) => {
    setEditingUserId(u.id);
    setEditBalance(Number(u.balance ?? 0).toFixed(2));
    setError(null);
  };

  const cancelEditBalance = () => {
    setEditingUserId(null);
    setEditBalance('');
  };

  const saveBalance = async (userId: number) => {
    const balance = parseFloat(editBalance);
    if (!Number.isFinite(balance) || balance < 0) {
      setError('Enter a valid balance (0 or more)');
      return;
    }
    setSavingBalanceId(userId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/balance`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ balance }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { message?: string }).message || 'Could not update balance');
        return;
      }
      setSuccess('Balance updated');
      setEditingUserId(null);
      setEditBalance('');
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                balance: String((data as { balance?: string }).balance ?? balance.toFixed(2)),
              }
            : u
        )
      );
    } catch {
      setError('Connection error');
    } finally {
      setSavingBalanceId(null);
    }
  };

  const showBlockingLoader = loading && users.length === 0 && !searchPhone.trim();

  return (
    <div className="fixed inset-0 z-[160] flex flex-col bg-[var(--site-bg)] text-slate-900">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-4 sm:px-5">
        <div className="min-w-0 pr-2">
          <h1 className="text-lg font-bold leading-tight tracking-tight text-slate-900 sm:text-xl">Users</h1>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-xs">
            Search by phone · view and edit wallet balance
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

      <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 pb-28 sm:px-5">
        <div className="mb-3 space-y-3">
          <label htmlFor="admin-user-search" className="sr-only">
            Search by phone
          </label>
          <div className="relative">
            <input
              id="admin-user-search"
              type="search"
              inputMode="tel"
              autoComplete="off"
              placeholder="Search by phone number…"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              className="min-h-[48px] w-full rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] py-3 pl-11 pr-10 text-base text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <svg
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            {searchPhone.trim() ? (
              <button
                type="button"
                onClick={() => setSearchPhone('')}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            <h2 className="text-sm font-bold text-gray-200 sm:text-base">
              {searchPhone.trim() ? `Results (${users.length})` : `All users (${users.length})`}
            </h2>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void fetchUsers(searchPhone)}
                className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition active:scale-95 hover:bg-[var(--site-bg)]"
              >
                Refresh
              </button>
              {!addFormOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setAddFormOpen(true);
                  }}
                  className="rounded-full border-2 border-indigo-600 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 shadow-sm transition active:scale-95 hover:bg-indigo-100"
                >
                  Add user
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAddFormOpen(false);
                    setPhone('');
                    setPassword('');
                    setConfirmPassword('');
                    setError(null);
                  }}
                  className="rounded-full border border-slate-300 bg-[var(--site-surface)] px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition active:scale-95 hover:bg-[var(--site-bg)]"
                >
                  Cancel add
                </button>
              )}
            </div>
          </div>
        </div>

        {addFormOpen ? (
          <section
            id="admin-add-user"
            className="mb-4 rounded-2xl border-2 border-indigo-200 bg-[var(--site-surface)] p-4 shadow-md sm:p-5"
          >
            <h3 className="text-base font-bold text-indigo-950 sm:text-lg">New account</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Player account with wallet (0 ETB), same as public sign-up.
            </p>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <div>
                <label htmlFor="new-user-phone" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Phone
                </label>
                <input
                  id="new-user-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="min-h-[48px] w-full rounded-2xl border-2 border-transparent bg-[var(--site-bg)] px-4 text-base text-slate-900 outline-none ring-1 ring-slate-200 transition focus:border-indigo-500 focus:bg-[var(--site-surface)] focus:ring-indigo-200"
                  placeholder="e.g. 0912345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="new-user-pw" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <input
                  id="new-user-pw"
                  type="password"
                  autoComplete="new-password"
                  className="min-h-[48px] w-full rounded-2xl border-2 border-transparent bg-[var(--site-bg)] px-4 text-base text-slate-900 outline-none ring-1 ring-slate-200 transition focus:border-indigo-500 focus:bg-[var(--site-surface)] focus:ring-indigo-200"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="new-user-pw2" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Confirm password
                </label>
                <input
                  id="new-user-pw2"
                  type="password"
                  autoComplete="new-password"
                  className="min-h-[48px] w-full rounded-2xl border-2 border-transparent bg-[var(--site-bg)] px-4 text-base text-slate-900 outline-none ring-1 ring-slate-200 transition focus:border-indigo-500 focus:bg-[var(--site-surface)] focus:ring-indigo-200"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="min-h-[52px] w-full rounded-2xl bg-indigo-600 text-base font-semibold text-white shadow-md transition active:scale-[0.99] disabled:opacity-50"
              >
                {creating ? 'Adding…' : 'Create account'}
              </button>
            </form>
          </section>
        ) : null}

        {showBlockingLoader ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--site-border)] border-t-orange-500" />
            <p className="text-sm font-medium text-slate-500">Loading users…</p>
          </div>
        ) : error && users.length === 0 ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm font-medium text-red-800">
            {error}
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-8 text-center text-sm text-slate-500">
            {searchPhone.trim() ? 'No users match that phone number.' : 'No users yet.'}
          </div>
        ) : (
          <ul className="flex flex-col gap-3 pb-8">
            {users.map((u) => {
              const isEditing = editingUserId === u.id;
              return (
                <li
                  key={u.id}
                  className="rounded-2xl border border-[var(--site-border)]/90 bg-[var(--site-surface)] p-4 shadow-sm ring-1 ring-black/[0.03]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-all text-base font-semibold text-slate-900">{u.phone}</p>
                      <p className="mt-1 text-xs font-medium capitalize text-slate-500">
                        {u.role} · ID {u.id}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Joined{' '}
                        {new Date(u.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </p>
                    </div>
                    {!isEditing ? (
                      <div className="shrink-0 rounded-xl bg-orange-50 px-3 py-2 text-right ring-1 ring-orange-100">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600/80">
                          Balance
                        </p>
                        <p className="text-lg font-bold tabular-nums text-slate-900">
                          {Number(u.balance ?? 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] font-bold text-orange-600">{u.currency || 'ETB'}</p>
                      </div>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <div className="mt-4 space-y-2 border-t border-[var(--site-border)] pt-4">
                      <label
                        htmlFor={`balance-${u.id}`}
                        className="block text-xs font-semibold text-slate-600"
                      >
                        New balance ({u.currency || 'ETB'})
                      </label>
                      <input
                        id={`balance-${u.id}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={editBalance}
                        onChange={(e) => setEditBalance(e.target.value)}
                        className="min-h-[48px] w-full rounded-xl border border-[var(--site-border)] bg-[var(--site-bg)] px-4 text-base font-semibold tabular-nums text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={cancelEditBalance}
                          disabled={savingBalanceId === u.id}
                          className="flex-1 rounded-xl border border-[var(--site-border)] py-3 text-xs font-bold text-slate-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveBalance(u.id)}
                          disabled={savingBalanceId === u.id}
                          className="flex-[2] rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {savingBalanceId === u.id ? 'Saving…' : 'Save balance'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditBalance(u)}
                      className="mt-3 w-full rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-xs font-bold text-indigo-800 transition active:scale-[0.99] hover:bg-indigo-100"
                    >
                      Edit balance
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {error && users.length > 0 ? (
          <div className="fixed bottom-20 left-4 right-4 z-[170] rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 shadow-lg sm:left-auto sm:right-4 sm:max-w-md">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="fixed bottom-20 left-4 right-4 z-[170] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg sm:left-auto sm:right-4 sm:max-w-md">
            {success}
          </div>
        ) : null}
      </main>
    </div>
  );
}
