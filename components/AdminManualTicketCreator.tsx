'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type AdminManualTicketRow } from '../lib/api';

type Club = {
  id: number;
  name: string;
  logo: string;
  league_name: string | null;
  country_code: string | null;
  country_name: string | null;
};

type SmallLeagueRow = {
  id: number;
  league_name: string | null;
  country_code: string | null;
  country_name: string | null;
};

type MatchDraft = {
  home_team_id: number | '';
  away_team_id: number | '';
  selection: string;
  odd: string;
  market_name: string;
  kickoff: string;
  end: string;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toDatetimeLocalValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Stagger kickoffs so the three legs do not share the same window by default. */
function defaultKickoffEndForSlot(slotIndex: number): { kickoff: string; end: string } {
  const kick = new Date();
  kick.setMinutes(0, 0, 0);
  kick.setHours(kick.getHours() + 2 + slotIndex * 3);
  const end = new Date(kick.getTime() + 90 * 60 * 1000);
  return { kickoff: toDatetimeLocalValue(kick), end: toDatetimeLocalValue(end) };
}

/** Match 1–2: Correct score. Match 3: Draw. Odds/times are placeholders — change freely; after end time all legs still settle as won. */
function defaultMatchSlot(slotIndex: 0 | 1 | 2): MatchDraft {
  const { kickoff, end } = defaultKickoffEndForSlot(slotIndex);
  if (slotIndex === 0) {
    return {
      home_team_id: '',
      away_team_id: '',
      market_name: 'Correct score',
      selection: '1-0',
      odd: '8.50',
      kickoff,
      end,
    };
  }
  if (slotIndex === 1) {
    return {
      home_team_id: '',
      away_team_id: '',
      market_name: 'Correct score',
      selection: '2-1',
      odd: '11.00',
      kickoff,
      end,
    };
  }
  return {
    home_team_id: '',
    away_team_id: '',
    market_name: 'Draw',
    selection: 'X',
    odd: '3.25',
    kickoff,
    end,
  };
}

function initialThreeMatches(): MatchDraft[] {
  return [defaultMatchSlot(0), defaultMatchSlot(1), defaultMatchSlot(2)];
}

function countryLabel(c: { country_code?: string | null; country_name?: string | null } | undefined): string {
  if (!c) return '';
  const parts = [c.country_name, c.country_code].filter((x) => x && String(x).trim());
  return parts.length ? parts.join(' · ') : '';
}

function clubOptionLabel(c: Club): string {
  const league = c.league_name?.trim() || 'League';
  const loc = countryLabel(c);
  return loc ? `${c.name} — ${league} (${loc})` : `${c.name} — ${league}`;
}

type Props = {
  onClose: () => void;
};

export default function AdminManualTicketCreator({ onClose }: Props) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [clubs, setClubs] = useState<Club[]>([]);
  const [savedMatches, setSavedMatches] = useState<any[]>([]);
  const [smallLeagues, setSmallLeagues] = useState<SmallLeagueRow[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [clubsError, setClubsError] = useState<string | null>(null);
  const [refreshingMatches, setRefreshingMatches] = useState(false);
  const [matches, setMatches] = useState<MatchDraft[]>(() => initialThreeMatches());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [presets, setPresets] = useState<AdminManualTicketRow[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const loadClubs = useCallback(async () => {
    setClubsLoading(true);
    setClubsError(null);
    try {
      const data = await api.getAdminManualTicketClubs(date);
      setClubs(data.clubs || []);
      setSavedMatches(data.matches || []);
      setSmallLeagues(Array.isArray(data.small_leagues) ? data.small_leagues : []);
    } catch (e) {
      setClubsError(e instanceof Error ? e.message : 'Failed to load clubs');
      setClubs([]);
      setSavedMatches([]);
      setSmallLeagues([]);
    } finally {
      setClubsLoading(false);
    }
  }, [date]);

  const loadPresets = useCallback(async () => {
    setListLoading(true);
    try {
      const rows = await api.listAdminManualTickets();
      setPresets(rows);
    } catch {
      setPresets([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  const handleRefreshClubs = async () => {
    setRefreshingMatches(true);
    try {
      await api.refreshAdminManualTicketMatches();
      await loadClubs();
    } catch (e) {
      setClubsError(e instanceof Error ? e.message : 'Failed to refresh matches');
    } finally {
      setRefreshingMatches(false);
    }
  };

  useEffect(() => {
    void loadClubs();
  }, [loadClubs]);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  const clubById = useMemo(() => new Map(clubs.map((c) => [c.id, c])), [clubs]);

  const copyCodeText = useCallback(async (text: string) => {
    const t = String(text || '')
      .trim()
      .toUpperCase();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      setCopyFeedback('copied');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopyFeedback('copied');
      } catch {
        setCopyFeedback('failed');
      }
    }
    window.setTimeout(() => setCopyFeedback('idle'), 2200);
  }, []);

  const copyLastCode = useCallback(() => {
    if (lastCode) void copyCodeText(lastCode);
  }, [lastCode, copyCodeText]);

  const setMatch = (i: number, patch: Partial<MatchDraft>) => {
    setMatches((prev) => prev.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  };

  const applyEndPlus90 = (i: number) => {
    const m = matches[i];
    if (!m.kickoff) return;
    const d = new Date(m.kickoff);
    if (Number.isNaN(d.getTime())) return;
    setMatch(i, { end: toDatetimeLocalValue(new Date(d.getTime() + 90 * 60 * 1000)) });
  };

  const submit = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const payload = matches.map((m) => {
        const hid = Number(m.home_team_id);
        const aid = Number(m.away_team_id);
        const odd = parseFloat(m.odd);
        if (!Number.isFinite(hid) || !Number.isFinite(aid)) throw new Error('Pick home and away club for each match');
        if (!Number.isFinite(odd) || odd < 1.01) throw new Error('Invalid odds');
        const kick = new Date(m.kickoff);
        const end = new Date(m.end);
        if (Number.isNaN(kick.getTime()) || Number.isNaN(end.getTime())) throw new Error('Invalid times');
        if (end <= kick) throw new Error('End time must be after kickoff');
        return {
          home_team_id: hid,
          away_team_id: aid,
          selection: m.selection.trim(),
          odd,
          market_name: m.market_name.trim() || '1X2',
          manual_kickoff_at: kick.toISOString(),
          manual_end_at: end.toISOString(),
        };
      });
      const created = await api.createAdminManualTicket(payload);
      const code = String(created.ticket_code).trim().toUpperCase();
      setLastCode(code);
      void copyCodeText(code);
      setMatches(initialThreeMatches());
      await loadPresets();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex flex-col bg-[#F8FAFC] text-[#1A202C]">
      <header className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[#E2E8F0] px-4 py-2 text-xs font-bold text-[#475569]"
        >
          Back
        </button>
        <div className="text-center">
          <div className="text-xs font-black uppercase tracking-widest text-[#64748B]">Create Bet</div>
          <div className="text-sm font-black">Manual ticket (3 legs)</div>
        </div>
        <div className="w-[72px]" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <section className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="text-xs font-bold text-[#64748B]">
              Club pool day
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="ml-2 rounded-lg border border-[#E2E8F0] px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={handleRefreshClubs}
              disabled={refreshingMatches}
              className="rounded-full bg-[#1A202C] px-4 py-1.5 text-xs font-bold text-white disabled:bg-gray-400"
            >
              {refreshingMatches ? 'Fetching...' : 'Refresh clubs'}
            </button>
          </div>
          {clubsLoading && (
            <p className="text-sm text-[#64748B]">
              Loading saved matches from database...
            </p>
          )}
          {clubsError && <p className="text-sm text-red-600">{clubsError}</p>}
          {!clubsLoading && !clubsError && (
            <p className="mb-3 text-[11px] leading-relaxed text-[#64748B]">
              Club pool is populated from the most recent 100 non-elite league matches saved in the database.
              <br />
              <span className="font-bold text-[#334155]">Ticket defaults:</span> Match 1 &amp; 2 — Correct score; Match
              3 — Draw. After each leg&apos;s end time, every manual leg is marked won (preset has no wallet balance).
            </p>
          )}
          {!clubsLoading && !clubsError && savedMatches.length > 0 && (
            <div className="mb-4 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-3">
              <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#64748B]">
                Matches Database (Most recent {savedMatches.length} shown)
              </div>
              <div className="max-h-48 overflow-y-auto text-[10px] leading-snug text-[#475569] space-y-1">
                {savedMatches.map((m) => (
                  <div key={m.id} className="border-b border-[#E2E8F0] pb-1 last:border-0 flex justify-between">
                    <span className="font-bold text-[#334155]">{m.home_team_name} vs {m.away_team_name}</span>
                    <span className="text-[#64748B]">{new Date(m.match_date).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!clubsLoading && !clubsError && smallLeagues.length > 0 && (
            <div className="mb-4 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-3">
              <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#64748B]">
                Smaller leagues in database (up to {smallLeagues.length} shown)
              </div>
              <div className="max-h-36 overflow-y-auto text-[10px] leading-snug text-[#475569]">
                {smallLeagues.map((lg) => (
                  <div key={lg.id} className="border-b border-[#E2E8F0] py-1 last:border-0">
                    <span className="font-bold text-[#334155]">{lg.league_name || 'League'}</span>
                    {countryLabel(lg) ? <span className="text-[#64748B]"> · {countryLabel(lg)}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!clubsLoading && !clubsError && (
            <>
              <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#64748B]">
                Club Picker (Clubs from saved matches)
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10">
                {clubs.map((c) => (
                  <div
                    key={c.id}
                    title={clubOptionLabel(c)}
                    className="flex flex-col items-center gap-1 rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] p-2 text-center"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.logo} alt="" className="h-8 w-8 object-contain" />
                    <span className="line-clamp-2 text-[9px] font-bold leading-tight text-[#334155]">{c.name}</span>
                    <span className="line-clamp-2 text-[8px] font-semibold leading-tight text-[#64748B]">
                      {c.league_name || '—'}
                    </span>
                    {countryLabel(c) ? (
                      <span className="line-clamp-1 text-[7px] uppercase tracking-tight text-[#94A3B8]">
                        {countryLabel(c)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {[0, 1, 2].map((i) => (
          <section key={i} className="mb-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-[#64748B]">
              Match {i + 1}
              <span className="ml-2 font-bold normal-case text-emerald-700">
                {i < 2 ? '· Correct score' : '· Draw'}
              </span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-[#475569]">
                Home club
                <select
                  value={matches[i].home_team_id === '' ? '' : String(matches[i].home_team_id)}
                  onChange={(e) => setMatch(i, { home_team_id: e.target.value ? Number(e.target.value) : '' })}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {clubs.map((c) => (
                    <option key={`h-${i}-${c.id}`} value={c.id}>
                      {clubOptionLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-[#475569]">
                Away club
                <select
                  value={matches[i].away_team_id === '' ? '' : String(matches[i].away_team_id)}
                  onChange={(e) => setMatch(i, { away_team_id: e.target.value ? Number(e.target.value) : '' })}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {clubs.map((c) => (
                    <option key={`a-${i}-${c.id}`} value={c.id}>
                      {clubOptionLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-[#475569]">
                Market label
                <input
                  value={matches[i].market_name}
                  onChange={(e) => setMatch(i, { market_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
                  placeholder={i < 2 ? 'Correct score' : 'Draw'}
                />
              </label>
              <label className="block text-xs font-bold text-[#475569]">
                Selection (pick text)
                <input
                  value={matches[i].selection}
                  onChange={(e) => setMatch(i, { selection: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
                  placeholder={i < 2 ? 'e.g. 1-0, 2-1' : 'X or Draw'}
                />
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block text-xs font-bold text-[#475569]">
                Odd
                <input
                  value={matches[i].odd}
                  onChange={(e) => setMatch(i, { odd: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#475569]">
                Kickoff (local)
                <input
                  type="datetime-local"
                  value={matches[i].kickoff}
                  onChange={(e) => setMatch(i, { kickoff: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
                />
              </label>
              <div>
                <label className="block text-xs font-bold text-[#475569]">
                  End (e.g. +90 min)
                  <input
                    type="datetime-local"
                    value={matches[i].end}
                    onChange={(e) => setMatch(i, { end: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => applyEndPlus90(i)}
                  className="mt-1 text-[10px] font-bold uppercase text-emerald-600"
                >
                  Set end = kickoff + 90m
                </button>
              </div>
            </div>
            {matches[i].home_team_id && matches[i].away_team_id && (() => {
              const home = clubById.get(Number(matches[i].home_team_id));
              const away = clubById.get(Number(matches[i].away_team_id));
              const loc = countryLabel(home);
              return (
                <p className="mt-2 text-[11px] text-[#64748B]">
                  {home?.name ?? '?'} vs {away?.name ?? '?'} — {home?.league_name || 'League'}
                  {loc ? <span className="text-[#94A3B8]"> ({loc})</span> : null}
                </p>
              );
            })()}
          </section>
        ))}

        {submitError && <p className="mb-2 text-sm font-bold text-red-600">{submitError}</p>}
        {lastCode && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
            <div className="flex flex-wrap items-center gap-2">
              <span>Ticket created:</span>
              <span className="font-mono tracking-wider">{lastCode}</span>
              <button
                type="button"
                onClick={() => void copyLastCode()}
                className="rounded-full bg-emerald-700 px-4 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow-sm transition-opacity hover:opacity-90 active:scale-[0.98]"
              >
                {copyFeedback === 'copied' ? 'Copied' : copyFeedback === 'failed' ? 'Copy failed' : 'Copy code'}
              </button>
            </div>
            {(copyFeedback === 'copied' || copyFeedback === 'failed') && (
              <p className="mb-1 text-[11px] font-bold text-emerald-900">
                {copyFeedback === 'copied'
                  ? 'Copied to clipboard — paste it in the bet slip ticket field.'
                  : 'Clipboard unavailable — use Copy code below.'}
              </p>
            )}
            <span className="mt-1 block text-xs font-normal text-emerald-800">
              The code is copied automatically when the ticket is created (same click). Use <strong>Copy code</strong> to
              copy again. Users enter this code in the bet slip. After each leg&apos;s end time, every manual leg is
              marked won (two correct-score legs + one draw by default — still all win after end; no balance on this
              preset row).
            </span>
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={() => void submit()}
          className="w-full rounded-2xl bg-emerald-600 py-4 text-sm font-black uppercase tracking-wide text-white shadow-lg disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create ticket & code'}
        </button>

        <section className="mt-8 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B]">Recent manual tickets</h3>
            <button type="button" onClick={() => void loadPresets()} className="text-[10px] font-bold text-[#64748B]">
              Refresh
            </button>
          </div>
          {listLoading && <p className="text-sm text-[#64748B]">Loading…</p>}
          {!listLoading && presets.length === 0 && <p className="text-sm text-[#64748B]">None yet.</p>}
          <ul className="space-y-3">
            {presets.map((p) => (
              <li key={p.id} className="rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-black tracking-wider">{p.ticket_code}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 font-bold uppercase text-[#475569]">{p.status}</span>
                </div>
                <ul className="mt-2 space-y-1 text-[11px] text-[#475569]">
                  {(p.selections || []).map((s, idx) => {
                    const res = String(s.result || '').toLowerCase();
                    const ended = Boolean(s.manual_end_at && new Date(s.manual_end_at).getTime() <= Date.now());
                    const showWin = res === 'won' || (p.status === 'won' && ended);
                    return (
                      <li key={idx} className="flex flex-wrap justify-between gap-1 border-t border-[#E2E8F0] pt-1">
                        <span>
                          {s.home_team} vs {s.away_team} — {s.selection} @ {s.odd}
                        </span>
                        <span className={showWin ? 'font-black text-emerald-600' : ''}>
                          {showWin ? 'Win' : ended ? 'Awaiting settlement' : 'Pending'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
