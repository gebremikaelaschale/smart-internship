import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import { adminAPI } from '../adminAPI';
import DataFreshness from '../components/DataFreshness';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend
} from 'recharts';

export default function AnalyticsAdmin() {
  const [data, setData] = useState({
    totals: { students: 0, internships: 0, successRate: 0, applications: 0, accepted: 0 },
    statusBreakdown: [],
    monthlyTrend: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const { data: response } = await adminAPI.getAnalyticsDashboard();
        if (!active) return;
        setData({
          totals: {
            students: Number(response?.totals?.students || 0),
            internships: Number(response?.totals?.internships || 0),
            successRate: Number(response?.totals?.successRate || 0),
            applications: Number(response?.totals?.applications || 0),
            accepted: Number(response?.totals?.accepted || 0)
          },
          statusBreakdown: Array.isArray(response?.statusBreakdown) ? response.statusBreakdown : [],
          monthlyTrend: Array.isArray(response?.monthlyTrend) ? response.monthlyTrend : []
        });
        setLastRefreshed(new Date().toLocaleString());
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load analytics dashboard.');
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
    <div className="space-y-4">
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <DataFreshness value={lastRefreshed} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card title="Total Students" description="Registered student accounts">
          <p className="text-3xl font-semibold text-slate-900">{data.totals.students.toLocaleString()}</p>
        </Card>
        <Card title="Total Internships" description="All internships in the system">
          <p className="text-3xl font-semibold text-slate-900">{data.totals.internships.toLocaleString()}</p>
        </Card>
        <Card title="Success Rate" description="Accepted / Total applications">
          <p className="text-3xl font-semibold text-emerald-700">{data.totals.successRate}%</p>
        </Card>
        <Card title="Applications" description="Total submitted applications">
          <p className="text-3xl font-semibold text-slate-900">{data.totals.applications.toLocaleString()}</p>
        </Card>
        <Card title="Accepted" description="Students accepted into internships">
          <p className="text-3xl font-semibold text-emerald-700">{data.totals.accepted.toLocaleString()}</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Application Status Breakdown" description="Live distribution of application outcomes.">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={data.statusBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="status" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0284c7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Trends" description="Monthly applications versus accepted trend by month.">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} name="Total" />
                <Line type="monotone" dataKey="accepted" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Accepted" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading analytics from database...</p> : null}
    </div>
  );
}
