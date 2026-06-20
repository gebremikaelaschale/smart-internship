import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import { authService } from '@/services/authService';
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

export default function SettingsAdmin() {
  const auth = useAuth();
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match. Please verify your entries.');
      return;
    }
    try {
      setChangingPassword(true);
      setError('');
      const token = auth?.token || localStorage.getItem('token') || '';
      await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      }, token);
      setNotice('Success! Your account password has been updated.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Update failed. Please check your current password and try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  useEffect(() => {
    if (!notice && !error) return undefined;
    const timer = window.setTimeout(() => {
      setNotice('');
      setError('');
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [notice, error]);

  return (
    <div className="flex w-full flex-col space-y-8 pb-12">
      {/* Sync with Student Portal Header Aesthetic */}
      <section className="bg-white border-b border-slate-100 pt-12 pb-8 px-6 lg:px-10 rounded-[32px] mb-4">
        <div className="w-full mx-auto">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Account Settings</h1>
          <p className="mt-2 text-slate-500 font-medium max-w-2xl">
            Securely manage your administrative credentials and security settings from your unified workspace.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="w-full space-y-8 px-2 lg:px-4">
        <AnimatePresence mode="wait">
          {(error || notice) && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className={`flex w-full items-center gap-4 rounded-[24px] border p-5 text-sm font-bold shadow-sm backdrop-blur-md ${
                error ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
              }`}
            >
              <div className={`grid h-8 w-8 place-items-center rounded-full ${error ? 'bg-rose-100' : 'bg-emerald-100'}`}>
                {error ? '✕' : '✓'}
              </div>
              {error || notice}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Account Security Card - Synced with Student Panel Style */}
        <div className="w-full rounded-[32px] border border-cyan-100 bg-white p-8 shadow-[0_15px_40px_rgba(15,23,42,0.04)] lg:p-12">
          <div className="mb-10 flex items-center gap-6">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50/30 text-cyan-700 shadow-sm">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-700">Security Management</p>
              <h2 className="text-3xl font-black text-slate-900 leading-tight">Account Security</h2>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-10">
            <div className="max-w-4xl space-y-4">
              <label className="ml-1 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Current Password</label>
              <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition-all focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-8 focus-within:ring-cyan-500/5">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full bg-transparent px-6 py-5 text-sm font-medium outline-none"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="px-4 py-5 text-slate-400 hover:text-cyan-700 transition"
                >
                  {showCurrentPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div className="grid max-w-4xl gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <label className="ml-1 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">New Password</label>
                <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition-all focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-8 focus-within:ring-cyan-500/5">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full bg-transparent px-6 py-5 text-sm font-medium outline-none"
                    placeholder="Create new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="px-4 py-5 text-slate-400 hover:text-cyan-700 transition"
                  >
                    {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="ml-1 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Confirm Password</label>
                <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition-all focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-8 focus-within:ring-cyan-500/5">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full bg-transparent px-6 py-5 text-sm font-medium outline-none"
                    placeholder="Repeat new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="px-4 py-5 text-slate-400 hover:text-cyan-700 transition"
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
            </div>

            <div className="max-w-4xl pt-6">
              <button
                type="submit"
                disabled={changingPassword}
                className="group relative flex w-full items-center justify-center gap-4 rounded-2xl bg-cyan-700 py-5 text-xs font-black uppercase tracking-[0.25em] text-white transition-all hover:bg-cyan-600 hover:shadow-2xl disabled:opacity-50"
              >
                {changingPassword ? 'Updating Database...' : 'Update Account Password'}
                {!changingPassword && (
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                )}
              </button>
            </div>
          </form>

          <div className="mt-14 flex max-w-4xl items-center gap-8 rounded-3xl border border-cyan-100 bg-cyan-50/30 p-8 shadow-sm">
             <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm text-3xl border border-cyan-100">
                🛡️
             </div>
             <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Security Protocol</h4>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                  Your security is our priority. Ensure your new password is a combination of letters, numbers, and symbols to maximize account safety across the platform.
                </p>
             </div>
          </div>
        </div>

        {/* Synced Footer Info */}
        <div className="flex flex-col items-center gap-2 pt-6">
            <div className="h-1 w-12 rounded-full bg-cyan-600/20" />
            <p className="text-center text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
              Governance Control Panel • Multi-Layer Security
            </p>
        </div>
      </div>
    </div>
  );
}
