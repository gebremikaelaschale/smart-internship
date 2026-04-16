import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatsCard from '../components/StatsCard';
import { adminAPI } from '../adminAPI';
import DataFreshness from '../components/DataFreshness';

export default function DepartmentDashboard() {
  const [stats, setStats] = useState({ departmentUsers: 0, activeInternships: 0, reports: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState('');

  const operationalCards = [
    {
      label: 'Department community',
      value: stats.departmentUsers,
      note: stats.departmentUsers > 0 ? 'Track advising load and student support.' : 'No users mapped to this department yet.'
    },
    {
      label: 'Open items requiring action',
      value: stats.reports,
      note: stats.reports > 0 ? 'Reports are awaiting verification or feedback.' : 'No pending report actions.'
    }
  ];

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await adminAPI.getDepartmentDashboard();
        if (!active) return;
        setStats({
          departmentUsers: Number(data?.stats?.departmentUsers || 0),
          activeInternships: Number(data?.stats?.activeInternships || 0),
          reports: Number(data?.stats?.reports || 0)
        });
        setLastRefreshed(new Date().toLocaleString());
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load department dashboard.');
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">HOD command center</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Department Operations Overview</h1>
        <p className="mt-2 text-sm text-slate-600">
          Monitor your department pipeline, support students proactively, and keep communication flowing.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/hod/students"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Open Students
          </Link>
          <Link
            to="/hod/messages"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Open Messages
          </Link>
        </div>
      </div>
      <DataFreshness value={lastRefreshed} />
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Department Users" value={stats.departmentUsers.toLocaleString()} description="Students and coordinators" />
        <StatsCard title="Active Internships" value={stats.activeInternships.toLocaleString()} description="Aligned with departments" />
        <StatsCard title="Reports" value={stats.reports.toLocaleString()} description="Awaiting action" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {operationalCards.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{item.value.toLocaleString()}</p>
            <p className="mt-1 text-sm text-slate-600">{item.note}</p>
          </div>
        ))}
      </div>
      {loading ? <p className="text-sm text-slate-500">Loading department dashboard metrics...</p> : null}
    </div>
  );
}
