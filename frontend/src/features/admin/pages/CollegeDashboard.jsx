import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';
import { adminAPI } from '../adminAPI';

function formatCompactNumber(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function CollegeDashboard() {
  const auth = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    departments: 0,
    activeInternships: 0,
    pendingRequests: 0,
    departmentsWithoutHod: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const deanName = auth?.user?.fullName || auth?.user?.name || 'Dean User';
  const collegeName = auth?.user?.college || 'Assigned College';

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      try {
        setLoading(true);
        setError('');

        const [collegeResponse, departmentResponse, studentsResponse, internshipsResponse] = await Promise.allSettled([
          adminAPI.getCollegeDashboard(),
          adminAPI.getDepartments(),
          adminAPI.getStudents({ page: 1, limit: 1 }),
          adminAPI.getInternships({ page: 1, limit: 1, status: 'Open' })
        ]);

        if (!active) return;

        const collegeStats = collegeResponse.status === 'fulfilled' ? collegeResponse.value?.data?.stats || {} : {};
        const departmentItems = departmentResponse.status === 'fulfilled' ? (Array.isArray(departmentResponse.value?.data) ? departmentResponse.value.data : []) : [];
        const studentTotal = studentsResponse.status === 'fulfilled' ? Number(studentsResponse.value?.data?.pagination?.total || 0) : 0;
        const internshipOpenCount = internshipsResponse.status === 'fulfilled' ? Number(internshipsResponse.value?.data?.stats?.open || 0) : 0;

        setStats({
          totalStudents: studentTotal,
          departments: Number(collegeStats.departments || departmentItems.length || 0),
          activeInternships: internshipOpenCount,
          pendingRequests: Number(collegeStats.pendingRequests || 0),
          departmentsWithoutHod: Number(collegeStats.departmentsWithoutHod || 0)
        });
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load dean overview.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadOverview();
    return () => {
      active = false;
    };
  }, []);

  const alerts = [
    {
      label: `${formatCompactNumber(stats.departmentsWithoutHod)} departments without HOD`,
      toneClass: stats.departmentsWithoutHod > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
    },
    {
      label: `${formatCompactNumber(stats.pendingRequests)} pending approvals`,
      toneClass: stats.pendingRequests > 0 ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
    }
  ];

  return (
    <div className="space-y-6 text-slate-900">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <section className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Overview</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Welcome, {deanName}</h2>
        <p className="mt-2 text-base font-medium text-slate-600">{collegeName}</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <article className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Total Students</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{formatCompactNumber(stats.totalStudents)}</p>
        </article>
        <article className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Departments</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{formatCompactNumber(stats.departments)}</p>
        </article>
        <article className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Active Internships</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{formatCompactNumber(stats.activeInternships)}</p>
        </article>
        <article className="rounded-[1.4rem] border border-rose-200 bg-rose-50/65 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700">Pending Requests</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-rose-800">{formatCompactNumber(stats.pendingRequests)}</p>
        </article>
      </section>

      <section className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <h3 className="text-lg font-bold text-slate-900">Alerts</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {alerts.map((item) => (
            <div key={item.label} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${item.toneClass}`}>
              {item.label}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link to="/dean/departments" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700">
            Create Department
          </Link>
          <Link to="/dean/hod-management" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700">
            Assign HOD
          </Link>
          <Link to="/dean/requests" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100">
            Approve Requests
          </Link>
        </div>
      </section>

      {loading ? <p className="text-sm font-medium text-slate-500">Loading overview...</p> : null}
    </div>
  );
}
