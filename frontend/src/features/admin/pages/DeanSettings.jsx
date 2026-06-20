import React, { useEffect, useState } from 'react';
import { adminAPI } from '../adminAPI';
import DataFreshness from '../components/DataFreshness';
import { authAPI } from '@/features/auth/authAPI';
import useAuth from '@/hooks/useAuth';

export default function DeanSettings() {
  const auth = useAuth();
  const [settings, setSettings] = useState({
    totals: {
      users: 0,
      emailEnabled: 0,
      inAppEnabled: 0,
      twoFactorEnabled: 0,
      privateProfiles: 0,
      darkThemeUsers: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [security, setSecurity] = useState({ lastLogin: null, deviceHistory: [] });

  const formatDateTime = (value) => {
    if (!value) return 'Not available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not available';
    return date.toLocaleString();
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [settingsResponse, securityResponse] = await Promise.all([
          adminAPI.getSettingsOverview(),
          adminAPI.getSecurityOverview()
        ]);
        const data = settingsResponse?.data || {};
        const securityData = securityResponse?.data || {};
        if (!active) return;
        setSettings({
          totals: {
            users: Number(data?.totals?.users || 0),
            emailEnabled: Number(data?.totals?.emailEnabled || 0),
            inAppEnabled: Number(data?.totals?.inAppEnabled || 0),
            twoFactorEnabled: Number(data?.totals?.twoFactorEnabled || 0),
            privateProfiles: Number(data?.totals?.privateProfiles || 0),
            darkThemeUsers: Number(data?.totals?.darkThemeUsers || 0)
          }
        });
        setSecurity({
          lastLogin: securityData?.lastLogin || null,
          deviceHistory: Array.isArray(securityData?.deviceHistory) ? securityData.deviceHistory : []
        });
        setLastRefreshed(new Date().toLocaleString());
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load settings.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, []);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-cyan-100 bg-white p-8 shadow-sm">
        <h1 className="text-4xl font-extrabold text-slate-900">Account Settings</h1>
        <p className="mt-3 text-sm text-slate-600 max-w-3xl">Securely manage your administrative credentials and security settings from your unified workspace.</p>
      </section>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <DataFreshness value={lastRefreshed} />

      <div className="w-full rounded-[32px] border border-cyan-100 bg-white p-8 shadow-[0_15px_40px_rgba(15,23,42,0.04)]">
        <div className="mb-6 flex items-center gap-6">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50/30 text-cyan-700 shadow-sm">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-700">Security Management</p>
            <h2 className="text-3xl font-black text-slate-900 leading-tight">Account Security</h2>
          </div>
        </div>

        <form className="space-y-8">
          <div className="max-w-4xl space-y-4">
            <label className="ml-1 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Current Password</label>
            <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition-all focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-8 focus-within:ring-cyan-500/5">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-transparent px-6 py-5 text-sm font-medium outline-none"
                placeholder="Enter current password"
              />
              <button type="button" onClick={() => setShowCurrentPassword((v) => !v)} className="px-4 py-5 text-slate-400 hover:text-cyan-700 transition">
                {showCurrentPassword ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-6 10-6c2.4 0 4.4.8 6 1.9"/><path d="M22 12s-3.5 6-10 6c-2.4 0-4.4-.8-6-1.9"/><circle cx="12" cy="12" r="2.5"/></svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></svg>
                )}
              </button>
            </div>
          </div>

          <div className="grid max-w-4xl gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <label className="ml-1 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">New Password</label>
              <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition-all focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-8 focus-within:ring-cyan-500/5">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-transparent px-6 py-5 text-sm font-medium outline-none"
                  placeholder="Create new password"
                />
                <button type="button" onClick={() => setShowNewPassword((v) => !v)} className="px-4 py-5 text-slate-400 hover:text-cyan-700 transition">
                  {showNewPassword ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-6 10-6c2.4 0 4.4.8 6 1.9"/><path d="M22 12s-3.5 6-10 6c-2.4 0-4.4-.8-6-1.9"/><circle cx="12" cy="12" r="2.5"/></svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></svg>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="ml-1 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Confirm Password</label>
              <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition-all focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-8 focus-within:ring-cyan-500/5">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-transparent px-6 py-5 text-sm font-medium outline-none"
                  placeholder="Repeat new password"
                />
                <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="px-4 py-5 text-slate-400 hover:text-cyan-700 transition">
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-6 10-6c2.4 0 4.4.8 6 1.9"/><path d="M22 12s-3.5 6-10 6c-2.4 0-4.4-.8-6-1.9"/><circle cx="12" cy="12" r="2.5"/></svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-4xl pt-6">
            {passwordError ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{passwordError}</p> : null}
            {passwordMessage ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{passwordMessage}</p> : null}

            <div className="mt-6">
              <button
                type="button"
                onClick={async () => {
                  setPasswordError('');
                  setPasswordMessage('');
                  if (!currentPassword || !newPassword || !confirmPassword) {
                    setPasswordError('All password fields are required.');
                    return;
                  }
                  if (newPassword !== confirmPassword) {
                    setPasswordError('New password and confirmation do not match.');
                    return;
                  }
                  try {
                    setSaving(true);
                    const token = auth?.token || localStorage.getItem('token') || '';
                    const { data } = await authAPI.changePassword({ currentPassword, newPassword }, token);
                    setPasswordMessage(data?.message || 'Password updated successfully.');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  } catch (err) {
                    setPasswordError(err?.response?.data?.message || err.message || 'Failed to update password.');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="group relative flex w-full items-center justify-center gap-4 rounded-2xl bg-cyan-700 py-5 text-xs font-black uppercase tracking-[0.25em] text-white transition-all hover:bg-cyan-600 hover:shadow-2xl disabled:opacity-50"
              >
                {saving ? 'Updating Database...' : 'Update Account Password'}
                {!saving && (
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading settings from database...</p> : null}
    </div>
  );
}
