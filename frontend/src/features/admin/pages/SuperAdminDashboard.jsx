import React, { useEffect, useMemo, useState } from 'react';
import StatsCard from '../components/StatsCard';
import Card from '@/components/ui/Card';
import { adminAPI } from '../adminAPI';
import DataFreshness from '../components/DataFreshness';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart,
  Bar,
  Line,
  Legend
} from 'recharts';

const fallbackSeries = [
  { month: 'Jul', applications: 0, approvedInternships: 0 },
  { month: 'Aug', applications: 0, approvedInternships: 0 },
  { month: 'Sep', applications: 0, approvedInternships: 0 },
  { month: 'Oct', applications: 0, approvedInternships: 0 },
  { month: 'Nov', applications: 0, approvedInternships: 0 },
  { month: 'Dec', applications: 0, approvedInternships: 0 },
  { month: 'Jan', applications: 0, approvedInternships: 0 },
  { month: 'Feb', applications: 0, approvedInternships: 0 },
  { month: 'Mar', applications: 0, approvedInternships: 0 },
  { month: 'Apr', applications: 0, approvedInternships: 0 },
  { month: 'May', applications: 0, approvedInternships: 0 },
  { month: 'Jun', applications: 0, approvedInternships: 0 }
];

function formatTimeAgo(dateString) {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const seconds = Math.floor(diffMs / 1000);
  
  if (seconds < 1) return 'Just now';
  if (seconds < 60) {
    return seconds === 1 ? '1 second ago' : `${seconds} seconds ago`;
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

function getCurrentSyncedAt() {
  return new Date().toISOString();
}


export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState('');
  const [dashboard, setDashboard] = useState({
    stats: {
      students: 0,
      companies: 0,
      colleges: 0,
      departments: 0,
      internships: 0,
      applications: 0
    },
    analyticsSeries: fallbackSeries,
    internshipSuccess: {
      rate: 0,
      activeInternships: 0,
      totalInternships: 0
    },
    fraudSummary: {
      riskyCompanies: 0,
      pendingInternshipSpamAlerts: 0,
      topRisks: []
    },
    recentActivity: []
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await adminAPI.getSuperAdminDashboard();
      setDashboard({
        stats: {
          students: Number(data?.stats?.students || 0),
          companies: Number(data?.stats?.companies || 0),
          colleges: Number(data?.stats?.colleges || 0),
          departments: Number(data?.stats?.departments || 0),
          internships: Number(data?.stats?.internships || 0),
          applications: Number(data?.stats?.applications || 0)
        },
        analyticsSeries: Array.isArray(data?.analyticsSeries) && data.analyticsSeries.length > 0 ? data.analyticsSeries : fallbackSeries,
        internshipSuccess: {
          rate: Number(data?.internshipSuccess?.rate || 0),
          activeInternships: Number(data?.internshipSuccess?.activeInternships || 0),
          totalInternships: Number(data?.internshipSuccess?.totalInternships || 0)
        },
        fraudSummary: {
          riskyCompanies: Number(data?.fraudSummary?.riskyCompanies || 0),
          pendingInternshipSpamAlerts: Number(data?.fraudSummary?.pendingInternshipSpamAlerts || 0),
          topRisks: Array.isArray(data?.fraudSummary?.topRisks) ? data.fraudSummary.topRisks : []
        },
        recentActivity: Array.isArray(data?.recentActivity) && data.recentActivity.length > 0
          ? data.recentActivity
          : [{ message: 'System heartbeat normal. No critical events detected.' }]
      });
      setLastSyncedAt(getCurrentSyncedAt());
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Synchronization failure: Unable to fetch live governance metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const internshipSuccessRate = Math.max(0, Math.min(100, Number(dashboard?.internshipSuccess?.rate || 0)));
  const activityItems = useMemo(() => {
    if (!Array.isArray(dashboard?.recentActivity)) return [];
    return dashboard.recentActivity.slice(0, 6);
  }, [dashboard]);

  // Build mixed chart series: applications as bar, success rate as line
  const mixedSeries = useMemo(() => {
    const series = dashboard.analyticsSeries;
    const total = series.reduce((sum, d) => sum + Number(d.applications || 0), 0);
    let running = 0;
    return series.map((d, i) => {
      running += Number(d.applications || 0);
      const approved = Number(d.approvedInternships || 0);
      const apps = Number(d.applications || 0);
      const successRate = apps > 0 ? Math.round((approved / apps) * 100) : 0;
      return {
        month: d.month,
        applications: apps,
        approvedInternships: approved,
        successRate
      };
    });
  }, [dashboard.analyticsSeries]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Institution Overview</h2>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">Track and manage students, partner companies, internships, and applications in one place.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <DataFreshness value={lastSyncedAt} />
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className={`h-4 w-4 transition-transform ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{loading ? 'Syncing…' : 'Live Update'}</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-rose-800 shadow-sm animate-in fade-in slide-in-from-top-2">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-semibold">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
        <StatsCard
          title="Total Students"
          value={dashboard.stats.students.toLocaleString()}
          description="Registered students"
          trend="+12% from last month"
          trendUp={true}
        />
        <StatsCard
          title="Total Industry Partners"
          value={dashboard.stats.companies.toLocaleString()}
          description="Partner companies"
          trend="+4 new this week"
          trendUp={true}
        />
        <StatsCard
          title="Total Colleges"
          value={dashboard.stats.colleges.toLocaleString()}
          description="Academic colleges"
          trend="Real-time count"
          trendUp={true}
        />
        <StatsCard
          title="Total Departments"
          value={dashboard.stats.departments.toLocaleString()}
          description="Academic departments"
          trend="Real-time count"
          trendUp={true}
        />
        <StatsCard
          title="Total Internships"
          value={dashboard.stats.internships.toLocaleString()}
          description="Internship openings"
          trend="Listed opportunities"
          trendUp={true}
        />
        <StatsCard
          title="Total Applications"
          value={dashboard.stats.applications.toLocaleString()}
          description="Student applications"
          trend="Syncing in real-time"
          trendUp={true}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
                    <Card
            title="Smart Placement Intelligence"
            description="Monthly application volume (bars) vs. placement success rate % (line) — dual-axis enterprise view."
          >
            <div className="h-[380px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <ComposedChart data={mixedSeries} margin={{ top: 16, right: 32, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.92} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0.65} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} dy={10} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={36} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: '#10b981', fontSize: 12, fontWeight: 600 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} width={44} />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -6px rgba(99,102,241,0.18)', fontSize: '13px', fontWeight: 600 }}
                    formatter={(value, name) => { if (name === 'Success Rate') return [`${value}%`, name]; return [value.toLocaleString(), name]; }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }} formatter={(value) => <span style={{ color: '#475569' }}>{value}</span>} />
                  <Bar yAxisId="left" dataKey="applications" name="Student Applications" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={52} />
                  <Line yAxisId="right" type="monotone" dataKey="successRate" name="Success Rate" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 grid grid-cols-3 divide-x divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/70">
              <div className="flex flex-col items-center py-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Peak Month</span>
                <span className="mt-1 text-lg font-black text-indigo-600">{mixedSeries.reduce((best, d) => d.applications > (best.applications || 0) ? d : best, {}).month || '—'}</span>
              </div>
              <div className="flex flex-col items-center py-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Success Rate</span>
                <span className="mt-1 text-lg font-black text-emerald-600">{mixedSeries.length > 0 ? `${Math.round(mixedSeries.reduce((s, d) => s + d.successRate, 0) / mixedSeries.length)}%` : '—'}</span>
              </div>
              <div className="flex flex-col items-center py-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Applications</span>
                <span className="mt-1 text-lg font-black text-slate-900">{mixedSeries.reduce((s, d) => s + d.applications, 0).toLocaleString()}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Internship Placement Rate" description="Percentage of active student placements.">
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="relative mb-6 flex items-center justify-center">
                <svg className="h-32 w-32 -rotate-90 transform">
                  <circle
                    cx="64"
                    cy="64"
                    r="58"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-100"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="58"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={364.4}
                    strokeDashoffset={364.4 - (364.4 * internshipSuccessRate) / 100}
                    strokeLinecap="round"
                    className="text-emerald-500 transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-900">{internshipSuccessRate}%</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Active</span>
                </div>
              </div>
              <p className="px-4 text-sm font-medium text-slate-600">
                {dashboard.internshipSuccess.activeInternships} active placements out of {dashboard.internshipSuccess.totalInternships} total internships.
              </p>
            </div>
          </Card>

          <Card title="Security Overview" description="Review alerts for companies and internship postings.">
            <div className="space-y-4">
              <div className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-rose-100 hover:bg-rose-50/50">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Companies to review</p>
                  <p className="text-lg font-black text-slate-900 group-hover:text-rose-700">{dashboard.fraudSummary.riskyCompanies}</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-sm">
                  <svg className="h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      


      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Recent Updates" description="Real-time activity logs from the platform." className="lg:col-span-2">
          <div className="space-y-3 pt-4">
            {activityItems.map((item, index) => (
              <div key={`${item?.message || 'activity'}-${index}`} className="group flex items-start gap-4 rounded-2xl border border-slate-50 bg-white p-4 shadow-sm transition hover:border-sky-100 hover:bg-sky-50/50">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-sky-100 group-hover:text-sky-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">{item?.message || 'Update'}</p>
                  {item?.details ? <p className="mt-1 text-xs font-medium text-slate-500">{item.details}</p> : null}
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{formatTimeAgo(item?.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Companies under review" description="Companies waiting for approval.">
          <ul className="space-y-3 pt-4">
            {(dashboard.fraudSummary.topRisks || []).slice(0, 4).map((risk, index) => (
              <li key={`${risk?.companyName || 'risk'}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 shadow-sm transition hover:border-rose-100">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">{risk?.companyName || 'Unknown Company'}</span>
                  <span className="text-[10px] font-semibold text-rose-500 uppercase tracking-wide">
                    {risk?.flags?.[0] || 'Verification Pending'}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black text-rose-600">{Number(risk?.score || 0)}</span>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Review Score</span>
                </div>
              </li>
            ))}
            {(!dashboard.fraudSummary.topRisks || dashboard.fraudSummary.topRisks.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-900">All companies verified</p>
                <p className="px-6 mt-1 text-xs font-medium text-slate-500">Every partner company is currently active and within normal parameters.</p>
              </div>
            ) : null}
          </ul>
        </Card>
      </div>

      {loading ? (
        <div className="fixed bottom-8 right-8 flex items-center gap-3 rounded-2xl bg-slate-900 px-6 py-4 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-bold">Synchronizing Command Hub...</span>
        </div>
      ) : null}
    </div>
  );
}
