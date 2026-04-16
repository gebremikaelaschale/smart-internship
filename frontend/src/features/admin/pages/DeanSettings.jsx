import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../adminAPI';
import DataFreshness from '../components/DataFreshness';

export default function DeanSettings() {
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
  const [security, setSecurity] = useState({
    lastLogin: null,
    deviceHistory: []
  });

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
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <DataFreshness value={lastRefreshed} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Security</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Password & Access</h2>
          <p className="mt-2 text-sm text-slate-600">Manage your account security from dean workspace.</p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('governance-change-password'))}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Change Password
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Notification Channels</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900">{settings.totals.inAppEnabled}</h3>
          <p className="mt-1 text-sm text-slate-600">Users enabled for in-app alerts.</p>
          <h3 className="mt-4 text-3xl font-bold text-slate-900">{settings.totals.emailEnabled}</h3>
          <p className="mt-1 text-sm text-slate-600">Users enabled for email notifications.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Account Safety</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900">{settings.totals.twoFactorEnabled}</h3>
          <p className="mt-1 text-sm text-slate-600">Users with 2FA enabled.</p>
          <h3 className="mt-4 text-3xl font-bold text-slate-900">{settings.totals.privateProfiles}</h3>
          <p className="mt-1 text-sm text-slate-600">Profiles set to private mode.</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Last Login</p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">Current session source</h3>
          <p className="mt-3 text-sm text-slate-700">Time: {formatDateTime(security?.lastLogin?.at)}</p>
          <p className="mt-1 text-sm text-slate-600">IP: {security?.lastLogin?.ipAddress || 'Not available'}</p>
          <p className="mt-1 text-sm text-slate-600">Device: {security?.lastLogin?.deviceInfo || 'Not available'}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Source: {security?.lastLogin?.source || 'none'}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Device History</p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">Recent trusted sessions</h3>
          <div className="mt-4 space-y-2">
            {security.deviceHistory.map((session, index) => (
              <div key={`${session?.deviceInfo || 'device'}-${session?.ipAddress || 'ip'}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{session?.deviceLabel || 'Session'}</p>
                <p className="text-xs text-slate-600">{session?.ipAddress || 'No IP'} | {formatDateTime(session?.lastSeenAt)}</p>
              </div>
            ))}
            {security.deviceHistory.length === 0 ? <p className="text-sm text-slate-500">No device history available yet.</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Communication</p>
        <h2 className="mt-2 text-xl font-bold text-slate-900">Messages and announcements</h2>
        <p className="mt-2 text-sm text-slate-600">Use the messaging workspace to send announcements and review message activity.</p>
        <Link
          to="/dean/messages"
          className="mt-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Open Messages
        </Link>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading settings from database...</p> : null}
    </div>
  );
}
