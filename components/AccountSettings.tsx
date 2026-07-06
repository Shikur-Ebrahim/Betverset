import { useState, useEffect } from 'react';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';

const API_BASE = getPublicApiBaseUrl();

type AccountSettingsProps = {
  isOpen: boolean;
  onClose: () => void;
  user: any;
};

export default function AccountSettings({ isOpen, onClose, user }: AccountSettingsProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/user/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.message || 'Failed to change password');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="relative bg-[var(--site-surface)] w-full h-[92vh] sm:h-auto sm:max-w-md rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col">
        <header className="bg-[var(--site-surface)] px-6 py-6 flex items-center justify-between border-b border-[var(--site-border)] shrink-0">
          <div className="text-2xl font-black text-white tracking-tighter">Account settings</div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-[var(--site-bg)] text-gray-400 rounded-full transition-all active:scale-90">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 pb-20">
          <div className="mb-8">
            <div className="text-[11px] font-black text-gray-400 mb-1">Phone number</div>
            <div className="text-lg font-black text-white">{user?.phone}</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-400 ml-1">Current password</label>
              <input 
                type="password" 
                required
                className="w-full bg-[var(--site-surface-soft)] border-2 border-transparent rounded-[20px] px-5 py-4 font-bold text-white focus:bg-[var(--site-surface)] focus:border-orange-500 outline-none transition-all"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-400 ml-1">New password</label>
              <input 
                type="password" 
                required
                className="w-full bg-[var(--site-surface-soft)] border-2 border-transparent rounded-[20px] px-5 py-4 font-bold text-white focus:bg-[var(--site-surface)] focus:border-orange-500 outline-none transition-all"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-400 ml-1">Confirm new password</label>
              <input 
                type="password" 
                required
                className="w-full bg-[var(--site-surface-soft)] border-2 border-transparent rounded-[20px] px-5 py-4 font-bold text-white focus:bg-[var(--site-surface)] focus:border-orange-500 outline-none transition-all"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-green-500 text-white rounded-[24px] font-black text-sm active:scale-95 transition-all disabled:bg-gray-400 mt-4"
            >
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </main>

        {error && (
          <div className="absolute bottom-6 left-6 right-6 z-[210] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-[#1A202C] text-white px-5 py-4 rounded-[18px] shadow-2xl flex items-center gap-3 border border-gray-700">
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </div>
              <div className="text-sm font-bold tracking-tight">{error}</div>
            </div>
          </div>
        )}

        {success && (
          <div className="absolute bottom-6 left-6 right-6 z-[210] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-green-600 text-white px-5 py-4 rounded-[18px] shadow-2xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--site-surface)]/20 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="text-sm font-bold tracking-tight">Password updated successfully!</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
