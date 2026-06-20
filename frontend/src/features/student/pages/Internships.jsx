import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Loader from '@/components/common/Loader';
import ErrorMessage from '@/components/common/ErrorMessage';
import { studentAPI } from '../studentAPI';
import useCompanyStatusSync from '@/hooks/useCompanyStatusSync';
import MatchScoreBadge from '@/features/student/components/MatchScoreBadge';
import {
  STUDENT_PROFILE_UPDATED_EVENT,
  STUDENT_PROFILE_UPDATED_STORAGE_KEY,
  STUDENT_STATS_REFRESH_EVENT,
  STUDENT_STATS_REFRESH_STORAGE_KEY,
  notifyStudentStatsRefresh
} from '@/utils/profileSync';

function mapApiError(error) {
  return error?.response?.data?.message || 'Unable to load internships.';
}

const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const baseUrl = import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace('/api', '') : 'http://localhost:5000';
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

const TYPO_FIXES = [
  [/\bract\b/gi, 'React'],
  [/\bclaud\b/gi, 'Cloud']
];

function cleanDisplayText(value = '') {
  let text = String(value || '').trim();
  TYPO_FIXES.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text;
}

function collectTechnicalSkills(internship = {}) {
  const sources = [
    internship?.requiredSkills,
    internship?.structuredRequirements?.coreTechnicalSkills,
    internship?.structuredRequirements?.preferredSkills,
    internship?.structuredRequirements?.softSkills,
    String(internship?.internship_requirements || internship?.description || '')
      .split(/[\n,;/]|\band\b/gi)
  ];

  return [...new Set(
    sources
      .flatMap((source) => (Array.isArray(source) ? source : [source]))
      .map((item) => cleanDisplayText(item))
      .map((item) => item.replace(/[\-•]+/g, ' ').trim())
      .filter(Boolean)
      .filter((item) => item.length >= 2)
      .slice(0, 10)
  )];
}

function CompanyLogo({ company, className = "w-full h-full" }) {
  const [error, setError] = useState(false);
  const name = company?.name || company?.fullName || 'Company';
  const initial = name.charAt(0).toUpperCase();
  const imageUrl = getImageUrl(company?.profileImage || company?.logo);

  if (!imageUrl || error) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-black text-xl w-full h-full`}>
        {initial}
      </div>
    );
  }

  return (
    <img 
      src={imageUrl} 
      alt={`${name} Logo`} 
      className={`object-cover ${className}`}
      onError={() => setError(true)}
    />
  );
}

function resolveCompanyForInternship(internship = {}) {
  const logoUrl = internship.company_logo_url || internship.companyId?.profileImage || internship.companyId?.logo;
  const companyName = internship.company_name || internship.companyId?.name || internship.companyId?.fullName || 'Real World Partner';
  return {
    name: companyName,
    fullName: companyName,
    profileImage: logoUrl,
    logo: logoUrl
  };
}

function DynamicDeadlineCountdown({ deadline, compensationType, isPaid }) {
  const [timeLeft, setTimeLeft] = React.useState(null);

  React.useEffect(() => {
    if (!deadline) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(deadline).getTime();
      const difference = target - now;

      if (difference <= 0) {
        return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      return { expired: false, days, hours, minutes, seconds };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  const compensationLabel = compensationType === 'Allowance' 
    ? 'Covers Allowance' 
    : (compensationType || (isPaid ? 'Paid' : 'Unpaid'));

  const compBadgeClass = compensationType === 'Paid' 
    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
    : compensationType === 'Allowance' 
    ? 'bg-sky-100 text-sky-800 border border-sky-200' 
    : 'bg-slate-100 text-slate-600 border border-slate-200';

  if (!deadline) {
    return (
      <div className="mb-6 flex items-center justify-between p-4 rounded-3xl bg-emerald-50/50 border border-emerald-100/50 shadow-sm shadow-emerald-50/10">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
            No Deadline
          </span>
        </div>
        <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${compBadgeClass}`}>
          {compensationLabel}
        </span>
      </div>
    );
  }

  if (!timeLeft) return null;

  if (timeLeft.expired) {
    return (
      <div className="mb-6 flex items-center justify-between p-4 rounded-3xl bg-slate-50 border border-slate-200/50 shadow-inner">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Application Closed
          </span>
        </div>
        <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${compBadgeClass}`}>
          {compensationLabel}
        </span>
      </div>
    );
  }

  const isUrgent = timeLeft.days < 3;

  return (
    <div className={`mb-6 flex flex-col p-5 rounded-[2rem] border transition-all ${
      isUrgent 
        ? 'bg-gradient-to-br from-rose-50/80 to-rose-50/40 border-rose-200 shadow-lg shadow-rose-50/50' 
        : 'bg-gradient-to-br from-cyan-50/50 to-cyan-50/20 border-cyan-150 shadow-lg shadow-cyan-50/50'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${isUrgent ? 'bg-rose-600 animate-ping' : 'bg-cyan-600 animate-pulse'}`} />
          <span className={`text-[10px] font-black uppercase tracking-widest ${isUrgent ? 'text-rose-700' : 'text-cyan-700'}`}>
            {isUrgent ? '⚠️ Closing Soon!' : '⏳ Application Countdown'}
          </span>
        </div>
        <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ${compBadgeClass}`}>
          {compensationLabel}
        </span>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <div className="relative h-11 w-11 shrink-0 flex items-center justify-center rounded-full bg-white shadow-md border border-slate-100 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 via-pink-500 to-amber-400 animate-spin opacity-90" />
          <div className="absolute inset-[3px] rounded-full bg-white flex items-center justify-center z-10 shadow-inner">
            <span className="text-base font-black text-slate-800">⏳</span>
          </div>
        </div>

        <div className="flex items-baseline gap-1">
          {timeLeft.days > 0 && (
            <>
              <span className={`text-2xl font-black tracking-tight leading-none ${isUrgent ? 'text-rose-700' : 'text-slate-900'}`}>
                {timeLeft.days}
              </span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">
                {timeLeft.days === 1 ? 'day' : 'days'}
              </span>
            </>
          )}
          <span className={`text-2xl font-black tracking-tight leading-none ${isUrgent ? 'text-rose-700' : 'text-slate-900'}`}>
            {String(timeLeft.hours).padStart(2, '0')}
          </span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">h</span>

          <span className={`text-2xl font-black tracking-tight leading-none ${isUrgent ? 'text-rose-700' : 'text-slate-900'}`}>
            {String(timeLeft.minutes).padStart(2, '0')}
          </span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">m</span>

          <span className={`text-2xl font-black tracking-tight leading-none ${isUrgent ? 'text-rose-600 animate-pulse' : 'text-cyan-600'}`}>
            {String(timeLeft.seconds).padStart(2, '0')}
          </span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">s</span>
        </div>
      </div>
    </div>
  );
}

export default function Internships() {
  const SAVED_KEY = 'student.savedInternships';
  const [searchParams] = useSearchParams();
  const initialQuery = String(searchParams.get('q') || '').trim();
  const [internships, setInternships] = useState([]);
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState({ department: '', skills: [] });
  const [savedIds, setSavedIds] = useState([]);
  const [savedCount, setSavedCount] = useState(0);
  const [applicationCount, setApplicationCount] = useState(0);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [departmentOnly, setDepartmentOnly] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [applyingId, setApplyingId] = useState('');
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [filters, setFilters] = useState({ location: '', isPaid: 'all', duration: 'all', sort: 'newest', major: '' });
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [dynamicFilters, setDynamicFilters] = useState({ departments: [], locations: [], durations: [] });

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const { data } = await studentAPI.getFilters();
        setDynamicFilters(data);
      } catch (err) {
        console.warn("Dynamic filters load failed", err);
      }
    };
    loadFilters();
  }, []);

  const refreshStudentCounts = async (shouldUpdate = () => true) => {
    try {
      const [statsRes, savedRes] = await Promise.all([
        studentAPI.getDashboardStats(),
        studentAPI.getSavedInternships()
      ]);

      if (!shouldUpdate()) return;
      setApplicationCount(statsRes.data?.totalApplications || 0);
      setSavedCount(statsRes.data?.totalSaved || 0);

      const savedItems = Array.isArray(savedRes.data) ? savedRes.data : [];
      const savedIdsFromServer = savedItems
        .map((item) => {
          if (!item) return '';
          if (typeof item === 'string' || typeof item === 'number') return String(item);
          if (item._id) return String(item._id);
          if (item.internshipId) return String(item.internshipId._id || item.internshipId);
          return '';
        })
        .filter(Boolean);

      if (!shouldUpdate()) return;
      setSavedIds(savedIdsFromServer);
    } catch (err) {
      console.warn('Failed to refresh student internship counts', err);
    }
  };

  useEffect(() => {
    let active = true;
    const shouldUpdate = () => active;
    const loadCounts = async () => {
      if (!active) return;
      await refreshStudentCounts(shouldUpdate);
    };
    loadCounts();
    const handleStatsRefresh = () => {
      if (!active) return;
      refreshStudentCounts(shouldUpdate);
    };
    window.addEventListener(STUDENT_STATS_REFRESH_EVENT, handleStatsRefresh);
    return () => {
      active = false;
      window.removeEventListener(STUDENT_STATS_REFRESH_EVENT, handleStatsRefresh);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchInternships = async () => {
      try {
        setLoading(true);
        
        // Fetch internships with pagination
        const internshipRes = await studentAPI.getInternships({ 
          q: debouncedQuery, 
          page,
          limit: 12,
          ...filters 
        });

        if (active) {
          const data = internshipRes.data;
          console.log(`🔍 Fetching internships with sort: ${filters.sort}`, data.items);
          if (data && data.items) {
            setInternships(data.items);
            setTotalPages(data.totalPages || 1);
            setTotalItems(data.total || 0);
          } else {
            setInternships(Array.isArray(data) ? data : []);
            setTotalPages(1);
            setTotalItems(Array.isArray(data) ? data.length : 0);
          }
          setError('');
        }

        // Fetch secondary data (only once or when profile might change)
        try {
           const [applicationRes, profileRes] = await Promise.all([
             studentAPI.getApplications(),
             studentAPI.getProfile()
           ]);
           if (active) {
             setApplications(applicationRes.data || []);
             setProfile(profileRes.data?.profile || {});
           }
        } catch (secondaryErr) {
           console.warn("Secondary data load failed", secondaryErr);
        }
      } catch (err) {
        if (active) {
          setError(mapApiError(err));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchInternships();
    return () => { active = false; };
  }, [debouncedQuery, filters, page, refreshKey]);

  // Listen for company status changes and refresh listing when they happen
  useCompanyStatusSync(() => {
    setRefreshKey((k) => k + 1);
  });

  useEffect(() => {
    const handleProfileUpdate = () => {
      setRefreshKey((k) => k + 1);
    };

    const handleStorageUpdate = (event) => {
      if (event.key === STUDENT_PROFILE_UPDATED_STORAGE_KEY) {
        handleProfileUpdate();
      }
      if (event.key === STUDENT_STATS_REFRESH_STORAGE_KEY) {
        refreshStudentCounts(() => true);
      }
    };

    return () => {
      window.removeEventListener(STUDENT_PROFILE_UPDATED_EVENT, handleProfileUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  // Reset page when filters or query change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filters]);

  useEffect(() => {
    let active = true;

    const loadSuggestions = async () => {
      if (debouncedQuery.length <= 1) {
        if (active) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
        return;
      }

      try {
        const { data } = await studentAPI.getInternshipSuggestions(debouncedQuery);
        if (!active) return;

        setSuggestions(
          Array.isArray(data)
            ? [...new Set(data.map((item) => item?.title).filter(Boolean))].slice(0, 5)
            : []
        );
        setShowSuggestions(true);
      } catch {
        if (active) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    };

    loadSuggestions();

    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const appliedSet = useMemo(() => new Set(applications.map((app) => String(app.internshipId?._id || app.internshipId))), [applications]);

  const scoredInternships = useMemo(() => {
    return internships.map((internship) => ({
      internship,
      match: {
        score: Number(internship?.matchScore || internship?.aiMatchScore || internship?.matchingScore || 0),
        reasoning: internship?.matchReasoning || internship?.reasoning || ''
      }
    }));
  }, [internships]);

  const departmentFilter = String(profile.department || '').trim().toLowerCase();
  const filteredInternships = useMemo(() => {
    let result = scoredInternships;

    // 💾 Show Saved Only Filter
    if (showSavedOnly) {
       result = result.filter(({ internship }) => savedSet.has(String(internship._id)));
    }

    // 🏢 Backend now handles Major/Department filtering via the 'major' parameter in the API call.
    // Client-side filtering is no longer needed here to ensure consistency with pagination.

    // 🚀 Smart Sorting: Best Match (Client-Side Logic based on Skills)
    if (filters.sort === 'best-match') {
      return [...result].sort((a, b) => b.match.score - a.match.score);
    }

    return result;
  }, [departmentOnly, departmentFilter, scoredInternships, showSavedOnly, savedSet, filters.sort]);

  const recommendationList = useMemo(() => {
    return scoredInternships
      .filter((item) => item.match.score >= 50)
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 3);
  }, [scoredInternships]);

  const toggleSave = async (internshipId) => {
    try {
      const { data } = await studentAPI.toggleSavedInternship(internshipId);
      notifyStudentStatsRefresh();
      const ids = Array.isArray(data.savedIds) ? data.savedIds.map(String) : [];
      setSavedIds(ids);
      setSavedCount(ids.length);
      setActionMessage(data.message);
      setTimeout(() => setActionMessage(''), 3000);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "Unknown error";
      setError(`Failed to sync saved items: ${msg}`);
    }
  };

  const handleApply = async (internshipId) => {
    try {
      setApplyingId(internshipId);
      
      // Pass the match score to the backend if found
      const rec = recommendationList.find(r => String(r.internship._id) === String(internshipId));
      const matchScore = rec ? rec.score : 0;

      const { data } = await studentAPI.applyForInternship({ internshipId, matchScore });
      notifyStudentStatsRefresh();
      await refreshStudentCounts();

      const submittedApplication = data?.application || null;
      if (submittedApplication) {
        setApplications((current) => {
          const nextApplications = Array.isArray(current) ? current.filter((app) => String(app?._id || '') !== String(submittedApplication._id || '')) : [];
          return [submittedApplication, ...nextApplications];
        });
      }

      setActionMessage(data?.message || 'Application submitted successfully!');
      setTimeout(() => setActionMessage(''), 3000);
    } catch (err) {
      const responseMessage = err?.response?.data?.message;
      const rawResponse = typeof err?.response?.data === 'string' ? err.response.data : '';
      setError(responseMessage || rawResponse || err?.message || 'Failed to submit application.');
    } finally {
      setApplyingId('');
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  if (loading && internships.length === 0) return <Loader />;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* 💎 Cyan Hero Section */}
      <div className="px-6 lg:px-10 pt-10 mb-8">
        <div className="bg-gradient-to-br from-cyan-50/50 to-sky-50/50 rounded-[40px] p-10 relative overflow-hidden border border-cyan-100/50">
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 mb-2">OPPORTUNITY HUB</p>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Discover Opportunities</h2>
                <p className="text-slate-500 mt-2 font-medium max-w-lg">Find the perfect internship tailored to your skills and career goals in real time.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white px-5 py-2 text-[11px] font-black text-slate-600 shadow-sm border border-slate-100">
                  Applications: <span className="text-cyan-600">{applicationCount}</span>
                </span>
                <button 
                  onClick={() => setShowSavedOnly(!showSavedOnly)}
                  className={`rounded-full px-5 py-2 text-[11px] font-black uppercase shadow-sm border transition-all flex items-center gap-2 ${showSavedOnly ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-white border-slate-100 text-slate-600 hover:border-cyan-200'}`}
                >
                  Saved Items: {savedCount}
                </button>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        </div>
      </div>

      {/* 🔍 Search & Filter Row */}
      <div className="px-6 lg:px-10 space-y-8">
        {/* Large Search Bar */}
        <div className="flex justify-center -mt-14 relative z-20">
          <div className="w-full max-w-4xl relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600/20 to-sky-600/20 rounded-full opacity-0 blur group-focus-within:opacity-100 transition duration-500" />
            <div className="relative flex items-center bg-white rounded-full shadow-xl shadow-cyan-100/40 border border-slate-100">
              <svg className="absolute left-6 h-6 w-6 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by role, company, or technology..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                className="w-full bg-transparent py-7 pl-16 pr-8 text-lg text-slate-900 outline-none placeholder:text-slate-400 font-medium"
              />
              <button 
                onClick={() => setDebouncedQuery(query)}
                className="mr-3 bg-slate-900 hover:bg-cyan-700 text-white px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest transition-all active:scale-95"
              >
                Search
              </button>

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white shadow-2xl rounded-3xl mt-4 z-50 overflow-hidden border border-slate-100">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setQuery(s); setDebouncedQuery(s); setShowSuggestions(false); }}
                      className="w-full text-left px-6 py-4 hover:bg-cyan-50 text-slate-700 font-bold border-b border-slate-50 last:border-0 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3 px-4 justify-center">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mr-2">FILTER BY</span>
          
          <select
            name="major"
            value={filters.major}
            onChange={handleFilterChange}
            className="appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-5 pr-10 text-xs font-bold text-slate-600 shadow-sm transition hover:border-cyan-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Majors</option>
            {dynamicFilters.departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <select 
            name="location"
            value={filters.location}
            onChange={handleFilterChange}
            className="appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-5 pr-10 text-xs font-bold text-slate-600 shadow-sm transition hover:border-cyan-300 focus:outline-none cursor-pointer"
          >
            <option value="">Any Location</option>
            {dynamicFilters.locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          <select 
            name="isPaid"
            value={filters.isPaid}
            onChange={handleFilterChange}
            className="appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-5 pr-10 text-xs font-bold text-slate-600 shadow-sm transition hover:border-cyan-300 focus:outline-none cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="true">Paid Only</option>
            <option value="false">Unpaid Only</option>
          </select>

          <select 
            name="duration"
            value={filters.duration}
            onChange={handleFilterChange}
            className="appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-5 pr-10 text-xs font-bold text-slate-600 shadow-sm transition hover:border-cyan-300 focus:outline-none cursor-pointer"
          >
            <option value="all">Any Duration</option>
            {dynamicFilters.durations.map(dur => (
              <option key={dur} value={dur}>{dur}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 📊 Content Area */}
      <div className="w-full mx-auto px-4 lg:px-8 mt-12 space-y-12">
        {error && <ErrorMessage message={error} />}
        {actionMessage && (
          <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl font-bold shadow-lg animate-bounce flex items-center gap-3">
             <span className="text-xl">✅</span> {actionMessage}
          </div>
        )}

      {recommendationList.length > 0 ? (
        <section className="rounded-[2.5rem] border border-cyan-100 bg-white p-6 shadow-[0_20px_40px_rgba(6,182,212,0.06)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50 rounded-full -mr-16 -mt-16 opacity-50" />
          
          <div className="flex items-center gap-2 mb-6 relative z-10">
             <div className="w-2 h-2 bg-cyan-500 rounded-full animate-ping" />
             <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">AI-Powered Recommendations</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3 relative z-10">
            {recommendationList.map(({ internship, match }) => (
              <div key={`rec-${internship._id}`} className="rounded-3xl border border-slate-50 bg-slate-50/50 p-5 hover:bg-white hover:shadow-xl hover:shadow-cyan-100/50 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-3">
                   <p className="text-sm font-black text-slate-900 line-clamp-1 group-hover:text-cyan-700 transition-colors">{internship.title}</p>
                   <span className="text-[10px] font-black text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-lg">{match.score}%</span>
                </div>
                
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-4">
                   {internship.companyId?.name || internship.companyId?.fullName || 'Real World Partner'}
                </p>

                <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                   <div className="h-full bg-cyan-500 transition-all duration-1000" style={{ width: `${match.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

        <div className="flex items-center justify-between">
           <h2 className="text-2xl font-black text-slate-900">{showSavedOnly ? 'Your Saved Items' : 'All Internships'}</h2>
           <div className="flex items-center gap-4">
              <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Sort by:</span>
              <select
                name="sort"
                value={filters.sort}
                onChange={handleFilterChange}
                className="bg-white text-slate-900 px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest border-2 border-slate-100 outline-none cursor-pointer hover:border-cyan-500 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-50 transition-all shadow-sm appearance-none min-w-[240px]"
              >
                <option value="newest">NEWEST</option>
                <option value="deadline">DEADLINE APPROACHING</option>
                <option value="best-match">BEST MATCH (SMART MATCH) 🤖</option>
                <option value="alphabetical">A - Z (ALPHABETICAL)</option>
                <option value="seats">MOST SEATS (HIGH QUOTA)</option>
              </select>
           </div>
        </div>

        <div className="w-full mx-auto mt-12 px-4 lg:px-0">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {filteredInternships.length > 0 ? (
          filteredInternships.map(({ internship, match }) => {
          const internshipId = String(internship._id);
          const alreadyApplied = appliedSet.has(internshipId);
          const isSaved = savedSet.has(internshipId);
          const skills = Array.isArray(internship?.requiredSkills) ? internship.requiredSkills.filter(Boolean) : [];
          
          // 🕒 Real-Time Database Connection: Deadline & Timeline
          const startDate = internship?.startDate ? new Date(internship.startDate) : null;
          const endDate = internship?.endDate ? new Date(internship.endDate) : null;
          const deadlineDate = internship?.deadline ? new Date(internship.deadline) : null;
          
          const now = new Date();
          // Reset hours to compare dates only
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const target = deadlineDate ? new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate()) : null;
          
          const diffTime = target ? target - today : null;
          const daysLeft = diffTime !== null ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : null;
          
          let deadlineText = '';
          let deadlineColor = 'text-emerald-600';
          let deadlineBgClass = 'bg-emerald-50';
          let dotColor = 'bg-emerald-500';
          let isExpired = false;

          if (daysLeft === null) {
             deadlineText = 'No Deadline';
          } else if (daysLeft < 0) {
             deadlineText = 'Application Closed';
             deadlineColor = 'text-slate-400';
             deadlineBgClass = 'bg-slate-50';
             dotColor = 'bg-slate-300';
             isExpired = true;
          } else if (daysLeft === 0) {
             deadlineText = '⚠️ Ends Today!';
             deadlineColor = 'text-red-600 font-black animate-pulse';
             deadlineBgClass = 'bg-red-50 border border-red-100';
             dotColor = 'bg-red-500';
          } else if (daysLeft === 1) {
             deadlineText = '⚠️ Ends Tomorrow!';
             deadlineColor = 'text-red-600 font-black';
             deadlineBgClass = 'bg-red-50 border border-red-100';
             dotColor = 'bg-red-500';
          } else if (daysLeft <= 30) {
             deadlineText = `⚠️ Deadline: Ends in ${daysLeft} days`;
             deadlineColor = 'text-red-600 font-black';
             deadlineBgClass = 'bg-red-50 border border-red-100';
             dotColor = 'bg-red-500';
          } else {
             deadlineText = `Deadline: ${deadlineDate?.toLocaleDateString()}`;
             deadlineColor = 'text-slate-600 font-bold';
             deadlineBgClass = 'bg-slate-50 border border-slate-100';
             dotColor = 'bg-blue-500';
          }

          return (
            <article 
              key={internshipId} 
              onClick={() => setSelectedInternship(internship)}
              className="rounded-[2.5rem] border border-slate-100 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.04)] hover:shadow-[0_30px_60px_rgba(15,23,42,0.08)] transition-all group relative overflow-hidden flex flex-col cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
              
              {/* 🏢 Header: Logo & Title */}
              <div className="flex items-start gap-4 mb-6 relative z-10">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-slate-100 group-hover:border-cyan-200 transition-colors shrink-0 overflow-hidden">
                   <CompanyLogo company={resolveCompanyForInternship(internship)} />
                </div>
                <div className="flex-1 min-w-0">
                   <h3 className="text-lg font-black leading-tight text-slate-900 group-hover:text-cyan-700 transition-colors truncate">{internship.internship_title || internship.title}</h3>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest truncate mt-1">
                      {internship.company_name || internship.companyId?.name || internship.companyId?.fullName || 'Real World Partner'}
                   </p>
                </div>
              </div>

                <div className="relative z-10 mb-6">
                 <MatchScoreBadge score={match.score} reasoning={match.reasoning} />
                </div>

              {/* 🏷️ Skill Tags */}
              <div className="flex flex-wrap gap-2 mb-6 relative z-10">
                 {skills.slice(0, 3).map((skill) => (
                    <span key={`${internshipId}-${skill}`} className="px-3 py-1 bg-cyan-50 text-cyan-700 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                       {skill}
                    </span>
                 ))}
                 {skills.length > 3 && <span className="text-[10px] font-bold text-slate-300">+{skills.length - 3} more</span>}
              </div>

              {/* 📊 Quota & Timeline Matrix */}
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 relative z-10">
                 <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Quota (Seats)</p>
                    <div className="flex items-center gap-1.5">
                       <span className="text-sm font-black text-slate-900">{internship.studentsNeeded || 0} Students</span>
                    </div>
                 </div>
                 <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Modality</p>
                    <p className="text-sm font-black text-blue-600">{internship.modality || internship.workModality || 'On-site'}</p>
                 </div>
                 <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Location</p>
                    <p className="text-sm font-black text-slate-700">{internship.location || 'Addis Ababa'}</p>
                 </div>
                 <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Duration</p>
                    <p className="text-sm font-black text-emerald-600">{internship.duration || 'Flexible'}</p>
                 </div>
                 <div className="col-span-2 pt-2 border-t border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Timeline</p>
                    <p className="text-xs font-bold text-slate-600">
                       {startDate?.toLocaleDateString()} — {endDate?.toLocaleDateString()}
                    </p>
                 </div>
                 {internship.minCgpa > 0 && (
                   <div className="col-span-2 pt-1">
                     <p className="text-[9px] font-black text-rose-500 uppercase">Min CGPA Required: {internship.minCgpa}</p>
                   </div>
                 )}
              </div>

              {/* ⏳ Real-Time Deadline Alert (Enhanced Warning) */}
              <DynamicDeadlineCountdown 
                deadline={internship.deadline} 
                compensationType={internship.compensationType} 
                isPaid={internship.isPaid} 
              />

              <div className="mt-auto flex items-center gap-3 relative z-10">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleApply(internshipId); }}
                  disabled={alreadyApplied || applyingId === internshipId || isExpired}
                  className={`flex-1 rounded-2xl py-4 text-xs font-black uppercase tracking-widest transition-all ${alreadyApplied || isExpired
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-cyan-600 text-white hover:bg-emerald-500 shadow-lg shadow-cyan-200'}
                  `}
                >
                  {isExpired ? 'Closed' : alreadyApplied ? 'Applied' : applyingId === internshipId ? 'Applying...' : 'Apply Now'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleSave(internshipId); }}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border ${isSaved ? 'bg-brand-50 border-brand-200 text-brand-600' : 'bg-white border-slate-100 text-slate-400 hover:border-brand-200 hover:text-brand-600'}`}
                >
                  <svg className="w-5 h-5" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </article>
          );
        })
      ) : (
        <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
           <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🔍</span>
           </div>
           <h3 className="text-xl font-black text-slate-900 mb-2">No Internships Found</h3>
           <p className="text-slate-500 font-medium mb-8">
              {showSavedOnly ? "You haven't saved any internships yet." : "Try adjusting your search or filters to find more roles."}
           </p>
           <button 
             onClick={() => { setShowSavedOnly(false); setQuery(''); setDebouncedQuery(''); setFilters({ location: '', isPaid: 'all', duration: 'all', sort: 'newest', major: '' }); }}
             className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-cyan-700 transition-all shadow-lg"
           >
              View All Internships
           </button>
        </div>
      )}
          </div>
          
          {/* 📄 Professional Pagination UI */}
          {!showSavedOnly && totalPages > 1 && (
            <div className="mt-16 flex flex-col items-center gap-6 pb-20">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${page === 1 ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-900 hover:text-slate-900 shadow-sm'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>

                <div className="flex items-center gap-2 px-2">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    // Only show first, last, and pages around current page
                    if (pageNum === 1 || pageNum === totalPages || (pageNum >= page - 1 && pageNum <= page + 1)) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all ${page === pageNum ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-900 hover:text-slate-900'}`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (pageNum === page - 2 || pageNum === page + 2) {
                      return <span key={pageNum} className="text-slate-300">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${page === totalPages ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-900 hover:text-slate-900 shadow-sm'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
              {/* Removed 'Showing Page x of y (z Opportunities)' text */}
            </div>
          )}
        </div>

      {/* 💎 Premium Internship Detail Modal */}
      {selectedInternship && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setSelectedInternship(null)}
          />
          <div className="relative flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            {/* Modal Header */}
            <div className="shrink-0 sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/90 px-8 py-6 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl border border-slate-100 overflow-hidden">
                  <CompanyLogo company={resolveCompanyForInternship(selectedInternship)} />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">{selectedInternship.internship_title || selectedInternship.title}</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {selectedInternship.company_name || selectedInternship.companyId?.name || selectedInternship.companyId?.fullName || 'Partner Company'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedInternship(null)}
                className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Body */}
            <div
              className="min-h-0 flex-1 overflow-y-auto px-8 py-8 pb-24 [scrollbar-width:thin] [scrollbar-color:#0ea5e9_#e2e8f0]"
              style={{ maxHeight: 'calc(80vh - 176px)' }}
            >
              <div className="grid gap-8">
                {/* 🕒 Real-Time Countdown Banner */}
                <DynamicDeadlineCountdown 
                  deadline={selectedInternship.deadline} 
                  compensationType={selectedInternship.compensationType} 
                  isPaid={selectedInternship.isPaid} 
                />

                {/* Description */}
                <section>
                  <h4 className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">Internship Overview</h4>
                  <p className="text-base leading-relaxed text-slate-600 whitespace-pre-wrap">
                    {cleanDisplayText(selectedInternship.description) || 'No description provided by the organization.'}
                  </p>
                </section>

                {/* Key Facts */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Duration</p>
                    <p className="text-sm font-black text-slate-900">{selectedInternship.duration || 'Flexible'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Modality</p>
                    <p className="text-sm font-black text-blue-600">{selectedInternship.workModality}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Compensation</p>
                    <p className="text-sm font-black text-emerald-600">{selectedInternship.compensationType}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Min CGPA</p>
                    <p className="text-sm font-black text-rose-600">{selectedInternship.minCgpa || 'No Minimum'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Target Batch</p>
                    <p className="text-sm font-black text-slate-900">{selectedInternship.targetBatch}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Location</p>
                    <p className="text-sm font-black text-slate-900">{selectedInternship.location}</p>
                  </div>
                </div>

                {/* Requirements & Skills */}
                <div className="grid gap-8 sm:grid-cols-2 pb-6">
                  <section>
                    <h4 className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">Detailed Requirements</h4>
                    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                      <p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">
                        {cleanDisplayText(selectedInternship.internship_requirements || selectedInternship.description || '') || 'No additional requirements specified by the organization.'}
                      </p>
                    </div>
                  </section>
                  <section>
                    <h4 className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">Technical Skills</h4>
                    <div className="flex flex-wrap gap-2 rounded-3xl border border-slate-100 bg-white p-4">
                      {collectTechnicalSkills(selectedInternship).length > 0 ? collectTechnicalSkills(selectedInternship).map((skill, i) => (
                        <span key={`${skill}-${i}`} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 uppercase tracking-tighter">
                          {skill}
                        </span>
                      )) : (
                        <p className="text-sm text-slate-400 italic">No additional requirements specified by the organization.</p>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 sticky bottom-0 z-20 flex items-center gap-4 border-t border-slate-100 bg-gradient-to-t from-white via-white to-white/90 px-8 py-6 backdrop-blur-sm">
              <button
                onClick={() => setSelectedInternship(null)}
                className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleApply(selectedInternship._id);
                  setSelectedInternship(null);
                }}
                disabled={appliedSet.has(String(selectedInternship._id)) || applyingId === String(selectedInternship._id)}
                className={`flex-1 rounded-2xl py-4 text-sm font-black uppercase tracking-widest transition-all shadow-xl ${appliedSet.has(String(selectedInternship._id)) ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' : 'bg-slate-900 text-white hover:bg-cyan-700 shadow-cyan-100'}`}
              >
                {appliedSet.has(String(selectedInternship._id)) ? 'Already Applied' : 'Confirm & Apply Now'}
              </button>
            </div>
          </div>
        </div>
      )}
        </div> {/* end .max-w-7xl ... main content area */}
    </div>
  );
}
