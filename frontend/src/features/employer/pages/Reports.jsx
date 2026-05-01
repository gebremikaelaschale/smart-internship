import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import EmployerCard from '../components/EmployerCard';
import { employerAPI } from '../employerAPI';
import ProgramSubNav from '../components/ProgramSubNav';

function renderStars(rating) {
  const value = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  const full = '★'.repeat(value);
  const empty = '☆'.repeat(5 - value);
  return `${full}${empty}`;
}

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState({
    totalInterns: 0,
    completed: 0,
    performanceSummary: {
      completionRate: 0,
      averageRating: 0,
      averageScore: 0,
      evaluatedInterns: 0,
      acceptedInterns: 0
    }
  });

  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await employerAPI.getReportsSummary();
        if (!active) return;
        setReport({
          totalInterns: Number(data?.totalInterns || 0),
          completed: Number(data?.completed || 0),
          performanceSummary: {
            completionRate: Number(data?.performanceSummary?.completionRate || 0),
            averageRating: Number(data?.performanceSummary?.averageRating || 0),
            averageScore: Number(data?.performanceSummary?.averageScore || 0),
            evaluatedInterns: Number(data?.performanceSummary?.evaluatedInterns || 0),
            acceptedInterns: Number(data?.performanceSummary?.acceptedInterns || 0)
          }
        });
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load reports summary.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadReports();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <ProgramSubNav />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <EmployerCard
          title="Total Interns"
          value={loading ? '...' : String(report.totalInterns)}
          description="Accepted interns across your programs"
        />
        <EmployerCard
          title="Completed"
          value={loading ? '...' : String(report.completed)}
          description="Interns whose program end date has passed"
        />
        <EmployerCard
          title="Completion Rate"
          value={loading ? '...' : `${report.performanceSummary.completionRate}%`}
          description="Completed interns out of accepted interns"
        />
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <Card title="Performance Summary" description="Live summary from submitted evaluations.">
        {loading ? (
          <p className="text-sm text-slate-500">Loading performance summary...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Average Rating</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{report.performanceSummary.averageRating.toFixed(1)} / 5</p>
              <p className="mt-1 text-lg text-amber-500">{renderStars(report.performanceSummary.averageRating)}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Average Score</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{report.performanceSummary.averageScore.toFixed(1)}%</p>
              <p className="mt-2 text-sm text-slate-600">
                Evaluated Interns: <span className="font-semibold text-slate-900">{report.performanceSummary.evaluatedInterns}</span>
              </p>
              <p className="text-sm text-slate-600">
                Accepted Interns: <span className="font-semibold text-slate-900">{report.performanceSummary.acceptedInterns}</span>
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
