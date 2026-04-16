import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Card from '@/components/ui/Card';
import ErrorMessage from '@/components/common/ErrorMessage';
import { employerAPI } from '../employerAPI';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="dashboard-skeleton h-40 rounded-3xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={`employer-stat-skeleton-${index}`} className="dashboard-skeleton h-28 rounded-3xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => <div key={`employer-quick-skeleton-${index}`} className="dashboard-skeleton h-32 rounded-3xl" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="dashboard-skeleton h-72 rounded-3xl" />
        <div className="dashboard-skeleton h-72 rounded-3xl" />
      </div>
    </div>
  );
}

function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </div>
  );
}

function ActionCard({ to, title, description, tone = 'light' }) {
  const toneClass = tone === 'dark'
    ? 'border-cyan-700 bg-gradient-to-br from-cyan-700 via-sky-700 to-blue-800 text-white'
    : 'border-slate-200 bg-white text-slate-900';

  return (
    <Link to={to} className={`group rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${toneClass}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${tone === 'dark' ? 'text-cyan-100' : 'text-cyan-700'}`}>{title}</p>
      <p className={`mt-2 text-sm leading-6 ${tone === 'dark' ? 'text-cyan-50' : 'text-slate-600'}`}>{description}</p>
      <span className={`mt-4 inline-flex text-sm font-semibold ${tone === 'dark' ? 'text-white' : 'text-slate-900'}`}>Open now</span>
    </Link>
  );
}

function toCsv(rows) {
  const escapeCell = (value) => {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return rows
    .map((row) => row.map((cell) => escapeCell(cell)).join(','))
    .join('\n');
}

function downloadCsv(filename, rows) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [selectedInternshipId, setSelectedInternshipId] = useState('all');
  const [availablePrograms, setAvailablePrograms] = useState([]);
  const [stats, setStats] = useState({
    activePrograms: 0,
    totalInterns: 0,
    ongoing: 0,
    completed: 0
  });
  const [analytics, setAnalytics] = useState({
    aiMatching: {
      matchScore: 0,
      topMatchScore: 0,
      sampleSize: 0
    },
    internshipSuccess: {
      successRate: 0,
      completedInterns: 0,
      totalInterns: 0
    },
    studentEngagement: {
      engagementScore: 0,
      responseRate: 0,
      interviewRate: 0,
      recentApplicantsCount: 0,
      totalApplications: 0,
      acceptedApplications: 0
    },
    trends: []
  });
  const [trendData, setTrendData] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [recommendedStudents, setRecommendedStudents] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadNotice, setDownloadNotice] = useState('');

  useEffect(() => {
    if (!downloadNotice) return undefined;
    const timer = window.setTimeout(() => setDownloadNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [downloadNotice]);

  const formatDateTime = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Unknown time';
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getActivityBadgeClass = (type) => {
    const value = String(type || '').toLowerCase();
    if (value === 'application') return 'bg-cyan-100 text-cyan-700';
    if (value === 'internship-started') return 'bg-amber-100 text-amber-700';
    if (value === 'evaluation') return 'bg-emerald-100 text-emerald-700';
    return 'bg-slate-100 text-slate-700';
  };

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError('');
        const params = {
          months: selectedMonths,
          ...(selectedInternshipId !== 'all' ? { internshipId: selectedInternshipId } : {})
        };
        const { data } = await employerAPI.getDashboard(params);
        if (!active) return;
        setStats({
          activePrograms: Number(data?.stats?.activePrograms || 0),
          totalInterns: Number(data?.stats?.totalInterns || 0),
          ongoing: Number(data?.stats?.ongoing || 0),
          completed: Number(data?.stats?.completed || 0)
        });
        setPerformanceData(
          Array.isArray(data?.performance)
            ? data.performance.map((item) => ({
                program: String(item?.programTitle || 'Program'),
                applicants: Number(item?.applicants || 0),
                completionRate: Number(item?.completionRate || 0)
              }))
            : []
        );
        setRecommendedStudents(Array.isArray(data?.recommendedStudents) ? data.recommendedStudents : []);
        setRecentActivity(Array.isArray(data?.recentActivity) ? data.recentActivity : []);
        setAvailablePrograms(Array.isArray(data?.availablePrograms) ? data.availablePrograms : []);
        setAnalytics({
          aiMatching: {
            matchScore: Number(data?.analytics?.aiMatching?.matchScore || 0),
            topMatchScore: Number(data?.analytics?.aiMatching?.topMatchScore || 0),
            sampleSize: Number(data?.analytics?.aiMatching?.sampleSize || 0)
          },
          internshipSuccess: {
            successRate: Number(data?.analytics?.internshipSuccess?.successRate || 0),
            completedInterns: Number(data?.analytics?.internshipSuccess?.completedInterns || 0),
            totalInterns: Number(data?.analytics?.internshipSuccess?.totalInterns || 0)
          },
          studentEngagement: {
            engagementScore: Number(data?.analytics?.studentEngagement?.engagementScore || 0),
            responseRate: Number(data?.analytics?.studentEngagement?.responseRate || 0),
            interviewRate: Number(data?.analytics?.studentEngagement?.interviewRate || 0),
            recentApplicantsCount: Number(data?.analytics?.studentEngagement?.recentApplicantsCount || 0),
            totalApplications: Number(data?.analytics?.studentEngagement?.totalApplications || 0),
            acceptedApplications: Number(data?.analytics?.studentEngagement?.acceptedApplications || 0)
          },
          trends: Array.isArray(data?.analytics?.trends) ? data.analytics.trends : []
        });
        setTrendData(
          Array.isArray(data?.analytics?.trends)
            ? data.analytics.trends.map((item) => ({
                month: String(item?.month || ''),
                aiMatchScore: Number(item?.aiMatchScore || 0),
                successRate: Number(item?.successRate || 0),
                engagementScore: Number(item?.engagementScore || 0)
              }))
            : []
        );
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load dashboard stats.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, [selectedMonths, selectedInternshipId]);

  const animated = {
    hidden: { opacity: 0, y: 12 },
    visible: (delay = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.35, delay } })
  };

  const handleExportSummaryCsv = () => {
    const selectedProgram = selectedInternshipId === 'all'
      ? 'All programs'
      : (availablePrograms.find((item) => String(item.id) === String(selectedInternshipId))?.title || 'Selected program');
    const rows = [
      ['Metric', 'Value'],
      ['Range (months)', selectedMonths],
      ['Program filter', selectedProgram],
      ['AI Match Score', `${analytics.aiMatching.matchScore}%`],
      ['Top Match Score', `${analytics.aiMatching.topMatchScore}%`],
      ['Scored Applications Sample', analytics.aiMatching.sampleSize],
      ['Internship Success Rate', `${analytics.internshipSuccess.successRate}%`],
      ['Completed Interns', analytics.internshipSuccess.completedInterns],
      ['Total Accepted Interns', analytics.internshipSuccess.totalInterns],
      ['Student Engagement Score', `${analytics.studentEngagement.engagementScore}%`],
      ['Response Rate', `${analytics.studentEngagement.responseRate}%`],
      ['Interview Rate', `${analytics.studentEngagement.interviewRate}%`],
      ['Recent Applicants (30 days)', analytics.studentEngagement.recentApplicantsCount],
      ['Total Applications', analytics.studentEngagement.totalApplications],
      ['Accepted Applications', analytics.studentEngagement.acceptedApplications]
    ];

    downloadCsv(`employer-analytics-summary-${Date.now()}.csv`, rows);
  };

  const handleExportTrendCsv = () => {
    const rows = [
      ['Month', 'AI Match Score (%)', 'Success Rate (%)', 'Engagement Score (%)'],
      ...trendData.map((item) => [item.month, item.aiMatchScore, item.successRate, item.engagementScore])
    ];
    downloadCsv(`employer-kpi-trend-${Date.now()}.csv`, rows);
  };

  const handleOpenPdfReport = () => {
    const selectedProgram = selectedInternshipId === 'all'
      ? 'All programs'
      : (availablePrograms.find((item) => String(item.id) === String(selectedInternshipId))?.title || 'Selected program');

    const trendsRows = trendData.length > 0
      ? trendData.map((item) => `
          <tr>
            <td>${item.month}</td>
            <td>${item.aiMatchScore}%</td>
            <td>${item.successRate}%</td>
            <td>${item.engagementScore}%</td>
          </tr>
        `).join('')
      : '<tr><td colspan="4">No trend data available.</td></tr>';

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Employer Analytics Report</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 24px; color: #0f172a; }
            .header { border: 1px solid #dbeafe; background: linear-gradient(180deg,#eff6ff 0%,#ffffff 100%); border-radius: 14px; padding: 16px; }
            .title { font-size: 24px; font-weight: 700; margin: 0; }
            .subtitle { margin: 6px 0 0; color: #475569; font-size: 13px; }
            .filters { margin-top: 12px; font-size: 12px; color: #334155; }
            .grid { margin-top: 16px; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
            .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
            .label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #64748b; margin: 0 0 6px; }
            .value { font-size: 28px; font-weight: 700; margin: 0; }
            .hint { font-size: 12px; color: #475569; margin: 6px 0 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 12px; text-align: left; }
            th { background: #f8fafc; font-weight: 700; }
            .footer { margin-top: 14px; font-size: 11px; color: #64748b; }
            @media print { body { margin: 12mm; } }
          </style>
        </head>
        <body>
          <section class="header">
            <h1 class="title">Employer Analytics Report</h1>
            <p class="subtitle">Live database-driven analytics export</p>
            <p class="filters">Range: Last ${selectedMonths} month(s) | Program: ${selectedProgram} | Generated: ${new Date().toLocaleString()}</p>
          </section>

          <section class="grid">
            <article class="card">
              <p class="label">AI Matching</p>
              <p class="value">${analytics.aiMatching.matchScore}%</p>
              <p class="hint">Top match ${analytics.aiMatching.topMatchScore}% from ${analytics.aiMatching.sampleSize} scored applications.</p>
            </article>
            <article class="card">
              <p class="label">Internship Success</p>
              <p class="value">${analytics.internshipSuccess.successRate}%</p>
              <p class="hint">${analytics.internshipSuccess.completedInterns} completed of ${analytics.internshipSuccess.totalInterns} accepted interns.</p>
            </article>
            <article class="card">
              <p class="label">Student Engagement</p>
              <p class="value">${analytics.studentEngagement.engagementScore}%</p>
              <p class="hint">Response ${analytics.studentEngagement.responseRate}% | Interview ${analytics.studentEngagement.interviewRate}%.</p>
            </article>
          </section>

          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>AI Match</th>
                <th>Success Rate</th>
                <th>Engagement</th>
              </tr>
            </thead>
            <tbody>
              ${trendsRows}
            </tbody>
          </table>

          <p class="footer">Tip: Use browser Print and choose Save as PDF.</p>
        </body>
      </html>
    `;

    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    window.setTimeout(() => {
      win.print();
    }, 250);
  };

  const handleDownloadServerPdf = async () => {
    try {
      setDownloadNotice('');
      const params = {
        months: selectedMonths,
        ...(selectedInternshipId !== 'all' ? { internshipId: selectedInternshipId } : {})
      };
      const response = await employerAPI.downloadAnalyticsPdf(params);

      const payloadBlob = response?.data instanceof Blob
        ? response.data
        : new Blob([response?.data], { type: 'application/pdf' });

      const headerBuffer = await payloadBlob.slice(0, 5).arrayBuffer();
      const headerBytes = Array.from(new Uint8Array(headerBuffer));
      const isPdfSignature = headerBytes.length >= 4
        && headerBytes[0] === 0x25
        && headerBytes[1] === 0x50
        && headerBytes[2] === 0x44
        && headerBytes[3] === 0x46;
      const contentType = String(response?.headers?.['content-type'] || '');
      const isPdfByContentType = contentType.toLowerCase().includes('application/pdf');

      if (!isPdfSignature && !isPdfByContentType) {
        const serverMessage = await payloadBlob.text();
        let details = 'Server returned non-PDF content.';
        try {
          const parsed = JSON.parse(serverMessage);
          details = parsed?.message || details;
        } catch {
          if (serverMessage) {
            details = serverMessage.slice(0, 160);
          }
        }
        throw new Error(details);
      }

      const blob = new Blob([payloadBlob], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `employer-analytics-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDownloadNotice('Employer analytics PDF download started.');
    } catch (downloadError) {
      setDownloadNotice(downloadError?.message || 'Unable to download PDF report.');
    }
  };

  return (
    <div className="student-dashboard space-y-6">
      {loading ? <DashboardSkeleton /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {downloadNotice ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${downloadNotice.toLowerCase().includes('unable') || downloadNotice.toLowerCase().includes('server returned')
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
          {downloadNotice}
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Program snapshot</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{loading ? '...' : `${stats.activePrograms} active programs`}</p>
            <p className="mt-1 text-sm text-slate-500">{loading ? 'Loading...' : `${stats.totalInterns} total interns in pipeline`}</p>
          </div>
        </div>
      </motion.section>

      <motion.section initial="hidden" animate="visible" custom={0.08} variants={animated} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active Programs" value={loading ? '...' : String(stats.activePrograms)} hint="Training programs currently available" />
        <StatTile label="Total Interns" value={loading ? '...' : String(stats.totalInterns)} hint="All interns enrolled across programs" />
        <StatTile label="Ongoing" value={loading ? '...' : String(stats.ongoing)} hint="Interns currently in training" />
        <StatTile label="Completed" value={loading ? '...' : String(stats.completed)} hint="Interns who finished successfully" />
      </motion.section>

      <motion.section initial="hidden" animate="visible" custom={0.09} variants={animated} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Analytics Filters</p>
            <p className="mt-1 text-sm text-slate-600">Switch time window and internship to inspect live KPI changes.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Range</span>
              <select
                value={selectedMonths}
                onChange={(event) => setSelectedMonths(Number(event.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500"
              >
                <option value={3}>Last 3 months</option>
                <option value={6}>Last 6 months</option>
                <option value={12}>Last 12 months</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Program</span>
              <select
                value={selectedInternshipId}
                onChange={(event) => setSelectedInternshipId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500"
              >
                <option value="all">All programs</option>
                {availablePrograms.map((item) => (
                  <option key={item.id} value={item.id}>{item.title}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportSummaryCsv}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
          >
            Export Summary CSV
          </button>
          <button
            type="button"
            onClick={handleExportTrendCsv}
            disabled={trendData.length === 0}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Export Trend CSV
          </button>
          <button
            type="button"
            onClick={handleOpenPdfReport}
            className="rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-slate-800"
          >
            Print or Save PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadServerPdf}
            className="rounded-xl border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-emerald-600"
          >
            Download PDF (Server)
          </button>
        </div>
      </motion.section>

      <motion.section initial="hidden" animate="visible" custom={0.1} variants={animated} className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-violet-200 bg-[linear-gradient(180deg,#f5f3ff_0%,#ffffff_100%)] p-5 shadow-[0_12px_30px_rgba(76,29,149,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">AI Matching</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{analytics.aiMatching.matchScore}%</p>
          <p className="mt-2 text-sm text-slate-600">Top match: {analytics.aiMatching.topMatchScore}% • Evaluated from {analytics.aiMatching.sampleSize} scored applications.</p>
        </div>

        <div className="rounded-3xl border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#ffffff_100%)] p-5 shadow-[0_12px_30px_rgba(5,150,105,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Internship Success Rate</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{analytics.internshipSuccess.successRate}%</p>
          <p className="mt-2 text-sm text-slate-600">{analytics.internshipSuccess.completedInterns} completed out of {analytics.internshipSuccess.totalInterns} accepted interns.</p>
        </div>

        <div className="rounded-3xl border border-sky-200 bg-[linear-gradient(180deg,#f0f9ff_0%,#ffffff_100%)] p-5 shadow-[0_12px_30px_rgba(2,132,199,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Student Engagement</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{analytics.studentEngagement.engagementScore}%</p>
          <p className="mt-2 text-sm text-slate-600">Response rate {analytics.studentEngagement.responseRate}% • Interview rate {analytics.studentEngagement.interviewRate}% • {analytics.studentEngagement.recentApplicantsCount} new in last 30 days.</p>
        </div>
      </motion.section>

      <motion.div initial="hidden" animate="visible" custom={0.11} variants={animated}>
      <Card title={`KPI Trend (Last ${selectedMonths} Months)`} description="Live trend of AI matching, internship success, and student engagement from database records." className="student-panel rounded-3xl border-cyan-100 bg-white">
        {trendData.length > 0 ? (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 14, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Line type="monotone" dataKey="aiMatchScore" name="AI Match" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="successRate" name="Success Rate" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="engagementScore" name="Engagement" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">Not enough trend data yet.</p>
        )}
      </Card>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={0.12} variants={animated}>
      <Card title="Quick Actions" description="Same workflow style as student dashboard, tuned for industry operations." className="student-panel rounded-3xl border-cyan-100 bg-white">
        <div className="grid gap-4 lg:grid-cols-3">
          <ActionCard to="/employer/post-internship" title="Post Internship" description="Create a live internship opening with real database fields." tone="dark" />
          <ActionCard to="/employer/applicants" title="Review Applicants" description="Accept and reject applications with real status updates." />
          <ActionCard to="/employer/active-interns" title="Track Interns" description="Monitor progress and ongoing intern performance." />
        </div>
      </Card>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={0.16} variants={animated}>
      <Card title="Internship Performance Chart" description="Applicants per program and completion rate from live database records." className="student-panel rounded-3xl border-cyan-100 bg-white">
        {performanceData.length > 0 ? (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={performanceData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="program"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  interval={0}
                  tickFormatter={(value) => String(value).slice(0, 14)}
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip />
                <Bar yAxisId="left" dataKey="applicants" name="Applicants" fill="#0284c7" radius={[8, 8, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="completionRate" name="Completion Rate" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No performance data yet.</p>
        )}
      </Card>
      </motion.div>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <motion.div initial="hidden" animate="visible" custom={0.2} variants={animated}>
      <Card title="Recommended Students" description="Top student matches generated from required skills in your active programs." className="student-panel rounded-3xl border-cyan-100 bg-white">
        {recommendedStudents.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {recommendedStudents.map((student) => (
              <div key={student.userId || student.name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-700">Match score</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{Number(student.matchScore || 0)}%</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No recommended students available yet.</p>
        )}
      </Card>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={0.24} variants={animated}>
      <Card title="Recent Activity" description="Live activity feed from applications, program starts, and submitted evaluations." className="student-panel rounded-3xl border-cyan-100 bg-white">
        {recentActivity.length > 0 ? (
          <div className="space-y-3">
            {recentActivity.map((item) => (
              <div key={item.id || `${item.type}-${item.timestamp}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.title || 'Activity'}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.description || 'No details available.'}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getActivityBadgeClass(item.type)}`}>{String(item.type || 'activity').replace('-', ' ')}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{formatDateTime(item.timestamp)}</p>
              </div>
            ))}
            <div className="pt-1">
              <Link to="/employer/activity" className="text-sm font-semibold text-brand-700 hover:underline">View all activity</Link>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No recent activity available yet.</p>
        )}
      </Card>
      </motion.div>
      </section>
    </div>
  );
}
