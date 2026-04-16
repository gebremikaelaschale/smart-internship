import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import useAuth from '@/hooks/useAuth';
import Modal from '@/components/common/Modal';
import { authAPI } from '@/features/auth/authAPI';

function navIcon(kind) {
  if (kind === 'overview') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="2" />
        <rect x="13" y="10" width="8" height="11" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
      </svg>
    );
  }
  if (kind === 'departments') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 5h6v6H4z" />
        <path d="M14 5h6v6h-6z" />
        <path d="M9 13h6v6H9z" />
      </svg>
    );
  }
  if (kind === 'hod') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8" cy="8" r="3" />
        <path d="M2 20a6 6 0 0112 0" />
        <path d="M14 8h8" />
        <path d="M18 4v8" />
      </svg>
    );
  }
  if (kind === 'students') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0112 0" />
        <circle cx="17" cy="9" r="2" />
        <path d="M21 20a4.5 4.5 0 00-3.6-4.4" />
      </svg>
    );
  }
  if (kind === 'analytics') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19h16" />
        <path d="M7 16V9" />
        <path d="M12 16V5" />
        <path d="M17 16v-6" />
      </svg>
    );
  }
  if (kind === 'requests') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h16" />
        <path d="M4 12h10" />
        <path d="M4 17h16" />
        <path d="M18 11l2 2 4-4" />
      </svg>
    );
  }
  if (kind === 'messages') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 6h16v10H8l-4 4V6z" />
      </svg>
    );
  }
  if (kind === 'settings') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 8a4 4 0 100 8 4 4 0 000-8z" />
        <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 010 2.8l-.2.2a2 2 0 01-2.8 0l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V22a2 2 0 01-2 2h-.3a2 2 0 01-2-2v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 01-2.8 0l-.2-.2a2 2 0 010-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H2a2 2 0 01-2-2v-.3a2 2 0 012-2h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 010-2.8l.2-.2a2 2 0 012.8 0l.1.1a1.7 1.7 0 001.9.3 1.7 1.7 0 001-1.5V2a2 2 0 012-2h.3a2 2 0 012 2v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 012.8 0l.2.2a2 2 0 010 2.8l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.5 1H22a2 2 0 012 2v.3a2 2 0 01-2 2h-.1a1.7 1.7 0 00-1.5 1z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16v10H8l-4 3V6z" />
    </svg>
  );
}

function navItemsForRole(role) {
  if (role === 'dean') {
    return [
      { type: 'route', to: '/dean/dashboard', label: 'Overview', icon: 'overview' },
      { type: 'route', to: '/dean/departments', label: 'Departments', icon: 'departments' },
      { type: 'route', to: '/dean/hod-management', label: 'HOD Management', icon: 'hod' },
      { type: 'route', to: '/dean/students', label: 'Students', icon: 'students' },
      { type: 'route', to: '/dean/analytics', label: 'Analytics', icon: 'analytics' },
      { type: 'route', to: '/dean/requests', label: 'Requests / Approvals', icon: 'requests' },
      { type: 'route', to: '/dean/messages', label: 'Messages', icon: 'messages' },
      { type: 'route', to: '/dean/settings', label: 'Settings', icon: 'settings' }
    ];
  }

  return [
    { type: 'route', to: '/hod/dashboard', label: 'Overview', icon: 'overview' },
    { type: 'route', to: '/hod/students', label: 'Students', icon: 'students' },
    { type: 'route', to: '/hod/messages', label: 'Messages', icon: 'messages' }
  ];
}

function GovernanceSidebar({ mobile = false }) {
  const auth = useAuth();
  const role = String(auth?.user?.role || '').toLowerCase();
  const userName = auth?.user?.fullName || auth?.user?.name || 'User';
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('governance_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const items = useMemo(() => navItemsForRole(role), [role]);

  useEffect(() => {
    try {
      localStorage.setItem('governance_sidebar_collapsed', String(collapsed));
    } catch {
      // ignore persistence errors
    }
  }, [collapsed]);

  const handleSignOut = async () => {
    await auth?.logout?.();
    navigate('/login', { replace: true });
  };

  const sidebarContent = (
    <>
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className={collapsed && !mobile ? 'hidden' : 'block'}>
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-sky-200">Governance</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Dean Portal</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Signed in as {userName}</p>
          </div>

          {!mobile ? (
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={`${collapsed ? 'Expand sidebar' : 'Collapse sidebar'} (Alt+A)`}
            >
              <svg className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          ) : null}
        </div>

        {!mobile && collapsed ? (
          <div className="mt-3 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/70">DP</span>
          </div>
        ) : null}
      </div>

      <nav className={`flex-1 space-y-2 px-4 py-5 ${collapsed && !mobile ? 'overflow-visible' : ''}`}>
        {!collapsed || mobile ? <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/90">Navigation</p> : null}

        {items.map((item) => {
          const linkClass =
            'group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition';
          const activeClass = 'bg-white text-slate-900 shadow-[0_16px_40px_rgba(59,130,246,0.28)] ring-1 ring-sky-300/70';
          const inactiveClass = 'text-slate-200 hover:bg-white/10 hover:text-white';

          if (item.type === 'route') {
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === '/dean/dashboard'}
                title={!mobile && collapsed ? item.label : undefined}
                className={({ isActive }) => `${linkClass} ${isActive ? activeClass : inactiveClass}`}
              >
                {({ isActive }) => (
                  <>
                    <span className={`grid h-8 w-8 place-items-center rounded-xl ${isActive ? 'bg-sky-600 text-white' : 'bg-white/10 text-sky-100 group-hover:bg-white/15'}`} aria-hidden>
                      {navIcon(item.icon)}
                    </span>
                    {!collapsed || mobile ? <span className="flex-1">{item.label}</span> : null}
                    {isActive && !collapsed ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : null}
                    {collapsed && !mobile ? (
                      <span className="pointer-events-none absolute left-[78px] top-1/2 z-30 -translate-y-1/2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                        {item.label}
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          }
          return null;
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-5">
        {!mobile && !collapsed ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200">Security</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">Temporary passwords are for first login only. Use change password after sign in.</p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('governance-change-password'))}
              className="mt-4 w-full rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
            >
              Change Password
            </button>
          </div>
        ) : null}

        {!mobile && collapsed ? (
          <div className="grid place-items-center">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('governance-change-password'))}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              title="Change Password"
              aria-label="Change Password"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 5a4 4 0 00-4 4v2h8V9a4 4 0 00-4-4z" />
                <path d="M6 11h12v8H6z" />
              </svg>
            </button>
          </div>
        ) : null}

        {mobile ? (
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 w-full rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
          >
            Sign out
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
          >
            Sign out
          </button>
        )}
      </div>
    </>
  );

  const shellClass = mobile
    ? 'mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#0f172a_0%,#1e293b_100%)] text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]'
    : `relative hidden shrink-0 overflow-hidden border-r text-white transition-all duration-300 lg:flex lg:flex-col ${collapsed ? 'w-24' : 'w-72'} border-slate-800/70 bg-[linear-gradient(180deg,#0f172a_0%,#1e293b_48%,#0f172a_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.18)]`;

  return <aside className={shellClass}>{sidebarContent}</aside>;
}

export default function GovernanceLayout({ title, subtitle, children }) {
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage('');
    setPasswordError('');
  };

  useEffect(() => {
    const openPasswordModal = () => setPasswordModalOpen(true);
    window.addEventListener('governance-change-password', openPasswordModal);
    return () => window.removeEventListener('governance-change-password', openPasswordModal);
  }, []);

  const submitPasswordChange = async (event) => {
    event.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    try {
      setSavingPassword(true);
      const { data } = await authAPI.changePassword({ currentPassword, newPassword });
      setPasswordMessage(data?.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setPasswordError(requestError?.response?.data?.message || 'Unable to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="governance-shell flex min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_24%),#f8fafc] text-slate-900">
      <GovernanceSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar title={title} subtitle={subtitle} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="lg:hidden">
            <GovernanceSidebar mobile />
          </div>
          {children || <Outlet />}
        </main>
        <Footer />
      </div>

      <Modal open={passwordModalOpen} title="Change Password" onClose={closePasswordModal}>
        <form className="space-y-4" onSubmit={submitPasswordChange}>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Confirm new password"
            />
          </div>

          <p className="text-sm text-slate-600">This updates the real account password used for login. Temporary passwords are only for first-time access or admin resets.</p>

          {passwordError ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{passwordError}</p> : null}
          {passwordMessage ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{passwordMessage}</p> : null}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={closePasswordModal} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={savingPassword} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
