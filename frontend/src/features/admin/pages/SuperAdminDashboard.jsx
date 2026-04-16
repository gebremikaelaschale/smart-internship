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
  Tooltip
} from 'recharts';

const fallbackSeries = [
  { month: 'Jan', applications: 0, approvedInternships: 0 },
  { month: 'Feb', applications: 0, approvedInternships: 0 },
  { month: 'Mar', applications: 0, approvedInternships: 0 },
  { month: 'Apr', applications: 0, approvedInternships: 0 },
  { month: 'May', applications: 0, approvedInternships: 0 },
  { month: 'Jun', applications: 0, approvedInternships: 0 }
];

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [dashboard, setDashboard] = useState({
    stats: {
      students: 0,
      companies: 0,
      internships: 0,
      activeInternships: 0
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

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await adminAPI.getSuperAdminDashboard();
        if (!mounted) return;
        setDashboard({
          stats: {
            students: Number(data?.stats?.students || 0),
            companies: Number(data?.stats?.companies || 0),
            internships: Number(data?.stats?.internships || 0),
            activeInternships: Number(data?.stats?.activeInternships || 0)
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
            : [{ message: 'No recent activity found.' }]
        });
        setLastRefreshed(new Date().toLocaleString());
      } catch (requestError) {
        if (!mounted) return;
        setError(requestError?.response?.data?.message || 'Failed to load dashboard data.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const internshipSuccessRate = Math.max(0, Math.min(100, Number(dashboard?.internshipSuccess?.rate || 0)));
  const activityItems = useMemo(() => {
    if (!Array.isArray(dashboard?.recentActivity)) return [];
    return dashboard.recentActivity.slice(0, 8);
  }, [dashboard]);

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <DataFreshness value={lastRefreshed} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Students" value={dashboard.stats.students.toLocaleString()} description="Total registered students" />
        <StatsCard title="Companies" value={dashboard.stats.companies.toLocaleString()} description="Verified partner companies" />
        <StatsCard title="Internships" value={dashboard.stats.internships.toLocaleString()} description="Total listed internships" />
        <StatsCard title="Active Internships" value={dashboard.stats.activeInternships.toLocaleString()} description="Currently running opportunities" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Fraud Detection" description="Automated risk signals from live company and internship data.">
          <div className="space-y-2">
            <p className="text-sm text-slate-600">Risky companies: <span className="font-semibold text-rose-700">{dashboard.fraudSummary.riskyCompanies}</span></p>
            <p className="text-sm text-slate-600">Spam internship alerts: <span className="font-semibold text-amber-700">{dashboard.fraudSummary.pendingInternshipSpamAlerts}</span></p>
          </div>
        </Card>

        <Card title="Top Risk Signals" description="Highest-scoring company verification risks.">
          <ul className="space-y-2">
            {(dashboard.fraudSummary.topRisks || []).slice(0, 3).map((risk, index) => (
              <li key={`${risk?.companyName || 'risk'}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{risk?.companyName || 'Unknown company'}</span>
                <span className="ml-2 text-xs text-rose-700">Score {Number(risk?.score || 0)}</span>
              </li>
            ))}
            {(!dashboard.fraudSummary.topRisks || dashboard.fraudSummary.topRisks.length === 0) ? (
              <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">No high-risk companies detected.</li>
            ) : null}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="System Analytics" description="Application and internship approval trend.">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard.analyticsSeries} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="applicationsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="approvalsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="applications" stroke="#0284c7" fill="url(#applicationsFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="approvedInternships" stroke="#059669" fill="url(#approvalsFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Internship Success Rate" description="Active internship ratio across all listings.">
          <div className="space-y-4">
            <p className="text-4xl font-semibold tracking-tight text-slate-900">{internshipSuccessRate}%</p>
            <div className="h-3 w-full rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                style={{ width: `${internshipSuccessRate}%` }}
              />
            </div>
            <p className="text-sm text-slate-600">{dashboard.internshipSuccess.activeInternships} active internships out of {dashboard.internshipSuccess.totalInternships} total internships.</p>
          </div>
        </Card>

        <Card title="Recent Activity" description="Live workflow highlights from system events.">
          <ul className="space-y-3">
            {activityItems.map((item, index) => (
              <li key={`${item?.message || 'activity'}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {item?.message || 'Activity update'}
                {item?.details ? <p className="mt-1 text-xs text-slate-500">{item.details}</p> : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading live dashboard metrics...</p> : null}
    </div>
  );
}
