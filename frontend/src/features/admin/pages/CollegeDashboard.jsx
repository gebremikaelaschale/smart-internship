import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import useAuth from '@/hooks/useAuth';
import { adminAPI } from '../adminAPI';
import DeanWelcomeHeader from '../components/DeanWelcomeHeader';

function AnimatedCounter({ value, duration = 850 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let startTime = null;
    const target = Number(value || 0);

    const step = (timestamp) => {
      if (cancelled) return;
      if (!startTime) startTime = timestamp;

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = progress * (2 - progress);
      setCount(Math.round(target * easedProgress));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    window.requestAnimationFrame(step);

    return () => {
      cancelled = true;
    };
  }, [value, duration]);

  return <span>{new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(count)}</span>;
}

function StudentsIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a3 3 0 0 0-2.25-2.9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.3a4 4 0 0 1 0 7.4" />
    </svg>
  );
}

function PartnersIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21v-6h8v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5V3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 5V3" />
    </svg>
  );
}

function DepartmentsIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  );
}

function InternshipsIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16v12H4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 11h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11v2a3 3 0 0 0 6 0v-2" />
    </svg>
  );
}

function ApplicationsIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v6h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6" />
    </svg>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  show: (index) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: 'easeOut',
      delay: index * 0.1
    }
  })
};

function MetricCard({ title, value, icon: Icon, description, index }) {
  return (
    <motion.article
      variants={cardVariants}
      custom={index}
      className="group relative overflow-hidden rounded-[1.7rem] border border-[#E2E8F0] bg-white p-7 shadow-none transition-all duration-300 hover:-translate-y-0.5"
    >
      <div className="absolute left-0 top-0 h-[2px] w-full bg-blue-600" />
      <div className="flex items-start justify-between gap-5">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">{title}</p>
          <h3 className="mt-2 text-[2.1rem] font-semibold tracking-tight text-[#1E293B] tabular-nums">
            <AnimatedCounter value={value} />
          </h3>
          {description ? <p className="text-sm font-medium text-[#64748B]">{description}</p> : null}
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.article>
  );
}

function MetricSkeleton() {
  return (
    <div className="space-y-4 rounded-[1.7rem] border border-[#E2E8F0] bg-white p-7 shadow-none">
      <div className="h-[2px] w-full rounded-full bg-blue-100" />
      <div className="flex items-start justify-between gap-5">
        <div className="flex-1 space-y-4">
          <div className="h-3 w-28 rounded-full bg-slate-100 animate-pulse" />
          <div className="h-10 w-24 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="h-3 w-40 rounded-full bg-slate-100 animate-pulse" />
        </div>
        <div className="h-12 w-12 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}

function formatRelativeTime(value) {
  const timestamp = new Date(value || Date.now()).getTime();
  const delta = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(delta / 60000));

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function getActivityTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('placed')) return 'bg-blue-50 text-blue-700 ring-blue-100';
  if (normalized.includes('accepted')) return 'bg-blue-50 text-blue-700 ring-blue-100';
  if (normalized.includes('interview')) return 'bg-blue-50 text-blue-700 ring-blue-100';
  return 'bg-slate-50 text-slate-600 ring-slate-200';
}

function PlacementProgressCard({ data }) {
  const percent = Number(data?.percent || 0);
  const placed = Number(data?.placed || 0);
  const totalApplications = Number(data?.totalApplications || 0);

  const chartData = [{ name: 'Placed', value: Math.max(0, Math.min(100, percent)) }];

  return (
    <article className="relative flex h-full min-h-[520px] flex-col overflow-hidden rounded-[1.8rem] border border-[#E2E8F0] bg-white p-8 shadow-none">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-blue-600" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#64748B]">Placement Progress</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#1E293B]">Overall placement rate</h3>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
          Live
        </span>
      </div>

      <div className="mt-8 grid flex-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="relative mx-auto h-[290px] w-full max-w-[360px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <RadialBarChart innerRadius="72%" outerRadius="100%" barSize={14} data={chartData} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar dataKey="value" cornerRadius={999} fill="#2563EB" background={{ fill: '#E2E8F0' }} clockWise />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-5xl font-semibold tracking-tight text-[#1E293B] tabular-nums">{percent}%</span>
            <span className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#64748B]">Placed</span>
          </div>
        </div>

        <div className="flex h-full flex-col space-y-5 rounded-[1.4rem] border border-slate-100 bg-slate-50/40 p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">Placement Summary</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-[#1E293B]">{placed} placed applications</p>
          </div>
          <p className="text-sm leading-6 text-[#64748B]">
            The chart reflects how many applications from this college have reached an accepted or placed status.
          </p>
          <div className="mt-auto grid grid-cols-2 gap-4 pt-2">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">Placed</p>
              <p className="mt-2 text-3xl font-semibold text-[#1E293B] tabular-nums">{placed}</p>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">Applications</p>
              <p className="mt-2 text-3xl font-semibold text-[#1E293B] tabular-nums">{totalApplications}</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function DepartmentComparisonCard({ data }) {
  const chartData = Array.isArray(data) ? data : [];

  return (
    <article className="flex h-full min-h-[520px] flex-col rounded-[1.8rem] border border-[#E2E8F0] bg-white p-8 shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#64748B]">Department Comparison</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#1E293B]">Placement rate by department</h3>
        </div>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-[#64748B] ring-1 ring-inset ring-[#E2E8F0]">
          Overview
        </span>
      </div>

      <div className="mt-8 flex-1 min-h-[420px] w-full">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="department" tickLine={false} axisLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748B', fontSize: 12 }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip
                cursor={{ fill: 'rgba(37,99,235,0.06)' }}
                contentStyle={{ borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: 'none' }}
                formatter={(value, name, props) => [
                  `${value}%`,
                  'Placement Rate'
                ]}
                labelFormatter={(label) => `Department: ${label}`}
              />
              <Bar dataKey="placementRate" radius={[12, 12, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`department-bar-${entry.department}-${index}`} fill="#2563EB" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full min-h-[420px] items-center justify-center rounded-[1.4rem] border border-dashed border-[#E2E8F0] bg-slate-50/40 text-sm font-medium text-[#64748B]">
            No department placement data available yet.
          </div>
        )}
      </div>
    </article>
  );
}

function RecentActivitiesCard({ items }) {
  const activities = Array.isArray(items) ? items : [];

  return (
    <article className="rounded-[1.8rem] border border-[#E2E8F0] bg-white p-7 shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#64748B]">Recent Activities</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#1E293B]">Latest placement updates</h3>
        </div>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-[#64748B] ring-1 ring-inset ring-[#E2E8F0]">
          5 latest
        </span>
      </div>

      <div className="mt-8 space-y-4">
        {activities.length > 0 ? activities.map((item) => (
          <div key={item.id} className="flex gap-4 rounded-[1.2rem] border border-[#E2E8F0] bg-white p-4">
            <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ${getActivityTone(item.status)}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="truncate text-sm font-semibold text-[#1E293B]">{item.title}</p>
                <span className="whitespace-nowrap text-xs font-medium text-[#64748B]">{formatRelativeTime(item.timestamp)}</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-[#64748B]">{item.message}</p>
              <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ring-1 ring-inset ${getActivityTone(item.status)}`}>
                {item.status}
              </span>
            </div>
          </div>
        )) : (
          <div className="rounded-[1.2rem] border border-dashed border-[#E2E8F0] bg-slate-50/40 px-4 py-8 text-center text-sm font-medium text-[#64748B]">
            No recent placement activity yet.
          </div>
        )}
      </div>
    </article>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <div className="space-y-4 rounded-[1.8rem] border border-[#E2E8F0] bg-white p-7 shadow-none">
        <div className="h-3 w-40 rounded-full bg-slate-100 animate-pulse" />
        <div className="h-7 w-56 rounded-full bg-slate-100 animate-pulse" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="h-[230px] rounded-[1.4rem] bg-slate-50 animate-pulse" />
          <div className="space-y-3 rounded-[1.4rem] border border-[#E2E8F0] bg-slate-50/40 p-5">
            <div className="h-4 w-32 rounded-full bg-slate-100 animate-pulse" />
            <div className="h-8 w-48 rounded-full bg-slate-100 animate-pulse" />
            <div className="h-4 w-full rounded-full bg-slate-100 animate-pulse" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
              <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-4 rounded-[1.8rem] border border-[#E2E8F0] bg-white p-7 shadow-none">
        <div className="h-3 w-36 rounded-full bg-slate-100 animate-pulse" />
        <div className="h-7 w-48 rounded-full bg-slate-100 animate-pulse" />
        <div className="h-[320px] rounded-[1.4rem] bg-slate-50 animate-pulse" />
      </div>
      <div className="rounded-[1.8rem] border border-[#E2E8F0] bg-white p-7 shadow-none xl:col-span-2">
        <div className="h-3 w-32 rounded-full bg-slate-100 animate-pulse" />
        <div className="mt-3 h-7 w-56 rounded-full bg-slate-100 animate-pulse" />
        <div className="mt-8 space-y-3">
          <div className="h-24 rounded-[1.2rem] bg-slate-100 animate-pulse" />
          <div className="h-24 rounded-[1.2rem] bg-slate-100 animate-pulse" />
          <div className="h-24 rounded-[1.2rem] bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function CollegeDashboard() {
  const auth = useAuth();
  const [stats, setStats] = useState({
    students: 0,
    industryPartners: 0,
    departments: 0,
    internships: 0,
    applications: 0
  });
  const [analytics, setAnalytics] = useState({
    placementProgress: {
      percent: 0,
      placed: 0,
      totalApplications: 0
    },
    departmentComparison: [],
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);

  const deanName = auth?.user?.fullName || auth?.user?.name || 'Dean User';

  const loadOverview = async ({ active = true } = {}) => {
    try {
      setLoading(true);
      setError('');

      const { data } = await adminAPI.getDeanStats();
      if (!active) return;

      setStats({
        students: Number(data?.stats?.students ?? 0),
        industryPartners: Number(data?.stats?.industryPartners ?? 0),
        departments: Number(data?.stats?.departments ?? 0),
        internships: Number(data?.stats?.internships ?? 0),
        applications: Number(data?.stats?.applications ?? 0)
      });
      setAnalytics({
        placementProgress: {
          percent: Number(data?.stats?.placementRate ?? data?.analytics?.placementProgress?.percent ?? 0),
          placed: Number(data?.stats?.placedStudents ?? data?.analytics?.placementProgress?.placed ?? 0),
          totalApplications: Number(data?.stats?.applications ?? data?.analytics?.placementProgress?.totalApplications ?? 0)
        },
        departmentComparison: Array.isArray(data?.analytics?.departmentComparison) ? data.analytics.departmentComparison : [],
        recentActivities: Array.isArray(data?.analytics?.recentActivities) ? data.analytics.recentActivities : []
      });
      setLastSyncedAt(new Date().toISOString());
      // refresh notifications after overview
      fetchNotifications();
    } catch (requestError) {
      if (!active) return;
      setError(requestError?.response?.data?.message || 'Failed to load dean overview.');
    } finally {
      if (active) setLoading(false);
    }
  };

  const fetchNotifications = async ({ limit = 5, unreadOnly = false } = {}) => {
    try {
      setNotifLoading(true);
      const { data } = await adminAPI.getNotifications({ limit, unreadOnly });
      // backend returns { items, total, unreadCount }
      setNotifications(Array.isArray(data?.items) ? data.items : data?.items || []);
      setUnreadCount(Number(data?.unreadCount ?? 0));
    } catch (err) {
      // ignore for now
    } finally {
      setNotifLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await adminAPI.markNotificationRead(id);
      // optimistic update
      setNotifications((prev) => prev.map(n => (String(n._id||n.id) === String(id) ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await adminAPI.markAllNotificationsRead();
      setNotifications((prev) => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    let active = true;

    loadOverview({ active });
    // fetch notifications on mount (will also be refreshed after overview)
    fetchNotifications();
    return () => {
      active = false;
    };
  }, []);

  const metricCards = useMemo(() => ([
    {
      title: 'Total Students',
      value: stats.students,
      icon: StudentsIcon,
      description: 'Students under this college'
    },
    {
      title: 'Total Industry Partners',
      value: stats.industryPartners,
      icon: PartnersIcon,
      description: 'Partner accounts linked to this college'
    },
    {
      title: 'Total Departments',
      value: stats.departments,
      icon: DepartmentsIcon,
      description: 'Departments in this college'
    },
    {
      title: 'Total Internships',
      value: stats.internships,
      icon: InternshipsIcon,
      description: 'Internships posted by college partners'
    },
    {
      title: 'Total Applications',
      value: stats.applications,
      icon: ApplicationsIcon,
      description: 'Applications across this college'
    }
  ]), [stats]);

  const analyticsCards = useMemo(() => ({
    placementProgress: analytics.placementProgress,
    departmentComparison: analytics.departmentComparison,
    recentActivities: analytics.recentActivities
  }), [analytics]);

  return (
    <div className="space-y-8 text-slate-900">
      {error ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm text-[#64748B] shadow-none">
          {error}
        </div>
      ) : null}

      <DeanWelcomeHeader deanName={deanName} lastSyncedAt={lastSyncedAt} loading={loading} onRefresh={() => loadOverview()} />

      <motion.section
        variants={{
          hidden: {},
          show: {
            transition: {
              staggerChildren: 0.1,
              delayChildren: 0.05
            }
          }
        }}
        initial="hidden"
        animate="show"
        className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5"
      >
        <AnimatePresence mode="wait">
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <motion.div
                  key={`skeleton-${index}`}
                  variants={cardVariants}
                  custom={index}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: 12 }}
                >
                  <MetricSkeleton />
                </motion.div>
              ))
            : metricCards.map((card, index) => (
                <MetricCard key={card.title} {...card} index={index} />
              ))}
        </AnimatePresence>
      </motion.section>

      {loading ? <p className="text-sm font-medium text-[#64748B]">Loading live college metrics...</p> : null}

      <motion.section
        variants={{
          hidden: { opacity: 0, y: 18 },
          show: {
            opacity: 1,
            y: 0,
            transition: {
              duration: 0.55,
              ease: 'easeOut',
              staggerChildren: 0.1
            }
          }
        }}
        initial="hidden"
        animate="show"
        className="mt-[60px] space-y-5"
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">Analytics & Monitoring</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1E293B]">Placement progress and live activity</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#64748B]">
              Real-time college performance and placement movement.
            </p>
          </div>
        </div>

        {loading ? (
          <AnalyticsSkeleton />
        ) : (
          <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
            <PlacementProgressCard data={analyticsCards.placementProgress} />
            <DepartmentComparisonCard data={analyticsCards.departmentComparison} />
            <div className="xl:col-span-2">
              <RecentActivitiesCard items={analyticsCards.recentActivities} />
            </div>
          </div>
        )}
      </motion.section>
    </div>
  );
}
