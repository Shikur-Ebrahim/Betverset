import { useState, useEffect } from 'react';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';
import { uploadImageToCloudinary } from '@/lib/cloudinary-upload';

const API_BASE = getPublicApiBaseUrl();

type DepositMethod = {
  id: number;
  name: string;
  logo_url: string;
  min_amount: number;
  account_details: string;
  account_name: string;
};

type DepositManagementProps = {
  onClose: () => void;
};

export default function DepositManagement({ onClose }: DepositManagementProps) {
  const [view, setView] = useState<'add' | 'list'>('add');
  const [methods, setMethods] = useState<DepositMethod[]>([]);
  
  // Form states
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [accountDetails, setAccountDetails] = useState('');
  const [accountName, setAccountName] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (view === 'list') {
      fetchMethods();
    }
  }, [view]);

  const fetchMethods = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/deposit-methods`);
      const data = await response.json();
      setMethods(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch methods:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    setLogo(file);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !minAmount || (!logo && !editId)) {
      setMessage('Please fill all fields.');
      return;
    }

    setUploading(true);
    setMessage(editId ? 'Updating method...' : 'Adding method...');

    try {
      let finalLogoUrl = previewUrl;

      if (logo) {
        finalLogoUrl = await uploadImageToCloudinary(logo);
      }

      // 2. Save to Backend
      const url = editId
        ? `${API_BASE}/admin/deposit-methods/${editId}`
        : `${API_BASE}/admin/deposit-methods`;
      
      const method = editId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name,
          minAmount: parseFloat(minAmount),
          accountDetails,
          accountName,
          logoUrl: finalLogoUrl
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(editId ? 'Updated successfully!' : 'Added successfully!');
        if (!editId) {
          setName('');
          setMinAmount('');
          setAccountDetails('');
          setAccountName('');
          setLogo(null);
          setPreviewUrl(null);
        } else {
          setTimeout(() => setView('list'), 1500);
        }
      } else {
        setMessage(`Error: ${data.message || 'Failed to save'}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (m: DepositMethod) => {
    setEditId(m.id);
    setName(m.name);
    setMinAmount(m.min_amount.toString());
    setAccountDetails(m.account_details || '');
    setAccountName(m.account_name || '');
    setPreviewUrl(m.logo_url);
    setLogo(null);
    setView('add');
    setMessage('');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this method?')) return;

    try {
      const response = await fetch(`${API_BASE}/admin/deposit-methods/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setMethods(methods.filter(m => m.id !== id));
      } else {
        alert('Failed to delete method');
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] bg-[var(--site-surface)] text-slate-900 flex flex-col h-screen overflow-hidden">
      <header className="bg-[var(--site-surface)] px-6 py-5 flex items-center justify-between shrink-0 border-b border-[var(--site-border)]">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div className="text-xl font-black text-slate-900 tracking-tight">Deposit Methods</div>
        </div>
        
        <button 
          onClick={() => {
            if (view === 'add') {
              setView('list');
            } else {
              setEditId(null);
              setName('');
              setMinAmount('');
              setLogo(null);
              setPreviewUrl(null);
              setView('add');
            }
          }}
          className="text-[10px] font-black uppercase tracking-widest bg-[#1A202C] text-white px-4 py-2 rounded-full shadow-md active:scale-95 transition-all"
        >
          {view === 'add' ? 'Manage' : 'Add New'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {view === 'add' ? (
          <form onSubmit={handleSave} className="max-w-md mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">Method Name</label>
              <input 
                type="text" 
                placeholder="e.g. Telebirr, CBE"
                className="w-full bg-[var(--site-bg)] border border-[var(--site-border)] rounded-xl px-4 py-3.5 text-sm font-bold focus:border-[#FF8C00] outline-none transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">Min Amount (ETB)</label>
              <input 
                type="number" 
                placeholder="0.00"
                className="w-full bg-[var(--site-bg)] border border-[var(--site-border)] rounded-xl px-4 py-3.5 text-sm font-bold focus:border-[#FF8C00] outline-none transition-all"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">Account Name</label>
              <input 
                type="text" 
                placeholder="e.g. Shikur"
                className="w-full bg-[var(--site-bg)] border border-[var(--site-border)] rounded-xl px-4 py-3.5 text-sm font-bold focus:border-[#FF8C00] outline-none transition-all"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">Account / Phone Number</label>
              <input 
                type="text" 
                placeholder="e.g. 0911... or 1000..."
                className="w-full bg-[var(--site-bg)] border border-[var(--site-border)] rounded-xl px-4 py-3.5 text-sm font-bold focus:border-[#FF8C00] outline-none transition-all"
                value={accountDetails}
                onChange={(e) => setAccountDetails(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">Bank/Provider Logo</label>
              <div className="relative group">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  required={!editId}
                />
                <div className="w-full bg-[var(--site-bg)] border-2 border-dashed border-[var(--site-border)] rounded-2xl p-8 flex flex-col items-center justify-center gap-3 group-hover:border-[#FF8C00]/30 transition-all">
                  {previewUrl ? (
                    <div className="relative w-24 h-24 bg-[var(--site-surface)] rounded-xl shadow-md p-2 border border-[var(--site-border)]">
                      <img src={previewUrl} className="w-full h-full object-contain" alt="Preview" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-[var(--site-surface)] rounded-xl shadow-sm flex items-center justify-center text-[#64748B]">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                  )}
                  <div className="text-xs font-black text-slate-700">{logo ? logo.name : (editId ? 'Change logo (optional)' : 'Click to upload logo')}</div>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={uploading}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg transition-all active:scale-95 ${uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#FF8C00] hover:bg-[#E67E00] text-white'}`}
            >
              {uploading ? 'Processing...' : (editId ? 'Update Method' : 'Save Method')}
            </button>

            {message && (
              <div className={`p-4 rounded-xl text-center text-xs font-black uppercase tracking-tight ${message.includes('Error') ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                {message}
              </div>
            )}
          </form>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {methods.length === 0 ? (
              <div className="text-center py-20 text-[#64748B]">
                <div className="text-sm font-bold italic uppercase tracking-widest opacity-30">No methods found</div>
              </div>
            ) : (
              methods.map((m) => (
                <div key={m.id} className="bg-[var(--site-bg)] border border-[var(--site-border)] rounded-2xl p-4 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[var(--site-surface)] rounded-xl border border-[var(--site-border)] p-1.5 shadow-sm">
                      <img src={m.logo_url} alt={m.name} className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 uppercase tracking-tight">{m.name}</div>
                      <div className="text-[10px] text-[#64748B] font-bold">NAME: {m.account_name} • {m.account_details}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(m)}
                      className="p-2.5 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-xl hover:bg-blue-50 hover:border-blue-200 text-[#475569] hover:text-blue-600 transition-all shadow-sm"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button 
                      onClick={() => handleDelete(m.id)}
                      className="p-2.5 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-xl hover:bg-red-50 hover:border-red-200 text-[#475569] hover:text-red-600 transition-all shadow-sm"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
