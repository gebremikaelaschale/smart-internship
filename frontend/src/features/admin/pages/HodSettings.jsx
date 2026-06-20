import React, { useEffect, useState } from 'react';
import { authAPI } from '@/features/auth/authAPI';
import useAuth from '@/hooks/useAuth';

function EyeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-6 10-6c2.4 0 4.4.8 6 1.9" />
      <path d="M22 12s-3.5 6-10 6c-2.4 0-4.4-.8-6-1.9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export default function HodSettings() {
  const auth = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!message && !error) return undefined;
    const timer = window.setTimeout(() => {
      setMessage('');
      setError('');
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [message, error]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    try {
      setSaving(true);
      const token = auth?.token || localStorage.getItem('token') || '';
      const { data } = await authAPI.changePassword({ currentPassword, newPassword }, token);
      setMessage(data?.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Unable to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col space-y-8 pb-12">
      <section className="rounded-[32px] border border-cyan-100 bg-white px-6 pt-12 pb-8 shadow-sm lg:px-10">
        <div className="w-full mx-auto">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500">SYSTEM PREFERENCES</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Account Settings</h1>
          <p className="mt-2 max-w-2xl font-medium text-slate-500">
            Manage your HOD account security from the department workspace.
          </p>
        </div>
      </section>

      <div className="w-full space-y-8 px-2 lg:px-4">
        {(error || message) ? (
          <div className={`flex w-full items-center gap-4 rounded-[24px] border p-5 text-sm font-bold shadow-sm ${error ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
            <div className={`grid h-8 w-8 place-items-center rounded-full ${error ? 'bg-rose-100' : 'bg-emerald-100'}`}>
              {error ? '✕' : '✓'}
            </div>
            {error || message}
          </div>
        ) : null}

        <div className="w-full rounded-[32px] border border-cyan-100 bg-white p-8 shadow-[0_15px_40px_rgba(15,23,42,0.04)] lg:p-12">
          <div className="mb-10 flex items-center gap-6">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50/30 text-cyan-700 shadow-sm">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-700">Security Management</p>
              <h2 className="text-3xl font-black leading-tight text-slate-900">HOD Account Security</h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="max-w-4xl space-y-4">
              <label className="ml-1 block text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Current Password</label>
              <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition-all focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-8 focus-within:ring-cyan-500/5">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="w-full bg-transparent px-6 py-5 text-sm font-medium outline-none"
                  placeholder="Enter current password"
                />
                <button type="button" onClick={() => setShowCurrentPassword((value) => !value)} className="px-4 py-5 text-slate-400 transition hover:text-cyan-700">
                  {showCurrentPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div className="grid max-w-4xl gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <label className="ml-1 block text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">New Password</label>
                <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition-all focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-8 focus-within:ring-cyan-500/5">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full bg-transparent px-6 py-5 text-sm font-medium outline-none"
                    placeholder="Create new password"
                  />
                  <button type="button" onClick={() => setShowNewPassword((value) => !value)} className="px-4 py-5 text-slate-400 transition hover:text-cyan-700">
                    {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="ml-1 block text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Confirm Password</label>
                <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition-all focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-8 focus-within:ring-cyan-500/5">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full bg-transparent px-6 py-5 text-sm font-medium outline-none"
                    placeholder="Repeat new password"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="px-4 py-5 text-slate-400 transition hover:text-cyan-700">
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
            </div>

            <div className="max-w-4xl pt-6">
              <button
                type="submit"
                disabled={saving}
                className="group relative flex w-full items-center justify-center gap-4 rounded-2xl bg-cyan-700 py-5 text-xs font-black uppercase tracking-[0.25em] text-white transition-all hover:bg-cyan-600 hover:shadow-2xl disabled:opacity-50"
              >
                {saving ? 'Updating Database...' : 'Update Account Password'}
                {!saving ? (
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                ) : null}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}