import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import api from '@/services/api';

function getTimeBasedGreeting(now = new Date()) {
  const hour = now.getHours();

  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function getAcademicYear(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month >= 8 ? year : year - 1;
  const endYearShort = String(startYear + 1).slice(-2);
  return `${startYear}/${endYearShort}`;
}

function formatLastSynced(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export default function HodWelcomeHeader({ hodName = '', lastSyncedAt = '', loading = false, onRefresh }) {
  const [departmentName, setDepartmentName] = useState('Assigned Department');

  useEffect(() => {
    let active = true;
    const loadMeta = async () => {
      try {
        const { data: profileData } = await api.get('/admin/me');
        if (!active) return;
        const fetched = String(profileData?.department || profileData?.college || '').trim();
        if (fetched) setDepartmentName(fetched);
      } catch {
        // fallback
      }
    };
    loadMeta();
    return () => { active = false; };
  }, []);

  const greeting = useMemo(() => getTimeBasedGreeting(), []);
  const academicYear = useMemo(() => getAcademicYear(), []);

  return (
    <section className="rounded-[1.6rem] border border-[#E2E8F0] bg-white px-8 py-10 shadow-none">
      <div className="border-l-2 border-blue-600 pl-6">
        <div className="flex items-start justify-between gap-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">HOD Portal Overview</p>
          <div className="flex shrink-0 items-center gap-3 rounded-full border border-blue-100 bg-blue-50/40 px-3 py-2">
            <p className="whitespace-nowrap text-[11px] font-medium text-[#64748B]">
              Last synced: <span className="font-semibold text-blue-700">{formatLastSynced(lastSyncedAt)}</span>
            </p>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading || typeof onRefresh !== 'function'}
              aria-busy={loading}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg className={`h-3.5 w-3.5 transition-transform ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{loading ? 'Syncing…' : 'Live Update'}</span>
            </button>
          </div>
        </div>

        <div className="mt-8 max-w-4xl">
          <p className="text-base font-semibold tracking-tight text-blue-700">{greeting},</p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeInOut' }} className="mt-3 mb-3 text-5xl font-semibold tracking-tight text-[#1E293B]">
            {hodName}
          </motion.h2>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeInOut', delay: 0.2 }} className="mt-6 flex flex-wrap items-center gap-3 text-base font-medium text-[#64748B]">
            <span>{departmentName}</span>
            <span className="h-5 w-px bg-slate-200" aria-hidden="true" />
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
              Academic Year {academicYear}
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
