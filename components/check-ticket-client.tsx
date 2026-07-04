'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useState } from 'react';
import { api, TicketCheckResponse, TicketCheckSelection } from '@/lib/api';

function stripTicketInputPrefixes(raw: string): string {
  return raw.trim().replace(/^#/i, '').replace(/^code:\s*/i, '').trim();
}

function titleCaseWords(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function slipStatusLabel(status: string): string {
  if (status === 'won') return 'Won';
  if (status === 'lost') return 'Lost';
  return 'Open';
}

function legResultLabel(result: string | null | undefined): string | null {
  const r = (result || '').trim().toLowerCase();
  if (r === 'won') return 'Won';
  if (r === 'lost') return 'Lost';
  return null;
}

function formatKickoffAt(value: string | null | undefined): string | null {
  if (value == null || String(value).trim() === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function ticketCodePlain(code: string | null | undefined): string {
  if (code == null) return '';
  return String(code).replace(/^#/, '').trim();
}

function TicketLeg({ sel }: { sel: TicketCheckSelection }) {
  const lr = (sel.result || '').trim().toLowerCase();
  const legWon = lr === 'won';
  const legLost = lr === 'lost';
  const legBadge = legResultLabel(sel.result);
  const kickoffLabel = formatKickoffAt(sel.kickoff_at);

  return (
    <div
      className={`py-3 first:pt-2 last:pb-2 ${
        legWon
          ? 'rounded-xl bg-emerald-50/90 ring-1 ring-emerald-200/80'
          : legLost
            ? 'rounded-xl bg-red-50/90 ring-1 ring-red-200/80'
            : ''
      } ${legWon || legLost ? 'my-2 px-2.5 -mx-0.5 sm:px-3 sm:-mx-1' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium leading-snug text-slate-500 sm:text-xs">
            {titleCaseWords(sel.league_name || '')}
          </p>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-2">
              {sel.home_logo ? (
                <img src={sel.home_logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
              ) : null}
              <span className="truncate text-sm font-medium text-slate-800">{sel.home_team}</span>
            </div>
            <div className="flex items-center gap-2">
              {sel.away_logo ? (
                <img src={sel.away_logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
              ) : null}
              <span className="truncate text-sm font-medium text-slate-800">{sel.away_team}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="rounded-lg bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
            {Number(sel.odd).toFixed(2)}
          </span>
          {legBadge ? (
            <span
              className={`text-[10px] font-semibold ${
                legWon ? 'text-emerald-700' : legLost ? 'text-red-700' : 'text-slate-500'
              }`}
            >
              {legBadge}
            </span>
          ) : (
            <span className="text-[10px] font-medium text-slate-400">Pending</span>
          )}
          {kickoffLabel ? (
            <span className="text-[10px] font-medium tabular-nums text-slate-400">{kickoffLabel}</span>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {sel.market_name}: <span className="font-semibold text-orange-600">{sel.selection}</span>
      </p>
    </div>
  );
}

function TicketCard({ bet }: { bet: TicketCheckResponse }) {
  const codePlain = ticketCodePlain(bet.ticket_code);
  const status = String(bet.status || 'pending').toLowerCase();

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-[#FFFFFF] shadow-sm ring-1 ring-black/[0.03]">
      <div className="relative aspect-[5/2] w-full min-h-[4.5rem] shrink-0 overflow-hidden bg-black sm:aspect-[21/8] sm:min-h-[5.5rem]">
        <img
          src="/ticket/ticket.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-contain object-center"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5 sm:px-4">
        <div className="min-w-0 flex flex-1 items-center gap-2 text-sm text-slate-600">
          <span className="shrink-0 text-slate-400">Ticket</span>
          <span className="truncate font-mono text-xs font-medium text-slate-800 sm:text-sm">
            {codePlain ? `code:${codePlain}` : '—'}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            status === 'won'
              ? 'bg-emerald-100 text-emerald-800'
              : status === 'lost'
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-900'
          }`}
        >
          {slipStatusLabel(status)}
        </span>
      </div>

      <div className="divide-y divide-slate-100 px-3 py-2 sm:px-4">
        {(bet.selections || []).map((sel, idx) => (
          <TicketLeg key={`${bet.id}-${idx}`} sel={sel} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-emerald-900/25 bg-emerald-700 px-3 py-4 text-[#111827] sm:px-4">
        <div>
          <p className="text-[10px] font-medium text-emerald-100/90 sm:text-xs">Stake</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">{Number(bet.stake).toFixed(2)} ETB</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-emerald-100/90 sm:text-xs">Total odds</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">{Number(bet.total_odds).toFixed(2)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium text-amber-100/95 sm:text-xs">Potential win</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-amber-50">
            {Number(bet.possible_win).toFixed(2)} ETB
          </p>
        </div>
      </div>
    </article>
  );
}

export default function CheckTicketClient() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketCheckResponse | null>(null);

  const lookup = useCallback(async (raw: string) => {
    const trimmed = stripTicketInputPrefixes(raw);
    if (!trimmed) {
      setError('Enter your ticket code');
      setTicket(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTicketCheckByCode(trimmed);
      setTicket(data);
    } catch (err) {
      setTicket(null);
      setError(err instanceof Error ? err.message : 'Could not find this ticket');
    } finally {
      setLoading(false);
    }
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void lookup(code);
  };

  const reset = () => {
    setCode('');
    setTicket(null);
    setError(null);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#EEF4FF] text-[#111827]">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] px-4">
        <Link
          href="/"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F5F9FF] hover:text-[#111827]"
          aria-label="Back to home"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-base font-bold text-[#FF8C00]">Check ticket</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        {!ticket ? (
          <div className="mx-auto w-full max-w-md">
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                  Ticket code
                </span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (error) setError(null);
                  }}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] px-4 py-3.5 font-mono text-base text-[#111827] placeholder-[#484F58] outline-none focus:border-[#FF8C00] focus:ring-1 focus:ring-[#FF8C00]"
                />
              </label>
              {error ? (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-400" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#FF8C00] py-3.5 text-sm font-bold text-white transition hover:bg-[#e67e00] disabled:opacity-60"
              >
                {loading ? 'Looking up…' : 'Check ticket'}
              </button>
            </form>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-lg space-y-4">
            <TicketCard bet={ticket} />
            <button
              type="button"
              onClick={reset}
              className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] py-3 text-sm font-semibold text-[#FF8C00] transition hover:bg-[#F5F9FF]"
            >
              Check another ticket
            </button>
          </div>
        )}
      </main>

      <nav className="champx-bottom-nav shrink-0">
        <Link href="/" className="champx-nav-item">
          <svg className="champx-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <path d="M2 12h20" />
          </svg>
          <span className="font-semibold">Sport</span>
        </Link>
        <Link href="/" className="champx-nav-item">
          <svg className="champx-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span className="font-semibold">Live</span>
        </Link>
        <Link href="/" className="champx-nav-item">
          <svg className="champx-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span className="font-semibold">Deposit</span>
        </Link>
        <span className="champx-nav-item active">
          <svg className="champx-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span className="font-semibold">Check</span>
        </span>
        <Link href="/" className="champx-nav-item" aria-label="Open betslip on home">
          <svg className="champx-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" ry="1" />
          </svg>
          <span className="font-semibold">Betslip</span>
        </Link>
      </nav>
    </div>
  );
}
