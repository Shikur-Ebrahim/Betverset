import { SITE_URL } from '@/lib/site-metadata';

/** How to obtain an agent ID code (step 2 — after deposit minimum is met). */
export default function WithdrawalAgentCodeHint() {
  return (
    <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 text-xs font-semibold leading-relaxed text-slate-600 shadow-sm">
      To get your agent ID code, contact your agent or share this site — you will receive the code:{' '}
      <span className="break-all font-bold text-white">{SITE_URL}</span>
    </div>
  );
}
