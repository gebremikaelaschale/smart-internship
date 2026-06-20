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
import useCompanyStatusSync from '@/hooks/useCompanyStatusSync';
import { getMatchTone } from '@/utils/internshipMatching';
import {
  STUDENT_PROFILE_UPDATED_EVENT,
  STUDENT_PROFILE_UPDATED_STORAGE_KEY,
  STUDENT_STATS_REFRESH_EVENT,
  STUDENT_STATS_REFRESH_STORAGE_KEY
} from '@/utils/profileSync';

function getDisplayName(user) {
  return user?.name || user?.fullName || 'Student';
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
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
    </div>
  );
}

function MiniCalendar({ events = [] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
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

function ProfileGauge({ value = 0 }) {
  const clamped = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div
      className="relative grid h-14 w-14 place-items-center rounded-full"
      style={{ background: `conic-gradient(#0284c7 ${clamped * 3.6}deg, #dbeafe 0deg)` }}
      aria-label={`Profile completion ${clamped}%`}
    >
      <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-[10px] font-black text-cyan-700">
        {clamped}%
      </div>
    </div>
  );
}

function MatchProgressCircle({ score = 0 }) {
  const clamped = Math.max(0, Math.min(100, Number(score || 0)));
  const tone = getMatchTone(clamped);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke={tone.track} strokeWidth="10" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={tone.accent}
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 350ms ease, stroke 350ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`text-2xl font-black leading-none ${tone.text}`}>{clamped}</span>
        <span className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Match</span>
      </div>
    </div>
  );
}

function formatCountdown(targetDate, now = Date.now()) {
  const target = targetDate ? new Date(targetDate) : null;
  if (!target || Number.isNaN(target.getTime())) return 'No deadline';

  const diffMs = target.getTime() - now;
  const absMinutes = Math.max(1, Math.round(Math.abs(diffMs) / 60000));
  const absHours = Math.max(1, Math.round(Math.abs(diffMs) / 3600000));
  const absDays = Math.max(1, Math.round(Math.abs(diffMs) / 86400000));

  if (diffMs < 0) {
    if (absMinutes < 60) return `Overdue by ${absMinutes} min`;
    if (absHours < 24) return `Overdue by ${absHours} hour${absHours === 1 ? '' : 's'}`;
    return `Overdue by ${absDays} day${absDays === 1 ? '' : 's'}`;
  }

  if (absMinutes < 60) return `Ends in ${absMinutes} min`;
  if (absHours < 24) return `Ends in ${absHours} hour${absHours === 1 ? '' : 's'}`;
  return `Ends in ${absDays} day${absDays === 1 ? '' : 's'}`;
}

function getActionTone(type = '') {
  const key = String(type || '').toLowerCase();
  if (key === 'interview') {
    return { badge: 'bg-blue-50 text-blue-700 border-blue-100', accent: 'bg-blue-500', label: 'Interview' };
  }

  if (key === 'logbook') {
    return { badge: 'bg-cyan-50 text-cyan-700 border-cyan-100', accent: 'bg-cyan-500', label: 'Logbook' };
  }

  if (key === 'offer') {
    return { badge: 'bg-amber-50 text-amber-700 border-amber-100', accent: 'bg-amber-500', label: 'Offer' };
  }

  return { badge: 'bg-rose-50 text-rose-700 border-rose-100', accent: 'bg-rose-500', label: 'Deadline' };
}

function RecommendedInternshipCard({ internship, score, reasoning }) {
  const tone = getMatchTone(score);
  const isTopPick = score > 80;
  const isPerfectMatch = score >= 100;
  const skillNames = Array.isArray(internship?.matchedSkills)
    ? internship.matchedSkills.map((skill) => String(skill?.raw || skill?.normalized || '').trim()).filter(Boolean)
    : [];
  const matchedSkillSummary = skillNames.length > 0 ? skillNames.slice(0, 3).join(', ') : 'your profile skills';
  const locationSummary = internship?.location ? `${internship.location} location fit` : 'your location fit';
  const tooltipText = isPerfectMatch
    ? `Matched because your ${matchedSkillSummary} skills line up with this internship and the ${locationSummary} is a strong fit.`
    : reasoning;

  return (
    <article className="group flex min-w-[320px] max-w-[320px] snap-start flex-col rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_20px_45px_rgba(15,23,42,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-600">Recommended Internship</p>
          <h3 className="mt-2 truncate text-lg font-black tracking-tight text-slate-900 group-hover:text-cyan-700">
            {internship.internship_title || internship.title}
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {internship.company_name || internship.companyId?.name || internship.companyId?.fullName || 'Industry Partner'}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {isPerfectMatch ? (
            <div className="relative inline-flex group/match">
              <span className="shrink-0 rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-50 to-lime-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_10px_24px_rgba(16,185,129,0.18)]">
                100% Match
              </span>
              <span className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl bg-slate-950 px-4 py-3 text-left text-xs leading-6 text-white opacity-0 shadow-2xl transition group-hover/match:opacity-100">
                {tooltipText}
              </span>
            </div>
          ) : null}

          {isTopPick ? (
            <span className="shrink-0 rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-50 to-lime-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_10px_24px_rgba(16,185,129,0.18)]">
              Top Pick
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4 rounded-[24px] border border-slate-100 bg-slate-50/80 p-4">
        <MatchProgressCircle score={score} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-black ${tone.text}`}>{tone.label}</p>
          <p className="mt-1 line-clamp-3 text-xs leading-6 text-slate-600">{reasoning}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(Array.isArray(internship.requiredSkills) ? internship.requiredSkills : []).slice(0, 3).map((skill) => (
          <span key={`${internship._id}-${skill}`} className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
            {skill}
          </span>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Location</p>
          <p className="mt-1 font-bold text-slate-900">{internship.location || 'TBA'}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Modality</p>
          <p className="mt-1 font-bold text-slate-900">{internship.workModality || 'On-site'}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-500">
          {internship.studentsNeeded ? `${internship.studentsNeeded} seats available` : 'Open internship'}
        </p>
        <Link
          to="/student/internships"
          className="rounded-full bg-cyan-600 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(8,145,178,0.18)] transition hover:bg-cyan-700 hover:shadow-[0_14px_30px_rgba(8,145,178,0.24)]"
        >
          View Details
        </Link>
      </div>
    </article>
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
  const [internships, setInternships] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);
  const [dashboardStats, setDashboardStats] = useState({
    totalInternships: 0,
    totalApplications: 0,
    totalAccepted: 0,
    totalRejected: 0,
    totalSaved: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);


  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  // Fetch real-time dashboard statistics
  useEffect(() => {
    let active = true;

    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const response = await studentAPI.getDashboardStats();

        if (!active) return;

        const data = response?.data || {};
        setDashboardStats({
          totalInternships: Number(data.totalInternships || 0),
          totalApplications: Number(data.totalApplications || 0),
          totalAccepted: Number(data.totalAccepted || 0),
          totalRejected: Number(data.totalRejected || 0),
          totalSaved: Number(data.totalSaved || 0)
        });
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        if (active) {
          setDashboardStats({
            totalInternships: 0,
            totalApplications: 0,
            totalAccepted: 0,
            totalRejected: 0,
            totalSaved: 0
          });
        }
      } finally {
        if (active) setStatsLoading(false);
      }
    };

    fetchStats();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError('');
        const [dashboardRes, internshipsRes] = await Promise.all([
          studentAPI.getDashboard(),
          studentAPI.getInternships({ limit: 1000 })
        ]);

        if (active) {
          setDashboardData(dashboardRes.data);
          const internshipItems = Array.isArray(internshipsRes?.data?.items)
            ? internshipsRes.data.items
            : Array.isArray(internshipsRes?.data)
              ? internshipsRes.data
              : [];
          setInternships(internshipItems);
        }
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
  }, [auth?.user?.isVerified, auth?.user?.verificationStatus, refreshKey]);

  useEffect(() => {
    const handleProfileUpdate = () => {
      setRefreshKey((value) => value + 1);
    };

    const handleStorageUpdate = (event) => {
      if (event.key === STUDENT_PROFILE_UPDATED_STORAGE_KEY || event.key === STUDENT_STATS_REFRESH_STORAGE_KEY) {
        handleProfileUpdate();
      }
    };

    window.addEventListener(STUDENT_PROFILE_UPDATED_EVENT, handleProfileUpdate);
    window.addEventListener(STUDENT_STATS_REFRESH_EVENT, handleProfileUpdate);
    window.addEventListener('storage', handleStorageUpdate);

    return () => {
      window.removeEventListener(STUDENT_PROFILE_UPDATED_EVENT, handleProfileUpdate);
      window.removeEventListener(STUDENT_STATS_REFRESH_EVENT, handleProfileUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  // Refresh dashboard data when company verification statuses change (real-time)
  useCompanyStatusSync(() => {
    (async () => {
      try {
        setLoading(true);
        const [dashboardRes, internshipsRes] = await Promise.all([
          studentAPI.getDashboard(),
          studentAPI.getInternships({ limit: 1000 })
        ]);
        setDashboardData(dashboardRes.data);
        const internshipItems = Array.isArray(internshipsRes?.data?.items)
          ? internshipsRes.data.items
          : Array.isArray(internshipsRes?.data)
            ? internshipsRes.data
            : [];
        setInternships(internshipItems);
        // Also refresh stats on company status sync
        setRefreshKey((value) => value + 1);
      } catch (err) {
        // ignore errors during background refresh
      } finally {
        setLoading(false);
      }
    })();
  });

  // Function to manually refresh stats (call after applying, saving, etc.)
  const refreshStats = () => {
    setRefreshKey((value) => value + 1);
  };

  const profileCompletion = dashboardData?.profile?.profileStrength ?? getProfileCompletion(user);
  const verificationStatus = String(dashboardData?.profile?.verificationStatus || auth?.user?.verificationStatus || (dashboardData?.profile?.isVerified ? 'Verified' : '') || '').trim().toLowerCase();
  const isNotSubmitted = verificationStatus === 'not submitted' || !verificationStatus;
  const isPendingVerification = verificationStatus === 'pending' || verificationStatus === 'submitted';
  const isRejected = verificationStatus === 'rejected';
  const isVerified = verificationStatus === 'verified';
  const stats = dashboardData?.stats || {};
  const recentApplications = dashboardData?.recentApplications || [];
  const recentHodAssignment = useMemo(() => recentApplications.find((application) => {
    const status = String(application?.status || '').toLowerCase();
    const placementSource = String(application?.placement_source || '').toUpperCase();
    return status === 'hod_assigned' || placementSource === 'HOD_ASSIGNED' || String(application?.source || '').toLowerCase() === 'hod';
  }) || null, [recentApplications]);
  const nextTasks = dashboardData?.tasks || [];
  const activitySeries = dashboardData?.analytics?.activity || [];
  const calendarEvents = dashboardData?.calendarEvents || [];
  const actionRequired = dashboardData?.actionRequired || [];
  const trendingSkills = dashboardData?.analytics?.marketIntelligence?.trendingSkills || [];
  const userSkills = dashboardData?.profile?.academicInfo?.skills || [];
  const recommendedInternships = useMemo(() => {
    return internships
      .map((item) => ({
        internship: item,
        score: Number(item?.matchScore || item?.aiMatchScore || item?.matchingScore || 0),
        reasoning: item?.matchReasoning || item?.reasoning || '',
        matchedSkills: item?.matchedTerms || item?.matchedSkills || []
      }))
      .filter((item) => item.score >= 65)
      .sort((a, b) => b.score - a.score);
  }, [internships]);

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

  const statCardsConfig = [
    {
      key: 'openInternships',
      label: 'Total Internships',
      dataKey: 'totalInternships',
      hint: 'Available internship openings',
      theme: {
        card: 'bg-sky-50 border-sky-200',
        label: 'text-sky-700',
        iconBg: 'bg-sky-100',
        iconColor: 'text-sky-600'
      },
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7h18" />
          <rect x="3" y="7" width="18" height="12" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      )
    },
    {
      key: 'totalApplications',
      label: 'Total Applications',
      dataKey: 'totalApplications',
      hint: 'Applications submitted',
      theme: {
        card: 'bg-indigo-50 border-indigo-200',
        label: 'text-indigo-700',
        iconBg: 'bg-indigo-100',
        iconColor: 'text-indigo-600'
      },
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16v16H4z" />
          <path d="M4 8h16" />
          <path d="M8 12h8" />
          <path d="M8 16h8" />
        </svg>
      )
    },
    {
      key: 'accepted',
      label: 'Total Accepted',
      dataKey: 'totalAccepted',
      hint: 'Successful offers',
      theme: {
        card: 'bg-emerald-50 border-emerald-200',
        label: 'text-emerald-700',
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600'
      },
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )
    },
    {
      key: 'rejected',
      label: 'Total Rejected',
      dataKey: 'totalRejected',
      hint: 'Closed or denied outcomes',
      theme: {
        card: 'bg-rose-50 border-rose-200',
        label: 'text-rose-700',
        iconBg: 'bg-rose-100',
        iconColor: 'text-rose-600'
      },
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )
    },
    {
      key: 'saved',
      label: 'Total Saved',
      dataKey: 'totalSaved',
      hint: 'Bookmarked internships',
      theme: {
        card: 'bg-amber-50 border-amber-200',
        label: 'text-amber-700',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600'
      },
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 4h12a2 2 0 0 1 2 2v16l-8-5-8 5V6a2 2 0 0 1 2-2z" />
        </svg>
      )
    }
  ];

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
    <div className="student-dashboard space-y-6 w-full">
      {loading ? <DashboardSkeleton /> : null}
      {error ? <ErrorMessage message={error} /> : null}

      <section className="bg-white border-b border-slate-100 pt-12 pb-8 px-6 lg:px-10 rounded-[32px] mb-8">
        <div className="w-full mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2">
            {loading ? (
              <div className="space-y-3">
                <div className="h-10 w-72 dashboard-skeleton rounded-lg" />
                <div className="h-5 w-96 dashboard-skeleton rounded-lg" />
              </div>
            ) : (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
                }}
              >
                <motion.h1
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
                  }}
                  className="text-4xl font-extrabold text-blue-950 tracking-tight"
                >
                  {getGreeting()}, {displayName}! 👋
                </motion.h1>
                <motion.p
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
                  }}
                  className="text-slate-500 font-medium max-w-xl mt-2"
                >
                  Ready to continue your professional journey?
                </motion.p>
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-4 rounded-3xl border border-cyan-100 bg-cyan-50/30 px-5 py-3 shadow-sm mr-4">
                <ProfileGauge value={profileCompletion} />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-700">Profile Strength</p>
                  <p className="text-lg font-black text-slate-900 leading-none">{profileCompletion}%</p>
                </div>
              </div>
          </div>
        </div>
      </section>

      {/* Profile incomplete / waiting / rejected state handling */}
      {!loading && isNotSubmitted ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-8 text-slate-800">
          <h2 className="text-xl font-black">Complete your profile</h2>
          <p className="mt-2">Finish and submit your profile so your Department Head can review and verify your account.</p>
        </div>
      ) : null}

      {!loading && isPendingVerification ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-amber-900">
          <h2 className="text-xl font-black">Your account is awaiting HOD verification</h2>
          <p className="mt-2">Your profile has been submitted. You will gain access to internship listings once your Department Head approves it.</p>
        </div>
      ) : null}

      {!loading && isRejected ? (
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-rose-50 px-6 py-8 text-rose-900 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <svg className="h-6 w-6 shrink-0 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-lg font-black">Your verification was rejected by the HOD</h2>
              </div>
              <p className="mt-3 text-sm">Reason: {dashboardData?.profile?.rejection_reason || dashboardData?.profile?.rejectionReason || dashboardData?.profile?.verificationNote || 'No reason provided.'} Please correct your profile and resubmit.</p>
              {/* Also surface the HOD's written feedback if present */}
              {dashboardData?.profile?.verificationNote || dashboardData?.profile?.rejectionReason ? (
                <div className="mt-4 rounded-xl border border-rose-100 bg-white px-4 py-3 text-sm text-rose-800">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 mb-2">Feedback from HOD</p>
                  <p className="leading-relaxed">{dashboardData.profile.verificationNote || dashboardData.profile.rejectionReason}</p>
                </div>
              ) : null}
            </div>
            <Link
              to="/student/profile"
              className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 shadow-sm hover:shadow-md"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Profile
            </Link>
          </div>
        </div>
      ) : null}

      {!loading && recentHodAssignment ? (
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-purple-50 px-6 py-8 text-purple-950 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-purple-700">
                University Placement
              </div>
              <h2 className="mt-3 text-xl font-black">Assigned by your HOD</h2>
              <p className="mt-2 text-sm leading-6 text-purple-900/80">
                {recentHodAssignment?.internshipId?.title || 'An internship'} has been assigned by your Department Head.
                {String(recentHodAssignment?.hod_assignment_note || recentHodAssignment?.hod_note || '').trim()
                  ? ` Note: ${String(recentHodAssignment?.hod_assignment_note || recentHodAssignment?.hod_note).trim()}`
                  : ''}
              </p>
            </div>
            <Link
              to="/student/applications"
              className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700 shadow-sm hover:shadow-md"
            >
              View Applications
            </Link>
          </div>
        </div>
      ) : null}

      {/* Show internship-related widgets only when verified */}
      {!loading && isVerified ? (
        <div className="space-y-6">
          <motion.section initial="hidden" animate="visible" custom={0.08} variants={animated} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {statsLoading ? (
              // Skeleton loaders while fetching stats
              Array(5).fill(0).map((_, idx) => (
                <div key={`skeleton-${idx}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="h-3 w-20 dashboard-skeleton rounded" />
                      <div className="mt-4 h-8 w-16 dashboard-skeleton rounded" />
                    </div>
                    <div className="h-12 w-12 dashboard-skeleton rounded-2xl" />
                  </div>
                  <div className="mt-3 h-4 w-32 dashboard-skeleton rounded" />
                </div>
              ))
            ) : (
              // Render actual stat cards with real data
              statCardsConfig.map((card) => {
                const value = dashboardStats[card.dataKey] ?? 0;
                return (
                  <div
                    key={card.key}
                    className={`rounded-3xl border p-5 transition duration-200 ease-out hover:shadow-[0_20px_60px_rgba(15,23,42,0.08)] ${card.theme.card}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={`text-[11px] font-black uppercase tracking-[0.16em] ${card.theme.label}`}>{card.label}</p>
                        <p className="mt-4 text-3xl font-black leading-none text-slate-900">{value}</p>
                      </div>
                      <div className={`grid h-12 w-12 place-items-center rounded-2xl shadow-sm ${card.theme.iconBg} ${card.theme.iconColor}`}>
                        {card.icon}
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-600">{card.hint}</p>
                  </div>
                );
              })
            )}
          </motion.section>

          <Card className="student-panel overflow-hidden rounded-[32px] border border-cyan-100 bg-white p-0 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-100 px-6 py-6 lg:px-8">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-600">Recommendations</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Recommended Internships for You</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Filtered from all internships using your current profile skills and requirements. Only roles with a match score of 65% or higher are shown.
              </p>
            </div>

            {recommendedInternships.length > 0 ? (
              <div className="flex gap-5 overflow-x-auto px-6 py-6 pb-7 snap-x snap-mandatory lg:px-8">
                {recommendedInternships.map(({ internship, score, reasoning, matchedSkills }) => (
                  <RecommendedInternshipCard
                    key={internship._id}
                    internship={{ ...internship, matchedSkills }}
                    score={score}
                    reasoning={reasoning}
                  />
                ))}
              </div>
            ) : (
              <div className="px-6 py-10 lg:px-8">
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                  <p className="text-lg font-black text-slate-900">No recommended internships yet</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Add more skills to your profile to unlock internships with a 65% or higher match.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : null}




    </div>
  );
}
