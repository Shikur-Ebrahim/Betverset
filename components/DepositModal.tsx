'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BETVERS_DEPOSIT_PROOF_SUBMITTED_EVENT } from '@/lib/ui-events';
import {
  clearDepositBootstrapCache,
  fetchDepositBootstrap,
  getCachedDepositBootstrap,
  prefetchDepositBootstrap,
  type DepositMethod,
} from '@/lib/deposit-cache';
import { getPublicApiBaseUrl } from '@/lib/public-api-url';

type DepositModalProps = {
  isOpen: boolean;
  onClose: () => void;
  user: any;
};

function readCacheState() {
  const cached = getCachedDepositBootstrap();
  return {
    methods: cached?.methods ?? [],
    step: (cached?.hasPending ? 'pending' : 'amount') as 'amount' | 'details' | 'pending',
    ready: Boolean(cached),
  };
}

export default function DepositModal({ isOpen, onClose, user }: DepositModalProps) {
  const boot = useRef(readCacheState());
  const [methods, setMethods] = useState<DepositMethod[]>(boot.current.methods);
  const [selectedMethod, setSelectedMethod] = useState<DepositMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [step, setStep] = useState<'amount' | 'details' | 'pending'>(boot.current.step);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(!boot.current.ready);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fetchGenRef = useRef(0);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const applyBootstrap = useCallback((data: { hasPending: boolean; methods: DepositMethod[] }) => {
    if (data.hasPending) {
      setStep('pending');
      return;
    }
    setMethods(data.methods);
    setStep('amount');
  }, []);

  const refreshBootstrap = useCallback(
    async (opts?: { silent?: boolean }) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!user?.id || !token) return;

      const gen = ++fetchGenRef.current;
      if (!opts?.silent && !getCachedDepositBootstrap()) {
        setRefreshing(true);
      }

      try {
        const data = await fetchDepositBootstrap();
        if (fetchGenRef.current !== gen) return;
        applyBootstrap(data);
      } catch (e) {
        console.error('Failed to load deposit:', e);
        if (fetchGenRef.current === gen && !getCachedDepositBootstrap()) {
          setError('Could not load deposit methods. Check your connection and try again.');
        }
      } finally {
        if (fetchGenRef.current === gen) setRefreshing(false);
      }
    },
    [user?.id, applyBootstrap]
  );

  useEffect(() => {
    if (!user?.id) {
      fetchGenRef.current += 1;
      setMethods([]);
      setStep('amount');
      setRefreshing(false);
      return;
    }

    const cached = getCachedDepositBootstrap();
    if (cached) applyBootstrap(cached);

    prefetchDepositBootstrap();
    void refreshBootstrap({ silent: Boolean(cached) });
  }, [user?.id, applyBootstrap, refreshBootstrap]);

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    void fetch(`${getPublicApiBaseUrl()}/health`, { cache: 'no-store' }).catch(() => undefined);
    void refreshBootstrap({ silent: true });
  }, [isOpen, user?.id, refreshBootstrap]);

  const minAllowedAmount = useMemo(() => {
    if (methods.length === 0) return 50;
    return Math.min(...methods.map((m) => m.min_amount));
  }, [methods]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    setScreenshot(file);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!amount || !screenshot || !selectedMethod) {
      setError('Please enter amount and upload screenshot');
      return;
    }

    if (parseFloat(amount) < selectedMethod.min_amount) {
      setError(`Min for ${selectedMethod.name} is ${selectedMethod.min_amount} ETB`);
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', screenshot);
      formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '');

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );

      const cloudData = await cloudRes.json();
      if (!cloudData.secure_url) throw new Error('Screenshot upload failed');

      const response = await fetch(`${getPublicApiBaseUrl()}/user/deposit-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          userId: user.id,
          methodId: selectedMethod.id,
          amount: parseFloat(amount),
          screenshotUrl: cloudData.secure_url,
        }),
      });

      if (response.ok) {
        clearDepositBootstrapCache();
        setStep('pending');
        window.dispatchEvent(new CustomEvent(BETVERS_DEPOSIT_PROOF_SUBMITTED_EVENT));
      } else {
        setError('Failed to submit request');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setUploading(false);
    }
  };

  if (!user?.id) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-end justify-center sm:items-center ${
        isOpen ? '' : 'pointer-events-none invisible'
      }`}
      aria-hidden={!isOpen}
    >
      <MotionlessBackdrop isOpen={isOpen} onClose={onClose} />

      <div className="relative flex h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[32px] bg-[#FFFFFF] shadow-2xl sm:h-auto sm:rounded-[32px]">
        <header className="flex shrink-0 items-center justify-between border-b border-gray-50 px-6 py-6">
          <div className="text-2xl font-black tracking-tighter text-[#111827]">Deposit</div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-all active:scale-90"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 pb-24">
          {step === 'pending' ? (
            <div className="flex flex-col items-center justify-center space-y-6 py-12 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-orange-50 text-orange-500 ring-4 ring-orange-100">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="max-w-[280px] space-y-2">
                <MotionlessPendingTitle />
                <div className="text-sm font-medium leading-relaxed text-gray-500">
                  You already have a deposit request waiting for verification. We will update your balance once it is
                  approved.
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-[20px] bg-gray-900 py-4.5 text-sm font-bold text-[#111827] shadow-lg shadow-gray-200 transition-all active:scale-95"
              >
                Close
              </button>
            </div>
          ) : step === 'amount' ? (
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="ml-1 text-sm font-bold text-gray-400">Enter amount</div>
                <div className="group relative">
                  <input
                    type="number"
                    placeholder={`Min: ${minAllowedAmount.toFixed(2)}`}
                    className="w-full rounded-[24px] border-2 border-transparent bg-[#F8FAFC] px-6 py-5 text-2xl font-black text-white shadow-inner outline-none transition-all placeholder:text-gray-400 focus:border-orange-500 focus:bg-[#FFFFFF]"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      if (error) setError(null);
                    }}
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-black tracking-tight text-orange-500">
                    ETB
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="ml-1 text-sm font-bold text-gray-400">Select method</div>
                {refreshing && methods.length === 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-[132px] animate-pulse rounded-[28px] border-2 border-gray-50 bg-gray-100"
                      />
                    ))}
                  </div>
                ) : methods.length === 0 ? (
                  <p className="text-center text-sm font-medium text-gray-500">No payment methods available.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (!amount || parseFloat(amount) < minAllowedAmount) {
                            setError(`Please enter amount (Min: ${minAllowedAmount} ETB)`);
                            return;
                          }
                          setSelectedMethod(m);
                          setStep('details');
                        }}
                        className="flex flex-col items-center gap-4 rounded-[28px] border-2 border-gray-50 bg-[#FFFFFF] p-6 shadow-sm transition-all hover:border-orange-500 active:scale-95"
                      >
                        <div className="flex h-14 w-16 items-center justify-center">
                          <img src={m.logo_url} alt={m.name} className="h-full w-full object-contain" />
                        </div>
                        <div className="text-sm font-bold tracking-tight text-gray-900">{m.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-[28px] border border-orange-100/50 bg-[#FFF9F5] p-5">
                <div className="mb-5 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl border border-orange-100 bg-[#FFFFFF] p-1.5 shadow-sm">
                    <img src={selectedMethod?.logo_url} className="h-full w-full object-contain" alt="" />
                  </div>
                  <div>
                    <div className="text-sm font-bold tracking-tight text-gray-900">{selectedMethod?.name}</div>
                    <MotionlessTransferAmount amount={amount} />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-[20px] border border-orange-50/50 bg-[#FFFFFF] p-4 shadow-sm">
                  <div className="overflow-hidden">
                    <div className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Name: {selectedMethod?.account_name}
                    </div>
                    <div className="truncate text-lg font-black tracking-tighter text-white">
                      {selectedMethod?.account_details}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedMethod?.account_details || '')}
                    className={`ml-4 flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 transition-all active:scale-90 ${
                      copied
                        ? 'border-green-100 bg-green-50 text-green-600'
                        : 'border-orange-100 bg-orange-50 text-orange-600'
                    }`}
                  >
                    {copied ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="text-[11px] font-black uppercase tracking-tight">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span className="text-[11px] font-black uppercase tracking-tight">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="ml-1 text-sm font-bold text-gray-400">Upload screenshot</div>
                <div className="group relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  />
                  <div className="flex w-full flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-gray-100 bg-[#F8FAFC] p-6 transition-all group-hover:border-orange-500/30">
                    {previewUrl ? (
                      <div className="relative h-20 w-20 rounded-lg bg-[#FFFFFF] p-1.5 shadow-sm">
                        <img src={previewUrl} className="h-full w-full rounded object-contain" alt="Preview" />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFFFF] text-gray-400 shadow-sm">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                    )}
                    <div className="text-[11px] font-bold uppercase tracking-tight text-gray-600">
                      {screenshot ? screenshot.name : 'Choose evidence'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('amount')}
                  className="flex-1 rounded-[20px] bg-gray-50 py-4.5 text-sm font-bold text-gray-500 transition-all active:scale-95"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={uploading}
                  className="flex-[2] rounded-[20px] bg-orange-500 py-4.5 text-sm font-bold text-[#111827] shadow-lg shadow-orange-100 transition-all active:scale-95 disabled:opacity-60"
                >
                  Confirm deposit
                </button>
              </div>
            </div>
          )}
        </main>

        {error && (
          <div className="absolute bottom-6 left-6 right-6 z-[210]">
            <div className="flex items-center gap-3 rounded-[18px] border border-gray-700/50 bg-[#1A202C] px-5 py-3.5 text-[#111827] shadow-2xl backdrop-blur-sm">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </div>
              <div className="text-[13px] font-bold tracking-tight">{error}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MotionlessBackdrop({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 bg-black/70 backdrop-blur-md"
      onClick={() => isOpen && onClose()}
      aria-hidden
    />
  );
}

function MotionlessPendingTitle() {
  return <div className="text-xl font-black tracking-tight text-gray-900">Deposit in review</div>;
}

function MotionlessTransferAmount({ amount }: { amount: string }) {
  return (
    <div className="text-xs font-medium text-orange-600">
      Transfer <span className="font-bold underline">{amount} ETB</span>
    </div>
  );
}
