import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Loader from '@/components/common/Loader';
import ErrorMessage from '@/components/common/ErrorMessage';
import { studentAPI } from '../studentAPI';

function mapApiError(error) {
  return error?.response?.data?.message || 'Unable to load internships.';
}

export default function Internships() {
  const SAVED_KEY = 'student.savedInternships';
  const [searchParams] = useSearchParams();
  const initialQuery = String(searchParams.get('q') || '').trim();
  const [internships, setInternships] = useState([]);
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState({ department: '', skills: [] });
  const [savedIds, setSavedIds] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [departmentOnly, setDepartmentOnly] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [applyingId, setApplyingId] = useState('');

  useEffect(() => {
    const nextQuery = String(searchParams.get('q') || '').trim();
    setQuery((prev) => (prev === nextQuery ? prev : nextQuery));
    setDebouncedQuery((prev) => (prev === nextQuery ? prev : nextQuery));
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 280);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds));
  }, [savedIds]);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const { data } = await studentAPI.getProfile();
        if (!active) return;
        const nextProfile = data?.profile || {};
        setProfile({
          department: String(nextProfile.department || '').trim(),
          skills: Array.isArray(nextProfile.skills) ? nextProfile.skills : []
        });
      } catch {
        if (!active) return;
        setProfile({ department: '', skills: [] });
      }
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [internshipsRes, applicationsRes] = await Promise.all([
          studentAPI.getInternships({ q: debouncedQuery || undefined, status: 'Open', limit: 50 }),
          studentAPI.getApplications()
        ]);

        if (!active) return;

        setInternships(Array.isArray(internshipsRes.data) ? internshipsRes.data : []);
        setApplications(Array.isArray(applicationsRes.data) ? applicationsRes.data : []);
      } catch (requestError) {
        if (active) setError(mapApiError(requestError));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    let active = true;

    const loadSuggestions = async () => {
      if (!debouncedQuery) {
        setSuggestions([]);
        return;
      }

      try {
        const { data } = await studentAPI.getInternshipSuggestions(debouncedQuery);
        if (!active) return;
        setSuggestions(Array.isArray(data) ? data : []);
      } catch {
        if (!active) return;
        setSuggestions([]);
      }
    };

    loadSuggestions();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  const appliedIds = useMemo(
    () => new Set(applications.map((app) => String(app?.internshipId?._id || app?.internshipId || ''))),
    [applications]
  );

  const savedSet = useMemo(() => new Set(savedIds.map((id) => String(id))), [savedIds]);

  const departmentFilter = String(profile.department || '').trim().toLowerCase();
  const filteredInternships = useMemo(() => {
    if (!departmentOnly || !departmentFilter) return internships;

    return internships.filter((internship) => {
      const text = [
        internship?.title,
        internship?.description,
        internship?.location,
        internship?.duration,
        ...(Array.isArray(internship?.requirements) ? internship.requirements : []),
        ...(Array.isArray(internship?.requiredSkills) ? internship.requiredSkills : [])
      ].join(' ').toLowerCase();
      return text.includes(departmentFilter);
    });
  }, [departmentOnly, departmentFilter, internships]);

  const recommendationList = useMemo(() => {
    const skillSet = new Set((profile.skills || []).map((value) => String(value).trim().toLowerCase()).filter(Boolean));
    if (skillSet.size === 0) return [];

    return internships
      .map((internship) => {
        const required = Array.isArray(internship?.requiredSkills) ? internship.requiredSkills : [];
        const normalizedRequired = required.map((value) => String(value).trim().toLowerCase()).filter(Boolean);
        const overlap = normalizedRequired.filter((skill) => skillSet.has(skill)).length;
        const matchScore = normalizedRequired.length ? Math.round((overlap / normalizedRequired.length) * 100) : 0;
        return { internship, matchScore, overlap };
      })
      .filter((item) => item.overlap > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
  }, [internships, profile.skills]);

  const toggleSave = (internshipId) => {
    setSavedIds((prev) => {
      const key = String(internshipId || '');
      if (!key) return prev;
      return prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key];
    });
  };

  const handleApply = async (internshipId) => {
    try {
      setApplyingId(internshipId);
      setError('');
      setActionMessage('');

      const { data } = await studentAPI.applyInternship({ internshipId });
      setActionMessage(data?.message || 'Application submitted successfully.');

      const refreshedApplications = await studentAPI.getApplications();
      setApplications(Array.isArray(refreshedApplications.data) ? refreshedApplications.data : []);
    } catch (requestError) {
      setError(mapApiError(requestError));
    } finally {
      setApplyingId('');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-cyan-100 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.16),transparent_40%),linear-gradient(180deg,#f0fdff_0%,#ffffff_60%)] p-6 shadow-[0_20px_60px_rgba(8,145,178,0.12)] lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Opportunity Board</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Internships</h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-slate-600">Browse active internships from the real backend feed and apply directly from each card.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-cyan-100 bg-white px-4 py-2 text-sm text-slate-600">
              Open roles: <span className="font-semibold text-slate-900">{filteredInternships.length}</span>
            </span>
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              Applied: <span className="font-semibold">{applications.length}</span>
            </span>
            <span className="rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-700">
              Saved: <span className="font-semibold">{savedIds.length}</span>
            </span>
          </div>
        </div>

        <div className="relative mt-5 max-w-2xl">
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search by title, skill, location..."
            className="w-full rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />

          {showSuggestions && suggestions.length > 0 ? (
            <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setQuery(item.title || '');
                    setShowSuggestions(false);
                  }}
                  className="block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                >
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.subtitle || 'Open internship'}</p>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!departmentFilter}
            onClick={() => setDepartmentOnly((value) => !value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${departmentOnly ? 'bg-cyan-700 text-white shadow-sm' : 'border border-cyan-200 bg-white text-cyan-700'} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {departmentFilter ? `Filter: ${profile.department}` : 'Add department in profile to enable filter'}
          </button>
          {departmentOnly ? <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Department filter active</span> : null}
        </div>
      </section>

      {recommendationList.length > 0 ? (
        <section className="rounded-3xl border border-cyan-100 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Recommended for your skills</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {recommendationList.map(({ internship, matchScore }) => (
              <div key={`rec-${internship._id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900 line-clamp-2">{internship.title}</p>
                <p className="mt-1 text-xs text-slate-500">{internship.location || 'Open role'}</p>
                <span className="mt-3 inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">{matchScore}% match</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {loading ? <Loader label="Loading internships" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {actionMessage ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{actionMessage}</p> : null}

      {!loading && filteredInternships.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-500">
          {debouncedQuery ? `No results found for "${debouncedQuery}".` : 'No internships are currently open.'}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredInternships.map((internship) => {
          const internshipId = String(internship?._id || '');
          const alreadyApplied = appliedIds.has(internshipId);
          const isSaved = savedSet.has(internshipId);
          const skills = Array.isArray(internship?.requiredSkills) ? internship.requiredSkills.filter(Boolean) : [];
          const startDate = internship?.startDate ? new Date(internship.startDate) : null;
          const endDate = internship?.endDate ? new Date(internship.endDate) : null;
          const startLabel = startDate && !Number.isNaN(startDate.getTime()) ? startDate.toLocaleDateString() : '';
          const endLabel = endDate && !Number.isNaN(endDate.getTime()) ? endDate.toLocaleDateString() : '';

          return (
            <article key={internshipId} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold leading-6 text-slate-900">{internship.title}</h3>
                <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">{internship.status || 'Open'}</span>
              </div>

              <p className="mt-2 text-sm text-slate-600">{internship.location || 'Location not specified'}</p>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{internship.description || 'No description available.'}</p>

              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <p><span className="font-semibold text-slate-700">Duration:</span> {internship.duration || 'Not specified'}</p>
                <p><span className="font-semibold text-slate-700">Timeline:</span> {startLabel && endLabel ? `${startLabel} - ${endLabel}` : 'Not specified'}</p>
                <p><span className="font-semibold text-slate-700">Students Needed:</span> {Number(internship.studentsNeeded || 0) > 0 ? internship.studentsNeeded : 'Not specified'}</p>
              </div>

              {skills.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {skills.slice(0, 6).map((skill) => (
                    <span key={`${internshipId}-${skill}`} className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleApply(internshipId)}
                  disabled={alreadyApplied || applyingId === internshipId}
                  className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${alreadyApplied ? 'cursor-not-allowed bg-slate-200 text-slate-500' : 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white hover:brightness-105 disabled:opacity-70'}`}
                >
                  {alreadyApplied ? 'Already Applied' : applyingId === internshipId ? 'Applying...' : 'Apply Now'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSave(internshipId)}
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${isSaved ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:text-cyan-700'}`}
                  title={isSaved ? 'Saved for later' : 'Save for later'}
                >
                  {isSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
