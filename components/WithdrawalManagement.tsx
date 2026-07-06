import { useState, useEffect } from 'react';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';
import { uploadImageToCloudinary } from '@/lib/cloudinary-upload';

const API_BASE = getPublicApiBaseUrl();

type WithdrawalMethod = {
  id: number;
  name: string;
  type: 'bank' | 'wallet';
  logo_url: string;
};

const ETHIOPIAN_BANKS = [
  'Commercial Bank of Ethiopia',
  'Development Bank',
  'Dashan Bank',
  'Bank of Abissinaiya',
  'Awash Bank',
  'Wegagen Bank',
  'Nib Bank',
  'United Bank',
  'Bank of Oromia',
  'Zemen Bank',
  'Buna Bank',
  'Abay Bank',
  'Amhara Bank',
];

const WALLETS = ['telebirr', 'CBE birr', 'Amole', 'Mpesa'];

type WithdrawalManagementProps = {
  onClose: () => void;
};

async function parseJsonResponse(response: Response): Promise<{ message?: string }> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export default function WithdrawalManagement({ onClose }: WithdrawalManagementProps) {
  const [methods, setMethods] = useState<WithdrawalMethod[]>([]);
  const [type, setType] = useState<'bank' | 'wallet'>('bank');
  const [selectedName, setSelectedName] = useState(ETHIOPIAN_BANKS[0]);

  const [logo, setLogo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMethods();
  }, []);

  useEffect(() => {
    setSelectedName(type === 'bank' ? ETHIOPIAN_BANKS[0] : WALLETS[0]);
  }, [type]);

  const fetchMethods = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/withdrawal-methods`);
      if (!response.ok) throw new Error('Failed to fetch withdrawal methods');
      const data = await response.json();
      setMethods(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch methods:', error);
      setMethods([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      setLogo(file);
      setPreviewUrl(URL.createObjectURL(file));
      setMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Error: Admin session expired. Please log in again.');
      return;
    }

    const isDuplicate = methods.some((m) => m.name === selectedName);
    if (isDuplicate) {
      setMessage(`Error: ${selectedName} is already added`);
      return;
    }

    if (!logo) {
      setMessage('Please select a logo first.');
      return;
    }

    setUploading(true);
    setMessage('Uploading logo...');

    try {
      const logoUrl = await uploadImageToCloudinary(logo);

      setMessage('Saving method...');

      const response = await fetch(`${API_BASE}/admin/withdrawal-methods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: selectedName,
          type,
          logoUrl,
        }),
      });

      const data = await parseJsonResponse(response);

      if (response.ok) {
        setMessage('Added successfully!');
        await fetchMethods();
        setLogo(null);
        setPreviewUrl(null);
      } else {
        setMessage(`Error: ${data.message || 'Failed to add method'}`);
      }
    } catch (error) {
      console.error('Submit failed:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to save'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this method?')) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Error: Admin session expired. Please log in again.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/withdrawal-methods/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setMethods(methods.filter((m) => m.id !== id));
      } else {
        const data = await parseJsonResponse(response);
        setMessage(`Error: ${data.message || 'Failed to delete method'}`);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to delete'}`);
    }
  };

  const messageIsError = message.startsWith('Error');

  return (
    <div className="fixed inset-0 z-[160] bg-[var(--site-surface)] text-white flex flex-col h-screen overflow-hidden">
      <header className="bg-[var(--site-surface)] px-6 py-5 flex items-center justify-between shrink-0 border-b border-[var(--site-border)]">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-xl font-black text-white tracking-tight">Withdrawal Methods</div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-6">
          <div className="flex p-1 bg-[var(--site-bg)] rounded-2xl border border-[var(--site-border)]">
            <button
              type="button"
              onClick={() => setType('bank')}
              className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${
                type === 'bank' ? 'bg-[var(--site-surface)] text-white shadow-sm' : 'text-[#64748B]'
              }`}
            >
              Banks
            </button>
            <button
              type="button"
              onClick={() => setType('wallet')}
              className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${
                type === 'wallet' ? 'bg-[var(--site-surface)] text-white shadow-sm' : 'text-[#64748B]'
              }`}
            >
              Wallets
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">
              Select {type}
            </label>
            <select
              value={selectedName}
              onChange={(e) => {
                setSelectedName(e.target.value);
                setMessage('');
              }}
              className="w-full bg-[var(--site-bg)] border border-[var(--site-border)] rounded-xl px-4 py-3.5 text-sm font-bold focus:border-[#FF8C00] outline-none transition-all"
            >
              {(type === 'bank' ? ETHIOPIAN_BANKS : WALLETS).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">
              Bank/Provider Logo
            </label>
            <div className="relative group">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                required
              />
              <div className="w-full bg-[var(--site-bg)] border-2 border-dashed border-[var(--site-border)] rounded-2xl p-8 flex flex-col items-center justify-center gap-3 group-hover:border-[#FF8C00]/30 transition-all">
                {previewUrl ? (
                  <div className="relative w-24 h-24 bg-[var(--site-surface)] rounded-xl shadow-md p-2 border border-[var(--site-border)]">
                    <img src={previewUrl} className="w-full h-full object-contain" alt="Preview" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-[var(--site-surface)] rounded-xl shadow-sm flex items-center justify-center text-[#64748B]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                )}
                <div className="text-xs font-black text-white">
                  {logo ? logo.name : 'Click to upload logo'}
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg transition-all active:scale-95 ${
              uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#FF8C00] hover:bg-[#E67E00] text-white'
            }`}
          >
            {uploading ? 'Processing...' : 'Save Method'}
          </button>

          {message && (
            <div
              className={`p-4 rounded-xl text-center text-xs font-black uppercase tracking-tight ${
                messageIsError ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'
              }`}
            >
              {message}
            </div>
          )}
        </form>

        <section className="max-w-md mx-auto mt-10 space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">Active methods</h2>
          {loading ? (
            <div className="py-10 flex justify-center">
              <div className="w-8 h-8 border-4 border-[var(--site-border)] border-t-[#FF8C00] rounded-full animate-spin" />
            </div>
          ) : methods.length === 0 ? (
            <div className="text-center py-12 text-[#64748B]">
              <div className="text-sm font-bold italic uppercase tracking-widest opacity-30">No methods found</div>
            </div>
          ) : (
            methods.map((method) => (
              <div
                key={method.id}
                className="bg-[var(--site-bg)] border border-[var(--site-border)] rounded-2xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[var(--site-surface)] rounded-xl border border-[var(--site-border)] p-1.5 shadow-sm">
                    <img src={method.logo_url} alt={method.name} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-white uppercase tracking-tight">
                      {method.name}
                    </div>
                    <div className="text-[10px] text-[#64748B] font-bold capitalize">{method.type}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(method.id)}
                  className="p-2.5 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-xl hover:bg-red-50 hover:border-red-200 text-[#475569] hover:text-red-600 transition-all shadow-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}