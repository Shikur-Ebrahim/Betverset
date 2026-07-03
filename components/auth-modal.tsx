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

  useEffect(() => {
    if (!isOpen) return;
    void fetch(`${getPublicApiBaseUrl()}/health`, { cache: 'no-store' }).catch(() => undefined);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view === 'signup' && password !== confirmPassword) {
      alert("Passwords don't match");
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

      onClose(); // Close modal on success
      
      // Optionally reset form
      setPhoneNumber('');
      setPassword('');
      setConfirmPassword('');
      
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      alert(message === 'Failed to fetch' ? 'Network error. Check your connection and try again.' : message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-xl shadow-2xl p-6 sm:p-8 relative overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-[#A0AEC0] hover:text-[#1A202C] transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        {/* Subtle top glow accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FF8C00] to-transparent opacity-50"></div>
        
        <h1 className="text-2xl font-black text-[#1A202C] text-center mb-2 tracking-tight">
          {view === 'login' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-[#4A5568] text-center text-sm mb-8">
          {view === 'login' ? 'Login to your account to continue' : 'Join us to start betting today'}
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#4A5568] tracking-wide uppercase ml-1">Phone Number</label>
            <div className="flex bg-white border border-[#CBD5E1] rounded-lg overflow-hidden focus-within:border-[#FF8C00] focus-within:ring-1 focus-within:ring-[#FF8C00] transition-all">
              <div className="bg-[#F1F5F9] px-4 py-3 flex items-center justify-center border-r border-[#CBD5E1] select-none">
                <span className="text-[#1A202C] font-bold text-sm">+251</span>
              </div>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="9XX XXX XXX"
                className="flex-1 bg-transparent px-4 py-3 text-[#1A202C] text-sm font-semibold placeholder-[#94A3B8] outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#4A5568] tracking-wide uppercase ml-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white border border-[#CBD5E1] rounded-lg px-4 py-3 text-[#1A202C] text-sm font-semibold placeholder-[#94A3B8] outline-none focus:border-[#FF8C00] focus:ring-1 focus:ring-[#FF8C00] transition-all"
            />
          </div>

          {view === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4A5568] tracking-wide uppercase ml-1">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-[#CBD5E1] rounded-lg px-4 py-3 text-[#1A202C] text-sm font-semibold placeholder-[#94A3B8] outline-none focus:border-[#FF8C00] focus:ring-1 focus:ring-[#FF8C00] transition-all"
              />
            </div>
          )}

          {view === 'login' && (
            <div className="flex justify-end pt-1">
              <button type="button" className="text-xs text-[#FF8C00] hover:text-[#E67E00] font-semibold transition-colors">Forgot password?</button>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !phoneNumber || !password || (view === 'signup' && (!confirmPassword || password !== confirmPassword))}
              className="w-full bg-[#FF8C00] hover:bg-[#E67E00] disabled:bg-[#30363D] disabled:text-[#8B949E] text-white font-bold rounded-lg py-3.5 shadow-[0_4px_14px_rgba(255,140,0,0.3)] disabled:shadow-none transition-all active:scale-[0.98] flex justify-center items-center"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                view === 'login' ? 'Log In' : 'Sign Up'
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center border-t border-[#E2E8F0] pt-6">
          <p className="text-sm text-[#4A5568]">
            {view === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button"
              onClick={() => setView(view === 'login' ? 'signup' : 'login')}
              className="text-[#FF8C00] hover:text-[#E67E00] font-bold ml-1 transition-colors"
            >
              {view === 'login' ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
