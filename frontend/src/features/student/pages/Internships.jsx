import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Loader from '@/components/common/Loader';
import ErrorMessage from '@/components/common/ErrorMessage';
import { studentAPI } from '../studentAPI';

function mapApiError(error) {
  return error?.response?.data?.message || 'Unable to load internships.';
}

const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const baseUrl = import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace('/api', '') : 'http://localhost:5000';
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

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

export default function Internships() {
  const SAVED_KEY = 'student.savedInternships';
  const [searchParams] = useSearchParams();
  const initialQuery = String(searchParams.get('q') || '').trim();
  const [internships, setInternships] = useState([]);
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState({ department: '', skills: [] });
  const [savedIds, setSavedIds] = useState([]);
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
  }, [debouncedQuery, filters, page]);

  // Reset page when filters or query change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filters]);

  useEffect(() => {
    if (debouncedQuery.length > 1) {
      const match = internships
        .map((i) => i.title)
        .filter((t) => t.toLowerCase().includes(debouncedQuery.toLowerCase()))
        .slice(0, 5);
      setSuggestions([...new Set(match)]);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [debouncedQuery, internships]);

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const appliedSet = useMemo(() => new Set(applications.map((app) => String(app.internshipId?._id || app.internshipId))), [applications]);

  const departmentFilter = String(profile.department || '').trim().toLowerCase();
  const filteredInternships = useMemo(() => {
    let result = internships;

    // 💾 Show Saved Only Filter
    if (showSavedOnly) {
       result = result.filter(item => savedSet.has(String(item._id)));
    }

    // 🏢 Backend now handles Major/Department filtering via the 'major' parameter in the API call.
    // Client-side filtering is no longer needed here to ensure consistency with pagination.

    // 🚀 Smart Sorting: Best Match (Client-Side Logic based on Skills)
    if (filters.sort === 'best-match') {
      const studentSkills = (profile.skills || []).map((value) => String(value).trim().toLowerCase()).filter(Boolean);
      const studentDept = String(profile.department || '').trim().toLowerCase();

      return [...result].sort((a, b) => {
        const calcScore = (internship) => {
          const required = (internship.requiredSkills || []).map((s) => String(s).trim().toLowerCase());
          let score = 0;
          
          // Skills Match (up to 40 points)
          studentSkills.forEach(skill => {
            if (required.some(req => req.includes(skill) || skill.includes(req))) score += 20;
          });
          score = Math.min(score, 40);

          // Department Match (up to 40 points)
          const targetDepts = (internship.targetDepartments || []).map(d => d.toLowerCase());
          if (studentDept && targetDepts.includes(studentDept)) {
            score += 40;
          } else {
            const text = [internship.title, internship.description].join(' ').toLowerCase();
            if (studentDept && text.includes(studentDept)) score += 20;
          }

          // CGPA Filter (If student CGPA < Min CGPA, penalize score)
          const studentCgpa = Number(profile.cgpa) || 0;
          const minCgpa = Number(internship.minCgpa) || 0;
          if (minCgpa > 0 && studentCgpa < minCgpa) {
            score -= 50; // Heavily penalize if CGPA doesn't meet requirements
          }

          return score;
        };
        return calcScore(b) - calcScore(a);
      });
    }

    return result;
  }, [departmentOnly, departmentFilter, internships, showSavedOnly, savedSet, filters.sort, profile.skills, profile.department]);

  const recommendationList = useMemo(() => {
    const studentSkills = (profile.skills || []).map((value) => String(value).trim().toLowerCase()).filter(Boolean);
    const studentDept = String(profile.department || '').trim().toLowerCase();

    // If no skills and no department are set, we cannot provide accurate recommendations.
    if (studentSkills.length === 0 && !studentDept) return [];

    return internships
      .map((internship) => {
        const required = (internship.requiredSkills || []).map((s) => String(s).trim().toLowerCase());
        
        let matchCount = 0;
        
        // Flexible skill matching
        if (required.length > 0) {
           required.forEach(reqSkill => {
              const isMatch = studentSkills.some(stuSkill => stuSkill.includes(reqSkill) || reqSkill.includes(stuSkill));
              if (isMatch) matchCount += 1;
           });
        }

        // Department matching
        let deptMatch = false;
        if (studentDept) {
           const internText = [
             internship.title,
             internship.description,
             internship.department
           ].join(' ').toLowerCase();
           if (internText.includes(studentDept)) deptMatch = true;
        }

        let score = 0;
        if (required.length > 0) {
           score = Math.round((matchCount / required.length) * 100);
        } else if (deptMatch) {
           score = 80; 
        }

        if (deptMatch && score > 0 && score < 100) {
           score = Math.min(100, score + 20);
        }

        return { internship, matchScore: score };
      })
      // Only return accurate matches (50% or above)
      .filter((item) => item.matchScore >= 50)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
  }, [internships, profile.skills, profile.department]);

  const toggleSave = async (internshipId) => {
    try {
      const { data } = await studentAPI.toggleSavedInternship(internshipId);
      setSavedIds(Array.isArray(data.savedIds) ? data.savedIds.map(String) : []);
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
      const matchScore = rec ? rec.matchScore : 0;

      await studentAPI.applyForInternship({ internshipId, matchScore });
      
      const appRes = await studentAPI.getApplications();
      setApplications(appRes.data || []);
      setActionMessage('Application submitted successfully!');
      setTimeout(() => setActionMessage(''), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit application.');
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
                  Applications: <span className="text-cyan-600">{applications.length}</span>
                </span>
                <button 
                  onClick={() => setShowSavedOnly(!showSavedOnly)}
                  className={`rounded-full px-5 py-2 text-[11px] font-black uppercase shadow-sm border transition-all flex items-center gap-2 ${showSavedOnly ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-white border-slate-100 text-slate-600 hover:border-cyan-200'}`}
                >
                  Saved Items: {savedIds.length}
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
            {recommendationList.map(({ internship, matchScore }) => (
              <div key={`rec-${internship._id}`} className="rounded-3xl border border-slate-50 bg-slate-50/50 p-5 hover:bg-white hover:shadow-xl hover:shadow-cyan-100/50 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-3">
                   <p className="text-sm font-black text-slate-900 line-clamp-1 group-hover:text-cyan-700 transition-colors">{internship.title}</p>
                   <span className="text-[10px] font-black text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-lg">{matchScore}%</span>
                </div>
                
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-4">
                   {internship.companyId?.name || internship.companyId?.fullName || 'Real World Partner'}
                </p>

                <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                   <div className="h-full bg-cyan-500 transition-all duration-1000" style={{ width: `${matchScore}%` }} />
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
          filteredInternships.map((internship) => {
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
                   <CompanyLogo company={internship.companyId} />
                </div>
                <div className="flex-1 min-w-0">
                   <h3 className="text-lg font-black leading-tight text-slate-900 group-hover:text-cyan-700 transition-colors truncate">{internship.title}</h3>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest truncate mt-1">
                      {internship.companyId?.name || internship.companyId?.fullName || 'Real World Partner'}
                   </p>
                </div>
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
                    <p className="text-sm font-black text-blue-600">{internship.workModality || 'On-site'}</p>
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
              <div className={`mb-6 flex items-center justify-between p-3 rounded-2xl transition-colors ${deadlineBgClass}`}>
                 <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dotColor} ${!isExpired && daysLeft <= 1 ? 'animate-pulse' : ''}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${deadlineColor}`}>
                       {deadlineText}
                    </span>
                 </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter ${internship.compensationType === 'Paid' ? 'bg-emerald-100 text-emerald-800' : internship.compensationType === 'Allowance' ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-600'}`}>
                     {internship.compensationType === 'Allowance' ? 'Covers Allowance' : (internship.compensationType || (internship.isPaid ? 'Paid' : 'Unpaid'))}
                  </span>
              </div>

              <div className="mt-auto flex items-center gap-3 relative z-10">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleApply(internshipId); }}
                  disabled={alreadyApplied || applyingId === internshipId || isExpired}
                  className={`flex-1 rounded-2xl py-4 text-xs font-black uppercase tracking-widest transition-all ${alreadyApplied || isExpired ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-cyan-700 shadow-lg shadow-slate-200'}`}
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
             onClick={() => { setShowSavedOnly(false); setQuery(''); setFilters({ location: '', isPaid: 'all', duration: 'all' }); }}
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
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Showing Page {page} of {totalPages} ({totalItems} Opportunities)
              </p>
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
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/80 px-8 py-6 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl border border-slate-100 overflow-hidden">
                  <CompanyLogo company={selectedInternship.companyId} />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">{selectedInternship.title}</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {selectedInternship.companyId?.name || selectedInternship.companyId?.fullName || 'Partner Company'}
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
            <div className="overflow-y-auto p-8 no-scrollbar" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              <div className="grid gap-8">
                {/* Description */}
                <section>
                  <h4 className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">Internship Overview</h4>
                  <p className="text-base leading-relaxed text-slate-600 whitespace-pre-wrap">
                    {selectedInternship.description}
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
                <div className="grid sm:grid-cols-2 gap-8">
                  <section>
                    <h4 className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">Requirements</h4>
                    <ul className="space-y-2">
                      {(selectedInternship.requirements || []).length > 0 ? selectedInternship.requirements.map((req, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600 font-medium">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan-500 shrink-0" />
                          {req}
                        </li>
                      )) : (
                        <li className="text-sm text-slate-400 italic">No specific requirements listed.</li>
                      )}
                    </ul>
                  </section>
                  <section>
                    <h4 className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">Technical Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedInternship.requiredSkills?.map((skill, i) => (
                        <span key={i} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 uppercase tracking-tighter">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 flex items-center gap-4 border-t border-slate-100 bg-white px-8 py-6">
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
