import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { employerAPI } from '../employerAPI';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="dashboard-skeleton h-40 rounded-[34px]" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`employer-metric-skeleton-${index}`} className="dashboard-skeleton h-36 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 11h18" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" />
      <path d="M5 7H3a2 2 0 0 0 2 2h1" />
      <path d="M19 7h2a2 2 0 0 1-2 2h-1" />
    </svg>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload || {};

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg shadow-slate-200/60">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Program</p>
      <p className="mt-1 max-w-[16rem] text-sm font-semibold text-slate-900">{item.programTitle || item.title || 'Untitled Program'}</p>
      <p className="mt-2 text-sm text-slate-600">
        Total Applicants: <span className="font-semibold text-slate-900">{Number(item.applicants || 0)}</span>
      </p>
    </div>
  );
}

function MetricCard({ icon, label, value, description, trend, accentClass, iconClass }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <div className={`absolute inset-x-0 top-0 h-1 ${accentClass}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
          <p className="mt-4 text-4xl font-black tracking-tight text-slate-900">{value}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{trend}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}>
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

const METRICS = [
  {
    key: 'totalPrograms',
    label: 'Total Internship Programs',
    description: 'Total number of internship opportunities posted by the company.',
    trend: 'Live data',
    accentClass: 'bg-sky-500',
    iconClass: 'bg-sky-50 text-sky-600',
    icon: <BriefcaseIcon />
  },
  {
    key: 'totalApplicants',
    label: 'Total Applicants',
    description: "Every student who has applied to any of the company's programs.",
    trend: '+2 this week',
    accentClass: 'bg-indigo-500',
    iconClass: 'bg-indigo-50 text-indigo-600',
    icon: <UsersIcon />
  },
  {
    key: 'totalActiveInterns',
    label: 'Total Active Interns',
    description: 'Students currently working at the company (accepted but not yet finished).',
    trend: 'Updated now',
    accentClass: 'bg-amber-500',
    iconClass: 'bg-amber-50 text-amber-600',
    icon: <PulseIcon />
  },
  {
    key: 'totalAcceptedStudents',
    label: 'Total Accepted Students',
    description: 'Total historical count of students the company has ever accepted.',
    trend: 'Historical total',
    accentClass: 'bg-emerald-500',
    iconClass: 'bg-emerald-50 text-emerald-600',
    icon: <TrophyIcon />
  }
];

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalPrograms: 0,
    totalApplicants: 0,
    totalActiveInterns: 0,
    totalAcceptedStudents: 0
  });
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    const { data } = await employerAPI.getDashboard();

    setStats({
      totalPrograms: Number(data?.stats?.totalPrograms ?? data?.stats?.activePrograms ?? 0),
      totalApplicants: Number(data?.stats?.totalApplicants ?? 0),
      totalActiveInterns: Number(data?.stats?.totalActiveInterns ?? data?.stats?.ongoing ?? 0),
      totalAcceptedStudents: Number(data?.stats?.totalAcceptedStudents ?? data?.stats?.totalInterns ?? 0)
    });
    setPerformance(Array.isArray(data?.performance) ? data.performance : []);
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        await loadDashboard();
        if (!active) return;
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load dashboard stats.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [loadDashboard]);

  const chartData = useMemo(() => {
    const activePrograms = performance.filter((item) => String(item?.status || '').toLowerCase() === 'open');
    return (activePrograms.length > 0 ? activePrograms : performance).slice(0, 8);
  }, [performance]);

  const animated = {
    hidden: { opacity: 0, y: 12 },
    visible: (delay = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.35, delay } })
  };

  return (
    <div className="student-dashboard space-y-6">
      {loading ? <DashboardSkeleton /> : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <motion.section initial="hidden" animate="visible" custom={0.03} variants={animated} className="student-panel rounded-[34px] border border-cyan-100 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.22),transparent_35%),linear-gradient(180deg,#ecfeff_0%,#ffffff_55%)] p-6 shadow-[0_24px_70px_rgba(14,116,144,0.14)] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Industry command center</p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">Internship Operations</h1>
            <p className="max-w-xl text-base leading-7 text-slate-600">Manage applicants, track active interns, and monitor completion metrics from one connected dashboard.</p>
          </div>
          <div className="rounded-3xl border border-cyan-100 bg-white/90 px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Portfolio snapshot</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {loading ? '...' : `${Number(stats.totalPrograms || 0)} internship programs`}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {loading ? 'Loading...' : `${Number(stats.totalApplicants || 0)} total applicants`}
            </p>
          </div>
        </div>
      </motion.section>

      <motion.section initial="hidden" animate="visible" custom={0.08} variants={animated} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((metric) => (
          <MetricCard
            key={metric.key}
            label={metric.label}
            value={loading ? '...' : String(Number(stats[metric.key] || 0))}
            description={metric.description}
            trend={metric.trend}
            accentClass={metric.accentClass}
            iconClass={metric.iconClass}
            icon={metric.icon}
          />
        ))}
      </motion.section>

      <motion.section initial="hidden" animate="visible" custom={0.12} variants={animated} className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Applicant Distribution</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Compare student interest across your active programs.</h2>
          </div>
          <p className="text-sm text-slate-500">Live data from your internship applications</p>
        </div>

        <div className="mt-6 h-[360px] w-full">
          {loading ? (
            <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/60">
              <svg className="h-8 w-8 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.15" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 24 }}>
                <defs>
                  <linearGradient id="programApplicantsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#4F46E5" />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="programTitle"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  height={54}
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  tickMargin={14}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  width={44}
                />
                <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <Bar
                  dataKey="applicants"
                  radius={[10, 10, 0, 0]}
                  fill="url(#programApplicantsGradient)"
                  activeBar={{ fill: '#4F46E5' }}
                  barSize={42}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 text-sm text-slate-500">
              No applicant data yet for your programs.
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
