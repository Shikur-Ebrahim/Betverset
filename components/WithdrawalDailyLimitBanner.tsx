type Props = {
  maxDaily: number;
  withdrawnToday: number;
  remainingToday: number;
};

export default function WithdrawalDailyLimitBanner({
  maxDaily,
  withdrawnToday,
  remainingToday,
}: Props) {
  const atLimit = remainingToday <= 0;

  return (
    <div
      className={`rounded-2xl border-2 p-4 shadow-sm ${
        atLimit ? 'border-amber-200 bg-amber-50' : 'border-[var(--site-border)] bg-[var(--site-surface)]'
      }`}
    >
      <p className={`text-sm font-black ${atLimit ? 'text-amber-950' : 'text-slate-900'}`}>
        Daily limit: {maxDaily.toLocaleString()} ETB
      </p>
      <p className={`mt-1 text-xs font-semibold leading-relaxed ${atLimit ? 'text-amber-900/90' : 'text-slate-600'}`}>
        Withdrawn today: <span className="font-black">{withdrawnToday.toLocaleString()} ETB</span>
        {!atLimit && (
          <>
            {' '}
            · Remaining today: <span className="font-black">{remainingToday.toLocaleString()} ETB</span>
          </>
        )}
        {atLimit && <> — you cannot withdraw more until tomorrow.</>}
      </p>
    </div>
  );
}
