'use client';

import { useEffect, useState } from 'react';
import { getPublicApiBaseUrl } from '../lib/public-api-url';
import { parseJsonResponse } from '../lib/safe-json';
import { BETVERS_AUTH_SUCCESS_EVENT } from '../lib/ui-events';

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialView: 'login' | 'signup';
  onSuccess: (user: any) => void;
};

export default function AuthModal({ isOpen, onClose, initialView, onSuccess }: AuthModalProps) {
  const [view, setView] = useState<'login' | 'signup'>(initialView);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setView(initialView);
    setError(null);
  }, [isOpen, initialView]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (view === 'signup' && password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setIsLoading(true);
    try {
      const fullPhone = `+251${phoneNumber}`;
      const endpoint = view === 'login' ? 'login' : 'signup';
      const response = await fetch(`${getPublicApiBaseUrl()}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ phone: fullPhone, password }),
      });
      const data = await parseJsonResponse<{ error?: string; token?: string; user?: unknown }>(response);
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${view}`);
      }
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onSuccess(data.user);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(BETVERS_AUTH_SUCCESS_EVENT, { detail: { user: data.user } }));
        }
      }
      onClose();
      setPhoneNumber('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message === 'Failed to fetch' ? 'Network error. Check your connection and try again.' : message);
      if (message.includes('not registered')) {
        setView('signup');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled =
    isLoading ||
    !phoneNumber ||
    !password ||
    (view === 'signup' && (!confirmPassword || password !== confirmPassword));

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 modal-overlay"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-[420px] animate-scale-in">
        {/* Glow effect */}
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-[rgba(37,99,235,0.1)] to-transparent pointer-events-none" />

        <div
          className="relative rounded-2xl overflow-hidden bg-white"
          style={{
            border: '1px solid #D9E5FF',
            boxShadow: '0 24px 80px rgba(0,0,0,0.1), 0 0 0 1px rgba(37,99,235,0.05)',
          }}
        >
          {/* Top accent line */}
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#2563EB] to-transparent opacity-60" />

          <div className="px-7 py-8">
            {/* Tab switcher */}
            <div className="flex rounded-xl p-1 mb-8 bg-[#E6EEFF]">
              {(['login', 'signup'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setView(tab); setError(null); }}
                  className="flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200"
                  style={view === tab ? {
                    background: '#FFFFFF',
                    color: '#111827',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  } : {
                    color: '#6B7280',
                  }}
                >
                  {tab === 'login' ? 'Log In' : 'Sign Up'}
                </button>
              ))}
            </div>

            {/* Title */}
            <div className="mb-6">
              <h1 className="text-2xl font-black text-[#111827] tracking-tight">
                {view === 'login' ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="text-[#6B7280] text-sm mt-1">
                {view === 'login' ? 'Log in to continue to BetVerse' : 'Join BetVerse and start winning'}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm text-[#EF4444] animate-fade-in"
                style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase">
                  Phone Number
                </label>
                <div
                  className="flex rounded-xl overflow-hidden transition-all duration-200 bg-[#F9FAFB] border border-[#D9E5FF]"
                >
                  <div className="px-4 py-3 flex items-center justify-center border-r border-[#D9E5FF] bg-[#E6EEFF] select-none">
                    <span className="text-[#111827] font-bold text-sm">+251</span>
                  </div>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="9XX XXX XXX"
                    className="flex-1 bg-transparent px-4 py-3 text-[#111827] text-sm font-semibold placeholder-[#9CA3AF] outline-none focus:ring-0"
                    style={{ caretColor: '#2563EB' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl pl-4 pr-11 py-3 text-[#111827] bg-[#F9FAFB] text-sm font-semibold placeholder-[#9CA3AF] outline-none transition-all duration-200 border border-[#D9E5FF]"
                    style={{ caretColor: '#2563EB' }}
                    onFocus={(e) => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#D9E5FF'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563] transition-colors p-1"
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              {view === 'signup' && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl pl-4 pr-11 py-3 text-[#111827] bg-[#F9FAFB] text-sm font-semibold placeholder-[#9CA3AF] outline-none transition-all duration-200"
                      style={{
                        border: `1px solid ${confirmPassword && password !== confirmPassword ? '#EF4444' : '#D9E5FF'}`,
                        caretColor: '#2563EB',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = confirmPassword && password !== confirmPassword ? '#EF4444' : '#D9E5FF'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-[#EF4444] ml-1">Passwords do not match</p>
                  )}
                </div>
              )}

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className="w-full rounded-xl py-3.5 font-bold text-sm transition-all duration-200 flex justify-center items-center gap-2 active:scale-[0.98]"
                  style={isSubmitDisabled ? {
                    background: '#E6EEFF',
                    color: '#9CA3AF',
                    cursor: 'not-allowed',
                  } : {
                    background: '#2563EB',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                  }}
                >
                  {isLoading ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  ) : (
                    <>
                      {view === 'login' ? 'Log In' : 'Create Account'}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="mt-7 flex items-center gap-3">
              <div className="flex-1 h-px bg-[#D9E5FF]" />
              <span className="text-xs text-[#6B7280] font-medium">
                {view === 'login' ? "New to BetVerse?" : "Already have an account?"}
              </span>
              <div className="flex-1 h-px bg-[#D9E5FF]" />
            </div>
            <button
              type="button"
              onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setError(null); }}
              className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 text-[#2563EB] hover:bg-[#F0FDF4]"
              style={{ border: '1px solid rgba(37,99,235,0.2)' }}
            >
              {view === 'login' ? 'Create a free account →' : 'Log in instead →'}
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center text-[#6B7280] hover:text-[#111827] bg-white shadow-md transition-colors z-20 border border-[#D9E5FF]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
