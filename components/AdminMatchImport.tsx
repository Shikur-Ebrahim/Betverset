'use client';

import { useCallback, useRef, useState } from 'react';
import { getPublicApiBaseUrl } from '@/lib/public-api-url';

const API_BASE = getPublicApiBaseUrl();

function getDateStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function getDayLabel(offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' });
}

const DAYS = [0, 1, 2, 3, 4, 5, 6];

type DayStatus = 'idle' | 'loading' | 'done' | 'error';

type Props = { onClose: () => void };

export default function AdminMatchImport({ onClose }: Props) {
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [dayStatus, setDayStatus] = useState<Record<number, DayStatus>>({});
  const [dayResult, setDayResult] = useState<Record<number, { imported: number; oddsSaved: number }>>({});
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const appendLog = useCallback((lines: string[]) => {
    setLog(prev => {
      const next = [...prev, ...lines];
      return next.slice(-200); // keep last 200 lines
    });
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, 50);
  }, []);

  const importDay = useCallback(async (offset: number) => {
    const dateStr = getDateStr(offset);
    const label = getDayLabel(offset);

    setActiveDay(offset);
    setLog([]);
    setDayStatus(prev => ({ ...prev, [offset]: 'loading' }));
    appendLog([`━━━ Starting import: ${label} (${dateStr}) ━━━`, '']);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) (headers as any)['Authorization'] = `Bearer ${token}`;

      appendLog(['🔄 Connecting to API-Football...']);

      const res = await fetch(`${API_BASE}/admin/matches/import?date=${dateStr}`, { headers });
      const data = await res.json();

      if (data.log && Array.isArray(data.log)) {
        appendLog(data.log);
      }

      if (data.ok) {
        appendLog(['', `✅ Done! ${data.imported} matches imported, ${data.oddsSaved} odds saved.`]);
        setDayStatus(prev => ({ ...prev, [offset]: 'done' }));
        setDayResult(prev => ({ ...prev, [offset]: { imported: data.imported || 0, oddsSaved: data.oddsSaved || 0 } }));
      } else {
        appendLog(['', `❌ Import failed: ${data.error || 'Unknown error'}`]);
        setDayStatus(prev => ({ ...prev, [offset]: 'error' }));
      }
    } catch (err: any) {
      appendLog(['', `❌ Network error: ${err.message}`]);
      setDayStatus(prev => ({ ...prev, [offset]: 'error' }));
    }
  }, [appendLog]);

  return (
    <div className="fixed inset-0 z-[150] bg-[#0F172A] text-white flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-[#1E293B] shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1E293B] text-[#94A3B8] active:scale-95 transition-transform"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="text-[17px] font-black tracking-tight text-white">Match Import</h1>
          <p className="text-[11px] text-[#64748B] font-medium">Import fixtures + odds from API-Football</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Day Buttons */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#475569] mb-3">Select a day to import</p>
          <div className="space-y-2">
            {DAYS.map(offset => {
              const status = dayStatus[offset] || 'idle';
              const result = dayResult[offset];
              const isActive = activeDay === offset;
              const dateStr = getDateStr(offset);
              const label = getDayLabel(offset);

              return (
                <div
                  key={offset}
                  className={`rounded-2xl border transition-all ${
                    isActive
                      ? 'border-[#2563EB] bg-[#1E293B]'
                      : status === 'done'
                      ? 'border-[#16A34A]/50 bg-[#0F2A1A]'
                      : status === 'error'
                      ? 'border-red-500/40 bg-red-950/30'
                      : 'border-[#1E293B] bg-[#1E293B]/50'
                  }`}
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[14px] font-bold ${
                          offset === 0 ? 'text-[#2563EB]' : 'text-white'
                        }`}>{label}</span>
                        {offset === 0 && (
                          <span className="text-[9px] font-black uppercase tracking-widest bg-[#2563EB]/20 text-[#2563EB] px-2 py-0.5 rounded-full">
                            Priority
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#64748B]">{dateStr}</span>
                      {result && (
                        <div className="text-[10px] text-[#16A34A] font-bold mt-0.5">
                          {result.imported} matches · {result.oddsSaved.toLocaleString()} odds saved
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => importDay(offset)}
                      disabled={status === 'loading'}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all active:scale-95 disabled:opacity-60 ${
                        status === 'done'
                          ? 'bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/40'
                          : status === 'loading'
                          ? 'bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/40'
                          : status === 'error'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-[#2563EB] text-white shadow-lg shadow-[#2563EB]/30'
                      }`}
                    >
                      {status === 'loading' ? (
                        <>
                          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                          Importing...
                        </>
                      ) : status === 'done' ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Re-import
                        </>
                      ) : status === 'error' ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          Retry
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          Import
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress Log Terminal */}
        {log.length > 0 && (
          <div className="px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#475569] mb-2">Import Log</p>
            <div
              ref={logRef}
              className="bg-[#020617] rounded-2xl border border-[#1E293B] p-4 font-mono text-[11px] text-[#94A3B8] h-64 overflow-y-auto space-y-0.5 leading-relaxed"
            >
              {log.map((line, i) => {
                const isSuccess = line.startsWith('✅') || line.includes('✓');
                const isError = line.startsWith('❌') || line.toLowerCase().includes('error');
                const isSection = line.startsWith('━━━');
                return (
                  <div
                    key={i}
                    className={
                      isSuccess ? 'text-[#16A34A] font-bold' :
                      isError ? 'text-red-400 font-bold' :
                      isSection ? 'text-[#2563EB] font-bold' :
                      line.startsWith('  →') ? 'text-[#F59E0B]' :
                      'text-[#94A3B8]'
                    }
                  >
                    {line || '\u00A0'}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="px-4 pb-6">
          <div className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4 space-y-2">
            <p className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">How it works</p>
            <div className="space-y-1.5 text-[11px] text-[#64748B] leading-relaxed">
              <div className="flex gap-2"><span className="text-[#2563EB]">→</span><span>Fetches all fixtures from API-Football for the selected day</span></div>
              <div className="flex gap-2"><span className="text-[#2563EB]">→</span><span>Only imports fixtures that have betting odds available</span></div>
              <div className="flex gap-2"><span className="text-[#2563EB]">→</span><span>Saves max 50 matches per day with ALL betting markets</span></div>
              <div className="flex gap-2"><span className="text-[#F59E0B]">→</span><span>After importing today, import tomorrow, then Day 3... etc</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
