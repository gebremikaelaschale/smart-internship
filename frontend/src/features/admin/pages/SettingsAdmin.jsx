import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import StatsCard from '../components/StatsCard';
import { adminAPI } from '../adminAPI';
import DataFreshness from '../components/DataFreshness';
import useAuth from '@/hooks/useAuth';

const defaultPermissions = {
  superadmin: { manageUsers: true, manageCompanies: true, manageInternships: true, manageSettings: true },
  collegeadmin: { manageUsers: true, manageCompanies: false, manageInternships: true, manageSettings: false },
  deptadmin: { manageUsers: false, manageCompanies: false, manageInternships: true, manageSettings: false }
};

const defaultConfig = {
  maintenanceMode: false,
  registrationOpen: true,
  maxApplicationsPerStudent: 10,
  certificateAutoIssue: false
};

function PermissionGrid({ value, onChange, disabled }) {
  const roles = ['superadmin', 'collegeadmin', 'deptadmin'];
  const actions = ['manageUsers', 'manageCompanies', 'manageInternships', 'manageSettings'];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
            {actions.map((action) => (
              <th key={action} className="px-4 py-3 text-left font-semibold text-slate-700">{action}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {roles.map((role) => (
            <tr key={role}>
              <td className="px-4 py-3 font-semibold text-slate-700">{role}</td>
              {actions.map((action) => (
                <td key={`${role}-${action}`} className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(value?.[role]?.[action])}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange((prev) => ({
                        ...prev,
                        [role]: {
                          ...prev[role],
                          [action]: event.target.checked
                        }
                      }))
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SettingsAdmin() {
  const auth = useAuth();
  const adminType = String(auth?.user?.adminType || '').toLowerCase();
  const canEdit = adminType === 'superadmin';

  const [totals, setTotals] = useState({
    users: 0,
    emailEnabled: 0,
    inAppEnabled: 0,
    twoFactorEnabled: 0,
    privateProfiles: 0,
    darkThemeUsers: 0
  });
  const [rolePermissions, setRolePermissions] = useState(defaultPermissions);
  const [systemConfig, setSystemConfig] = useState(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [announcement, setAnnouncement] = useState({ title: '', message: '', targetRole: 'all', type: 'info' });
  const [announcing, setAnnouncing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await adminAPI.getSettingsOverview();
        if (!active) return;
        setTotals({
          users: Number(data?.totals?.users || 0),
          emailEnabled: Number(data?.totals?.emailEnabled || 0),
          inAppEnabled: Number(data?.totals?.inAppEnabled || 0),
          twoFactorEnabled: Number(data?.totals?.twoFactorEnabled || 0),
          privateProfiles: Number(data?.totals?.privateProfiles || 0),
          darkThemeUsers: Number(data?.totals?.darkThemeUsers || 0)
        });
        setRolePermissions({ ...defaultPermissions, ...(data?.rolePermissions || {}) });
        setSystemConfig({ ...defaultConfig, ...(data?.systemConfig || {}) });
        setLastRefreshed(new Date().toLocaleString());
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load settings overview.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const savePermissions = async () => {
    try {
      setSavingPermissions(true);
      setError('');
      await adminAPI.updateRolePermissions({ rolePermissions });
      setNotice('Role permissions updated successfully.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update role permissions.');
    } finally {
      setSavingPermissions(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSavingConfig(true);
      setError('');
      await adminAPI.updateSystemConfig({ systemConfig: { ...systemConfig, maxApplicationsPerStudent: Number(systemConfig.maxApplicationsPerStudent || 0) } });
      setNotice('System configuration updated successfully.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update system configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  const sendAnnouncement = async () => {
    try {
      setAnnouncing(true);
      setError('');
      await adminAPI.sendAnnouncement(announcement);
      setNotice('Announcement sent successfully.');
      setAnnouncement({ title: '', message: '', targetRole: 'all', type: 'info' });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to send announcement.');
    } finally {
      setAnnouncing(false);
    }
  };

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      <DataFreshness value={lastRefreshed} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatsCard title="Total Users" value={totals.users.toLocaleString()} description="All accounts in the platform" />
        <StatsCard title="Email Notifications" value={totals.emailEnabled.toLocaleString()} description="Users with email channel enabled" />
        <StatsCard title="In-App Notifications" value={totals.inAppEnabled.toLocaleString()} description="Users with in-app channel enabled" />
        <StatsCard title="2FA Enabled" value={totals.twoFactorEnabled.toLocaleString()} description="Users with two-factor enabled" />
        <StatsCard title="Private Profiles" value={totals.privateProfiles.toLocaleString()} description="Users with private visibility" />
        <StatsCard title="Dark Theme Users" value={totals.darkThemeUsers.toLocaleString()} description="Users using dark workspace preference" />
      </div>

      <Card title="Role Permissions" description="Control capability matrix for governance roles.">
        <PermissionGrid value={rolePermissions} onChange={setRolePermissions} disabled={!canEdit || savingPermissions} />
        {!canEdit ? <p className="mt-3 text-xs text-amber-700">Only SuperAdmin can update role permissions.</p> : null}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={savePermissions}
            disabled={!canEdit || savingPermissions}
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700 disabled:opacity-50"
          >
            {savingPermissions ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </Card>

      <Card title="System Config" description="Core system switches and constraints.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(systemConfig.maintenanceMode)}
              disabled={!canEdit || savingConfig}
              onChange={(event) => setSystemConfig((prev) => ({ ...prev, maintenanceMode: event.target.checked }))}
            />
            Maintenance Mode
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(systemConfig.registrationOpen)}
              disabled={!canEdit || savingConfig}
              onChange={(event) => setSystemConfig((prev) => ({ ...prev, registrationOpen: event.target.checked }))}
            />
            Registration Open
          </label>

          <label className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <span className="mb-1 block text-xs text-slate-500">Max Applications Per Student</span>
            <input
              type="number"
              min="1"
              max="50"
              value={systemConfig.maxApplicationsPerStudent}
              disabled={!canEdit || savingConfig}
              onChange={(event) => setSystemConfig((prev) => ({ ...prev, maxApplicationsPerStudent: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5"
            />
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(systemConfig.certificateAutoIssue)}
              disabled={!canEdit || savingConfig}
              onChange={(event) => setSystemConfig((prev) => ({ ...prev, certificateAutoIssue: event.target.checked }))}
            />
            Auto-Issue Verified Certificates
          </label>
        </div>

        {!canEdit ? <p className="mt-3 text-xs text-amber-700">Only SuperAdmin can update system configuration.</p> : null}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={saveConfig}
            disabled={!canEdit || savingConfig}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 disabled:opacity-50"
          >
            {savingConfig ? 'Saving...' : 'Save Config'}
          </button>
        </div>
      </Card>

      <Card title="System Alerts & Announcements" description="Broadcast notifications to students, employers, or all users.">
        <div className="grid gap-3">
          <input
            value={announcement.title}
            onChange={(event) => setAnnouncement((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Announcement title"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            value={announcement.message}
            onChange={(event) => setAnnouncement((prev) => ({ ...prev, message: event.target.value }))}
            placeholder="Announcement message"
            rows={3}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={announcement.targetRole}
              onChange={(event) => setAnnouncement((prev) => ({ ...prev, targetRole: event.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All users</option>
              <option value="student">Students</option>
              <option value="employer">Employers</option>
              <option value="admin">Admins</option>
            </select>
            <select
              value={announcement.type}
              onChange={(event) => setAnnouncement((prev) => ({ ...prev, type: event.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={sendAnnouncement}
            disabled={announcing}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 disabled:opacity-50"
          >
            {announcing ? 'Sending...' : 'Send Announcement'}
          </button>
        </div>
      </Card>

      {loading ? <p className="text-sm text-slate-500">Loading settings from database...</p> : null}
    </div>
  );
}
