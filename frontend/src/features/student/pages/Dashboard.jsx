import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import Card from '@/components/ui/Card';
import useAuth from '@/hooks/useAuth';
import ErrorMessage from '@/components/common/ErrorMessage';
import { studentAPI } from '../studentAPI';

function getDisplayName(user) {
  return user?.name || user?.fullName || 'Student';
}

function getProfileCompletion(user) {
  const checks = [
    user?.name || user?.fullName,
    user?.email,
    user?.phone,
    user?.college,
    user?.department,
    user?.isVerified
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function normalizeStudentPath(path) {
  const value = String(path || '').trim();
  if (!value || value === '#') return '/student/dashboard';
  if (value.startsWith('/student/')) return value;
  if (value.startsWith('/dashboard/')) return value.replace('/dashboard/', '/student/');
  if (value.startsWith('/')) return value;
  return `/student/${value}`;
}

function getDepartmentSkills(department = '') {
  const value = String(department || '').toLowerCase();
  if (value.includes('computer')) return ['JavaScript', 'Python', 'Node.js', 'React', 'SQL', 'Git'];
  if (value.includes('software')) return ['Java', 'Python', 'System Design', 'Testing', 'DevOps'];
  if (value.includes('information')) return ['Networking', 'Database', 'Cloud', 'Cybersecurity', 'Linux'];
  if (value.includes('electrical')) return ['Embedded C', 'MATLAB', 'IoT', 'Signal Processing'];
  if (value.includes('business')) return ['Excel', 'Data Analysis', 'Communication', 'Presentation'];
  return ['JavaScript', 'Python', 'Problem Solving', 'Communication'];
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="dashboard-skeleton h-40 rounded-3xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={`stat-skeleton-${index}`} className="dashboard-skeleton h-28 rounded-3xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => <div key={`quick-skeleton-${index}`} className="dashboard-skeleton h-32 rounded-3xl" />)}
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

function ProfileGauge({ value }) {
  const clamped = Math.max(0, Math.min(100, Number(value || 0)));
  const style = { background: `conic-gradient(#0284c7 ${clamped * 3.6}deg, #e2e8f0 0deg)` };

  return (
    <div className="relative grid h-24 w-24 place-items-center rounded-full" style={style}>
      <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-lg font-semibold text-slate-900">{clamped}%</div>
    </div>
  );
}

function MiniCalendar({ events = [] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const highlighted = new Set(
    events
      .map((event) => new Date(event?.originalDate || event?.date || ''))
      .filter((date) => !Number.isNaN(date.getTime()) && date.getMonth() === month && date.getFullYear() === year)
      .map((date) => date.getDate())
  );

  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((value) => <span key={value}>{value}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, index) => (
          <div key={`calendar-cell-${index}`} className={`grid h-7 place-items-center rounded-lg text-xs ${day ? 'text-slate-700' : 'text-transparent'} ${highlighted.has(day) ? 'bg-cyan-600 font-semibold text-white' : 'bg-white'}`}>
            {day || '.'}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const auth = useAuth();
  const user = auth?.user || {};
  const displayName = getDisplayName(user);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingEvaluationPaper, setDownloadingEvaluationPaper] = useState(false);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await studentAPI.getDashboard();
        if (active) setDashboardData(data);
      } catch (requestError) {
        if (active) setError(requestError?.response?.data?.message || 'Unable to load dashboard data.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const profileCompletion = dashboardData?.profile?.profileStrength ?? getProfileCompletion(user);
  const stats = dashboardData?.stats || {};
  const recentApplications = dashboardData?.recentApplications || [];
  const nextTasks = dashboardData?.tasks || [];
  const recommendations = dashboardData?.recommendations || [];
  const activitySeries = dashboardData?.analytics?.activity || [];
  const calendarEvents = dashboardData?.calendarEvents || [];
  const trendingSkills = dashboardData?.analytics?.marketIntelligence?.trendingSkills || [];
  const userSkills = dashboardData?.profile?.academicInfo?.skills || [];

  const skillInsights = useMemo(() => {
    const fallback = getDepartmentSkills(user?.department);
    const source = trendingSkills.length > 0 ? trendingSkills.map((item) => item.name) : fallback;
    const normalizedUserSkills = new Set((userSkills || []).map((value) => String(value).trim().toLowerCase()));

    return source.slice(0, 8).map((name, index) => {
      const skillName = String(name || fallback[index] || '').trim();
      const normalized = skillName.toLowerCase();
      const owned = normalizedUserSkills.has(normalized);
      const demand = Number(trendingSkills.find((item) => String(item.name || '').toLowerCase() === normalized)?.intensity || 3);
      const potentialBoost = owned ? 0 : Math.min(20, 6 + demand * 2);

      return {
        name: skillName,
        demand,
        owned,
        potentialBoost
      };
    });
  }, [trendingSkills, userSkills, user?.department]);

  const activityChartData = useMemo(
    () => activitySeries.map((item) => ({ month: item.name, Applications: Number(item.applications || 0), Reports: Number(item.reports || 0), Actions: Number(item.actions || 0) })),
    [activitySeries]
  );

  const animated = {
    hidden: { opacity: 0, y: 12 },
    visible: (delay = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.35, delay } })
  };

  const handleDownloadEvaluationPaper = async () => {
    try {
      setError('');
      setDownloadingEvaluationPaper(true);
      const response = await studentAPI.downloadEvaluationPaper();
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
          if (serverMessage) details = serverMessage.slice(0, 160);
        }
        throw new Error(details);
      }

      const blob = new Blob([payloadBlob], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `student-evaluation-paper-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError?.message || 'Unable to download evaluation paper.');
    } finally {
      setDownloadingEvaluationPaper(false);
    }
  };

  return (
    <div className="student-dashboard space-y-6">
      {loading ? <DashboardSkeleton /> : null}
      {error ? <ErrorMessage message={error} /> : null}

      <motion.section initial="hidden" animate="visible" custom={0.03} variants={animated} className="student-panel rounded-[34px] border border-cyan-100 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.22),transparent_35%),linear-gradient(180deg,#ecfeff_0%,#ffffff_55%)] p-6 shadow-[0_24px_70px_rgba(14,116,144,0.14)] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Student command center</p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">Welcome, {displayName}</h1>
            <p className="max-w-xl text-base leading-7 text-slate-600">Track progress, submit applications, and complete your profile from one connected dashboard.</p>
          </div>
          <div className="flex items-center gap-5 rounded-3xl border border-cyan-100 bg-white/90 px-5 py-4 shadow-sm">
            <ProfileGauge value={profileCompletion} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Profile completion</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{profileCompletion}%</p>
              <p className="mt-1 text-sm text-slate-500">Improve this score for stronger matching.</p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section initial="hidden" animate="visible" custom={0.08} variants={animated} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total Applications" value={stats.total ?? 0} hint="Applications submitted" />
        <StatTile label="Accepted" value={stats.accepted ?? 0} hint="Offers received" />
        <StatTile label="Rejected" value={stats.rejected ?? 0} hint="Closed outcomes" />
        <StatTile label="Saved" value={dashboardData?.saved ?? 0} hint="Saved internships" />
      </motion.section>

      <motion.div initial="hidden" animate="visible" custom={0.12} variants={animated}>
      <Card title="Quick Actions" description="Every button is connected to a real route and backend flow." className="student-panel rounded-3xl border-cyan-100 bg-white">
        <div className="grid gap-4 lg:grid-cols-3">
          <ActionCard to="/student/internships" title="Apply Now" description="Open internships and submit real applications." tone="dark" />
          <ActionCard to="/student/internships" title="Browse Internships" description="Explore all current open opportunities." />
          <ActionCard to="/student/profile" title="Update Profile" description="Save your profile and improve match quality." />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownloadEvaluationPaper}
            disabled={downloadingEvaluationPaper}
            className="rounded-xl border border-cyan-700 bg-cyan-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloadingEvaluationPaper ? 'Preparing PDF...' : 'Download Evaluation Paper (PDF)'}
          </button>
        </div>
      </Card>
      </motion.div>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <motion.div initial="hidden" animate="visible" custom={0.16} variants={animated}>
        <Card title="Recent Applications" description="Latest applications pulled from database." className="student-panel rounded-3xl border-cyan-100 bg-white">
          {recentApplications.length > 0 ? (
            <div className="space-y-3">
              {recentApplications.slice(0, 5).map((application) => (
                <motion.div whileHover={{ scale: 1.01 }} key={application._id || application.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{application?.internshipId?.title || 'Internship application'}</p>
                      <p className="mt-1 text-sm text-slate-500">{application?.internshipId?.location || 'Location not specified'}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{application.status || 'Pending'}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No applications yet.</p>
          )}
        </Card>
        </motion.div>

        <motion.div initial="hidden" animate="visible" custom={0.2} variants={animated}>
        <Card title="Next Steps" description="Tasks generated from your live dashboard data." className="student-panel rounded-3xl border-cyan-100 bg-white">
          <div className="space-y-3">
            {nextTasks.length > 0 ? nextTasks.slice(0, 5).map((task, index) => (
              <motion.div whileHover={{ y: -2 }} key={`${task.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                <Link to={normalizeStudentPath(task.actionPath)} className="mt-2 inline-flex text-sm font-semibold text-cyan-700 hover:underline">Open task</Link>
              </motion.div>
            )) : (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No active tasks right now.</p>
            )}
          </div>
        </Card>
        </motion.div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <motion.div initial="hidden" animate="visible" custom={0.24} variants={animated}>
        <Card title="Activity Pulse" description="Live six-month application and action analytics." className="student-panel rounded-3xl border-cyan-100 bg-white">
          {activityChartData.length > 0 ? (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="actionsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Actions" stroke="#0284c7" fill="url(#actionsFill)" strokeWidth={2.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No activity history yet.</p>
          )}
        </Card>
        </motion.div>

        <motion.div initial="hidden" animate="visible" custom={0.28} variants={animated}>
        <Card title="Upcoming Timeline" description="Application deadlines and interview schedule with interactive mini calendar." className="student-panel rounded-3xl border-cyan-100 bg-white">
          {calendarEvents.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
              {calendarEvents.slice(0, 5).map((event) => (
                <motion.div whileHover={{ scale: 1.01 }} key={`${event.title}-${event.date}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{event.date} {event.time ? `· ${event.time}` : ''}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 ring-1 ring-cyan-100">{event.type}</span>
                  </div>
                </motion.div>
              ))}
              </div>
              <MiniCalendar events={calendarEvents} />
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No upcoming events yet.</p>
          )}
        </Card>
        </motion.div>
      </section>

      <motion.div initial="hidden" animate="visible" custom={0.32} variants={animated}>
      <Card title="Trending Skills" description="Department-aware skill badges with match impact insights." className="student-panel rounded-3xl border-cyan-100 bg-white">
        {skillInsights.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {skillInsights.map((skill) => (
                <span key={skill.name} className={`rounded-full border px-4 py-2 text-sm font-medium ${skill.owned ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                  {skill.name}
                  {skill.owned ? (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">Applied</span>
                  ) : (
                    <span className="ml-2 rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-semibold text-cyan-700">+{skill.potentialBoost}% match</span>
                  )}
                </span>
              ))}
            </div>
            <p className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">Add missing skills in your profile to increase your matching score in recommendations and applications.</p>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No skill trend data yet.</p>
        )}
      </Card>
      </motion.div>

      {recommendations.length > 0 ? (
        <motion.div initial="hidden" animate="visible" custom={0.36} variants={animated}>
        <Card title="Recommended Internships" description="Top matches generated from your profile and available roles." className="student-panel rounded-3xl border-cyan-100 bg-white">
          <div className="grid gap-4 lg:grid-cols-3">
            {recommendations.slice(0, 3).map((item) => (
              <motion.div whileHover={{ y: -2 }} key={item._id || item.id || item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">{item.location || 'Location not specified'}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Match score</span>
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-semibold text-cyan-800">{item.matchScore ?? 0}%</span>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
        </motion.div>
      ) : null}
    </div>
  );
}
