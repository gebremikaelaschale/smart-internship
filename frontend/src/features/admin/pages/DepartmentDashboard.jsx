import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminAPI } from '../adminAPI';
import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import useAuth from '@/hooks/useAuth';
import useHodDashboardSync from '@/hooks/useHodDashboardSync';

function getCurrentSyncedAt() {
  return new Date().toISOString();
}

function getTimeBasedGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function getAcademicYear(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month >= 8 ? year : year - 1;
  const endYearShort = String(startYear + 1).slice(-2);
  return `${startYear}/${endYearShort}`;
}

function formatLastSynced(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatRelativeTime(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';

  const diffMs = date.getTime() - Date.now();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) {
    return `${Math.max(absSeconds, 1)} second${absSeconds === 1 ? '' : 's'} ${diffSeconds <= 0 ? 'ago' : 'from now'}`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  const absMinutes = Math.abs(diffMinutes);
  if (absMinutes < 60) {
    return `${absMinutes} minute${absMinutes === 1 ? '' : 's'} ${diffMinutes <= 0 ? 'ago' : 'from now'}`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) {
    return `${absHours} hour${absHours === 1 ? '' : 's'} ${diffHours <= 0 ? 'ago' : 'from now'}`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ${diffDays <= 0 ? 'ago' : 'from now'}`;
}

function StudentsIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M17 11a4 4 0 1 0-4-4" />
      <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35" />
    </svg>
  );
}

function InternshipIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 11h18" />
      <path d="M9 11v1a3 3 0 0 0 6 0v-1" />
    </svg>
  );
}

function ApplicationsIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2h8l4 4v16H8z" />
      <path d="M16 2v6h6" />
      <path d="M12 11v6" />
      <path d="M9 14h6" />
    </svg>
  );
}

function PartnersIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 1 7 0l1.5 1.5a3 3 0 0 1-4.2 4.2L13 18" />
      <path d="M14 11a5 5 0 0 0-7 0L5.5 12.5a3 3 0 0 0 4.2 4.2L11 15" />
      <path d="M8 8l1.5 1.5" />
      <path d="M16 16l-1.5-1.5" />
    </svg>
  );
}

function AnimatedCount({ value, replayKey }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let startTime = null;
    const target = Number(value || 0);

    setDisplayValue(0);

    const step = (timestamp) => {
      if (cancelled) return;
      if (!startTime) startTime = timestamp;

      const progress = Math.min((timestamp - startTime) / 850, 1);
      const easedProgress = progress * (2 - progress);
      setDisplayValue(Math.round(target * easedProgress));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(target);
      }
    };

    window.requestAnimationFrame(step);

    return () => {
      cancelled = true;
    };
  }, [value, replayKey]);

  return <span>{new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(displayValue)}</span>;
}

function HODMetricCard({ title, value, description, replayKey, icon: Icon, accent = 'from-blue-500 via-blue-600 to-cyan-400' }) {
  return (
    <div className="group relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_-30px_rgba(37,99,235,0.35)] transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_24px_48px_-28px_rgba(37,99,235,0.45)]">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent} opacity-90 transition-opacity duration-300 group-hover:opacity-100`} />
      <div className="absolute -right-8 -bottom-8 h-28 w-28 rounded-full bg-blue-50/60 blur-3xl transition-all duration-500 group-hover:bg-blue-100/70" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">{title}</p>
          <h3 className="mt-4 text-4xl font-black tracking-tight text-[#1E293B] select-none sm:text-[2.75rem]">
            <span className="bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#0EA5E9] bg-clip-text text-transparent">
              <AnimatedCount value={value} replayKey={replayKey} />
            </span>
          </h3>
        </div>

        {Icon ? (
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg shadow-blue-200/60`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>

      {description ? <p className="relative mt-4 max-w-[18rem] text-sm font-medium leading-6 text-[#64748B]">{description}</p> : null}
    </div>
  );
}

function HODMetricSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_-30px_rgba(37,99,235,0.35)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-400" />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-4">
          <div className="h-2.5 w-32 rounded-full bg-slate-100" />
          <div className="h-10 w-28 rounded-2xl bg-slate-100" />
        </div>
        <div className="h-12 w-12 rounded-2xl bg-slate-100" />
      </div>
      <div className="mt-4 h-3 w-4/5 rounded-full bg-slate-100" />
      <div className="mt-2 h-3 w-2/3 rounded-full bg-slate-100" />
    </div>
  );
}

function PlacementTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">Placement</p>
      <p className="mt-1 text-sm font-semibold text-[#1E293B]">{item.name}</p>
      <p className="mt-1 text-lg font-black text-[#0F172A]">{item.value} students</p>
    </div>
  );
}

function ActivityIcon({ type }) {
  const colors = {
    'profile-updated': 'bg-blue-50 text-blue-700 ring-blue-100',
    'application-placed': 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    'evaluation-submitted': 'bg-sky-50 text-sky-700 ring-sky-100',
    'student-verification': 'bg-slate-50 text-slate-700 ring-slate-100'
  };

  return <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${colors[type] || colors['student-verification']}`}>•</span>;
}

export default function DepartmentDashboard() {
  const { user } = useAuth();
  const [departmentName, setDepartmentName] = useState(user?.department || user?.college || 'Assigned Department');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState('');
  const [statsRevision, setStatsRevision] = useState(0);
  const [dashboardStats, setDashboardStats] = useState({
    totalStudents: 0,
    totalInternships: 0,
    totalApplications: 0,
    totalIndustryPartners: 0
  });
  const [placementStats, setPlacementStats] = useState({
    placed: 0,
    unplaced: 0,
    totalStudents: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [activePlacementIndex, setActivePlacementIndex] = useState(null);

  // Student verification management
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionBusy, setActionBusy] = useState({ id: '', type: '' });

  const resolvedDepartmentName = useMemo(
    () => departmentName || user?.department || user?.college || 'Assigned Department',
    [departmentName, user]
  );

  const loadStudents = useCallback(async () => {
    try {
      setStudentsLoading(true);
      const { data } = await adminAPI.getHodVerificationRequests();
      setStudents(Array.isArray(data?.items) ? data.items : []);
    } catch {
      // Silently fail, not critical
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  const handleHodAction = async (studentId, action, note) => {
    if (!studentId || !action) return;
    const actionType = String(action).toLowerCase();
    try {
      setActionBusy({ id: String(studentId), type: actionType });
      const payload = { status: action === 'verify' ? 'Verified' : 'Rejected', note };
      
      if (actionType === 'reject' && !note) {
        setError('Rejection reason is required.');
        setActionBusy({ id: '', type: '' });
        return;
      }

      await adminAPI.updateHodVerificationRequest(studentId, payload);
      
      // Update local student list
      setStudents((prev) => prev.map((s) => 
        String(s._id) === String(studentId)
          ? { ...s, verificationStatus: action === 'verify' ? 'Verified' : 'Rejected', rejectionReason: note || '' }
          : s
      ));

      setRejectionModalOpen(false);
      setRejectionTarget(null);
      setRejectionReason('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update verification.');
    } finally {
      setActionBusy({ id: '', type: '' });
    }
  };

  const handleOpenReject = (student) => {
    setRejectionTarget(student);
    setRejectionReason('');
    setRejectionModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectionTarget) return;
    await handleHodAction(rejectionTarget._id, 'Rejected', rejectionReason);
  };

  const handleVerify = async (studentId) => {
    await handleHodAction(studentId, 'Verified', '');
  };

  const totalStudents = dashboardStats.totalStudents;
  const totalInternships = dashboardStats.totalInternships;
  const totalApplications = dashboardStats.totalApplications;
  const totalIndustryPartners = dashboardStats.totalIndustryPartners;

  const statsCards = useMemo(() => ([
    {
      title: 'Total Students',
      value: totalStudents,
      icon: StudentsIcon,
      accent: 'from-blue-500 via-blue-600 to-cyan-400'
    },
    {
      title: 'Total Internships',
      value: totalInternships,
      icon: InternshipIcon,
      accent: 'from-sky-500 via-blue-500 to-indigo-500'
    },
    {
      title: 'Total Applications',
      value: totalApplications,
      icon: ApplicationsIcon,
      accent: 'from-cyan-500 via-blue-500 to-sky-400'
    },
    {
      title: 'Total Industry Partners',
      value: totalIndustryPartners,
      icon: PartnersIcon,
      accent: 'from-blue-600 via-indigo-500 to-sky-500'
    }
  ]), [totalStudents, totalInternships, totalApplications, totalIndustryPartners]);

  const refreshOverview = useCallback(async () => {
    const [statsResult, placementResult, activityResult] = await Promise.allSettled([
      adminAPI.getHodDashboardStats(),
      adminAPI.getHodPlacementStats(),
      adminAPI.getHodRecentActivity({ limit: 8 })
    ]);

    if (statsResult.status === 'rejected') {
      throw statsResult.reason;
    }

    const statsResp = statsResult.value?.data || {};
    const placementResp = placementResult.status === 'fulfilled' ? (placementResult.value?.data || {}) : {};
    const activityResp = activityResult.status === 'fulfilled' ? (activityResult.value?.data || {}) : {};

    setDepartmentName(statsResp?.department?.name || placementResp?.department?.name || user?.department || user?.college || 'Assigned Department');
    setDashboardStats({
      totalStudents: Number(statsResp?.stats?.totalStudents || 0),
      totalInternships: Number(statsResp?.stats?.totalInternships || 0),
      totalApplications: Number(statsResp?.stats?.totalApplications || 0),
      totalIndustryPartners: Number(statsResp?.stats?.totalIndustryPartners || 0)
    });
    setPlacementStats({
      placed: Number(placementResp?.stats?.placed || 0),
      unplaced: Number(placementResp?.stats?.unplaced || 0),
      totalStudents: Number(placementResp?.stats?.totalStudents || 0)
    });
    setRecentActivity(Array.isArray(activityResp?.items) ? activityResp.items : []);
    setStatsRevision((current) => current + 1);
    setLastSyncedAt(getCurrentSyncedAt());
  }, [user?.department, user?.college]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        if (!active) return;
        await refreshOverview();
        await loadStudents();
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load HOD dashboard statistics.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [refreshOverview, loadStudents]);

  useEffect(() => {
    const refresh = () => {
      refreshOverview().catch(() => {});
    };

    const interval = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [refreshOverview]);

  useHodDashboardSync(refreshOverview);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError('');
      await refreshOverview();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to refresh HOD statistics.');
    } finally {
      setLoading(false);
    }
  };

  const greeting = useMemo(() => getTimeBasedGreeting(), []);
  const academicYear = useMemo(() => getAcademicYear(), []);
  const greetingName = useMemo(() => {
    const name = user?.fullName || user?.name || 'Department Head';
    return user?.title ? `${user.title} ${name}` : name;
  }, [user]);

  const placementChartData = useMemo(() => ([
    { name: 'Placed', value: placementStats.placed, fill: '#10B981' },
    { name: 'Unplaced', value: placementStats.unplaced, fill: '#94A3B8' }
  ]), [placementStats]);

  const activePlacementSlice = activePlacementIndex != null ? placementChartData[activePlacementIndex] : null;

  const showSkeleton = loading && statsRevision === 0;

  return (
    <div className="w-full min-w-0 space-y-10 bg-[#f8fafc] px-6 py-6 sm:px-8 lg:px-10 xl:px-10 2xl:px-12">
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <div className="w-full rounded-[1.6rem] border border-[#E2E8F0] bg-white px-8 py-10 shadow-none">
        <div className="flex items-stretch gap-6">
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="w-1 self-stretch origin-top rounded-full bg-[#2563EB]"
            aria-hidden="true"
          />

          <div className="flex-1 pl-6">
            <div className="flex items-start justify-between gap-8">
              <div className="max-w-4xl">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">DEPARTMENT PORTAL OVERVIEW</p>
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }} className="text-base font-semibold tracking-tight text-[#2563EB]">{greeting},</motion.p>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  className="mt-5 mb-5 text-5xl font-semibold tracking-tight text-[#1E293B]"
                >
                  {greetingName}
                </motion.h1>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }} className="mt-8 flex flex-wrap items-center gap-3 text-base font-medium text-[#64748B]">
                  <span>{resolvedDepartmentName}</span>
                  <span className="h-5 w-px bg-slate-200" aria-hidden="true" />
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                    Academic Year {academicYear}
                  </span>
                </motion.div>
              </div>

              <div className="flex shrink-0 items-center gap-3 rounded-full border border-blue-100 bg-blue-50/40 px-3 py-2">
                <p className="whitespace-nowrap text-[11px] font-medium text-[#64748B]">
                  Last synced: <span className="font-semibold text-blue-700">{formatLastSynced(lastSyncedAt)}</span>
                </p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loading}
                  aria-busy={loading}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg className={`h-3.5 w-3.5 transition-transform ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{loading ? 'Syncing…' : 'Live Update'}</span>
                </button>
              </div>
            </div>

            {/* Buttons removed as requested */}
          </div>
        </div>
      </div>
      <div className="grid w-full gap-6 md:grid-cols-2 xl:grid-cols-4 lg:gap-8">
        {showSkeleton
          ? Array.from({ length: 4 }).map((_, index) => <HODMetricSkeleton key={`hod-metric-skeleton-${index}`} />)
          : statsCards.map((card) => (
              <HODMetricCard
                key={card.title}
                title={card.title}
                value={card.value}
                description={card.description}
                replayKey={statsRevision}
                icon={card.icon}
                accent={card.accent}
              />
            ))}
      </div>

      <div className="grid w-full gap-8 xl:grid-cols-3">
        <div className="rounded-[1.6rem] border border-[#E2E8F0] bg-white p-8 shadow-none xl:col-span-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#64748B]">Placement Distribution</p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#1E293B]">Placed vs Unplaced</h3>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">Live</span>
          </div>

          <div className="relative mt-8 h-72 w-full">
            {showSkeleton ? (
              <div className="flex h-full items-center justify-center">
                <svg className="h-8 w-8 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            ) : placementStats.totalStudents > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={placementChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="88%"
                    paddingAngle={4}
                    activeIndex={activePlacementIndex ?? undefined}
                    onMouseEnter={(_, index) => setActivePlacementIndex(index)}
                    onMouseLeave={() => setActivePlacementIndex(null)}
                  >
                    {placementChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<PlacementTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-medium text-[#64748B]">No placement data available.</div>
            )}

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-black tracking-tight text-[#1E293B] tabular-nums">
                {activePlacementSlice ? activePlacementSlice.value : placementStats.totalStudents}
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#64748B]">
                {activePlacementSlice ? activePlacementSlice.name : 'Students'}
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-[#475569]">
            <span>Placed</span>
            <span className="font-semibold text-emerald-700">{placementStats.placed}</span>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-[#475569]">
            <span>Unplaced</span>
            <span className="font-semibold text-slate-600">{placementStats.unplaced}</span>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-[#E2E8F0] bg-white p-8 shadow-none xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#64748B]">Recent Activity</p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#1E293B]">Department feed</h3>
            </div>
            <span className="text-sm text-[#64748B]">{loading && recentActivity.length === 0 ? 'Loading…' : `${recentActivity.length} updates`}</span>
          </div>

          <div className="mt-6 max-h-[28rem] space-y-4 overflow-y-auto pr-1">
            {loading && recentActivity.length === 0 ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={`activity-skeleton-${index}`} className="animate-pulse rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="h-4 w-2/3 rounded-full bg-slate-200" />
                  <div className="mt-3 h-3 w-1/2 rounded-full bg-slate-200" />
                </div>
              ))
            ) : recentActivity.length > 0 ? (
              recentActivity.map((item) => (
                <div key={item.id} className="flex items-start gap-4 rounded-2xl border border-slate-100 px-4 py-4 transition hover:border-blue-100 hover:bg-blue-50/30">
                  <ActivityIcon type={item.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="font-semibold text-[#1E293B]">{item.title}</p>
                      <span className="shrink-0 text-xs font-medium text-[#64748B]">{formatRelativeTime(item.timestamp)}</span>
                    </div>
                    {item.details ? <p className="mt-1 text-sm leading-6 text-[#64748B]">{item.details}</p> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-[#64748B]">
                No recent activity yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Student Verification Management Section */}
      <div className="w-full rounded-[1.6rem] border border-[#E2E8F0] bg-white p-8 shadow-none">
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#64748B]">Student Verification</p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#1E293B]">Pending & Submitted Profiles</h3>
            </div>
            <button
              type="button"
              onClick={loadStudents}
              disabled={studentsLoading}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
            >
              <svg className={`h-3.5 w-3.5 ${studentsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Student Name</th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Status</th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Submitted Date</th>
                <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentsLoading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-sm text-slate-500">Loading students...</td>
                </tr>
              ) : students.length > 0 ? (
                students
                  .filter((s) => {
                    const status = String(s?.verificationStatus || '').toLowerCase();
                    return status === 'submitted' || status === 'pending';
                  })
                  .map((student) => {
                    const studentId = String(student?._id || '');
                    const rowBusy = actionBusy.id === studentId;
                    const verifyLoading = rowBusy && actionBusy.type === 'Verified';
                    const rejectLoading = rowBusy && actionBusy.type === 'Rejected';

                    return (
                      <tr key={studentId} className="hover:bg-blue-50/30 transition">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                              {(student?.fullName || student?.name || 'S')[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{student?.fullName || student?.name || 'N/A'}</p>
                              <p className="text-xs text-slate-500">{student?.email || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest ${
                            String(student?.verificationStatus || '').toLowerCase() === 'pending'
                              ? 'border border-amber-200 bg-amber-50 text-amber-700'
                              : 'border border-blue-200 bg-blue-50 text-blue-700'
                          }`}>
                            <span className="h-2 w-2 rounded-full bg-current" />
                            {student?.verificationStatus || 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600">
                            {student?.verificationRequestedAt 
                              ? new Date(student.verificationRequestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : student?.createdAt
                              ? new Date(student.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleVerify(studentId)}
                              disabled={rowBusy}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {verifyLoading ? 'Verifying...' : 'Verify'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReject(student)}
                              disabled={rowBusy}
                              className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                            >
                              {rejectLoading ? 'Rejecting...' : 'Reject'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-sm text-slate-500">No pending or submitted profiles</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Reject Profile</h2>
            <p className="mt-2 text-sm text-slate-600">
              Please provide a reason for rejecting {rejectionTarget?.fullName || rejectionTarget?.name || 'this student'}'s profile. This will be sent to the student.
            </p>
            
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter the reason for rejection..."
              className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={5}
            />

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectionModalOpen(false);
                  setRejectionTarget(null);
                  setRejectionReason('');
                }}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim() || actionBusy.id === rejectionTarget?._id}
                className="flex-1 rounded-lg border border-rose-300 bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
