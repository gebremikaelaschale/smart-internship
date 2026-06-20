import { Link, NavLink } from 'react-router-dom';
import React, { useEffect, useState, useRef } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { employerAPI } from '../employerAPI';
import ProgramSubNav from '../components/ProgramSubNav';
import useCompanyVerificationSync from '@/hooks/useCompanyVerificationSync';

const PAGE_SIZE = 6;

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Not specified';
  return date.toLocaleDateString();
}

export default function MyPrograms() {
  const [companyProfile, setCompanyProfile] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyProgramId, setBusyProgramId] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedProgramForDetails, setSelectedProgramForDetails] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [programToDelete, setProgramToDelete] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPrograms = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await employerAPI.getMyPrograms();
      setPrograms(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load your programs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
    employerAPI.getProfile().then(({ data }) => setCompanyProfile(data)).catch(() => {});
  }, []);

  useCompanyVerificationSync(() => {
    employerAPI.getProfile().then(({ data }) => setCompanyProfile(data)).catch(() => {});
  });

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sortBy]);

  const handleToggleStatus = async (program) => {
    const nextStatus = String(program?.status || '').toLowerCase() === 'open' ? 'Closed' : 'Open';

    try {
      setBusyProgramId(String(program._id || ''));
      setError('');
      setMessage('');
      await employerAPI.updateProgramStatus(program._id, nextStatus);
      setMessage(`Program status updated to ${nextStatus}.`);
      await loadPrograms();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update status.');
    } finally {
      setBusyProgramId('');
    }
  };

  const handleDelete = async (program) => {
    setProgramToDelete(program);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!programToDelete) return;
    const id = programToDelete._id;
    setShowDeleteConfirm(false);

    try {
      setBusyProgramId(String(id || ''));
      setError('');
      setMessage('');
      await employerAPI.deleteProgram(id);
      setMessage('Program deleted successfully.');
      await loadPrograms();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to delete program.');
    } finally {
      setBusyProgramId('');
      setProgramToDelete(null);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPrograms = programs.filter((program) => {
    const statusValue = String(program?.status || '').toLowerCase();
    const matchesStatus = statusFilter === 'all' || statusValue === statusFilter;
    if (!matchesStatus) return false;

    if (!normalizedQuery) return true;

    const searchableText = [
      program?.title,
      program?.description,
      program?.location,
      program?.workModality,
      program?.compensationType,
      program?.targetBatch,
      ...(Array.isArray(program?.targetDepartments) ? program.targetDepartments : []),
      ...(Array.isArray(program?.requiredSkills) ? program.requiredSkills : [])
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });

  const sortedPrograms = [...filteredPrograms].sort((a, b) => {
    if (sortBy === 'oldest') {
      return new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0);
    }

    if (sortBy === 'title-asc') {
      return String(a?.title || '').localeCompare(String(b?.title || ''));
    }

    if (sortBy === 'title-desc') {
      return String(b?.title || '').localeCompare(String(a?.title || ''));
    }

    return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
  });

  const totalPages = Math.max(1, Math.ceil(sortedPrograms.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedPrograms = sortedPrograms.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <ProgramSubNav />
        {companyProfile && String(companyProfile?.verification?.status || '').toLowerCase() !== 'verified' ? (
          <button disabled className="inline-flex items-center justify-center rounded-full bg-emerald-600/60 px-8 py-3 font-black text-white text-base shadow-lg shadow-emerald-100 cursor-not-allowed" title="Awaiting Super Admin verification">+ Post Internship</button>
        ) : (
          <Link
            to="/employer/post-internship"
            className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-8 py-3 font-black text-white text-base shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            + Post Internship
          </Link>
        )}
      </div>

      <Card title="My Programs" description="Manage internship programs posted by your organization.">
        {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search programs by title, skill, location..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400">Sort By:</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
            >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title-asc">Title A-Z</option>
            <option value="title-desc">Title Z-A</option>
          </select>
        </div>
      </div>

        {loading ? <p className="text-sm text-slate-500 italic">Connecting to program records...</p> : null}

        {!loading && filteredPrograms.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white text-2xl shadow-sm">🔍</div>
            <p className="mt-4 text-base font-semibold text-slate-900">No programs found</p>
            <p className="mt-1 text-sm text-slate-500">Try adjusting your filters or post a new internship.</p>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {pagedPrograms.map((program) => {
            const id = String(program?._id || '');
            const skills = Array.isArray(program?.requiredSkills) ? program.requiredSkills.filter(Boolean) : [];
            const busy = busyProgramId === id;
            const isMenuOpen = activeMenuId === id;

            return (
              <article key={id} className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 transition hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-50">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black tracking-tight text-slate-900 group-hover:text-emerald-700 capitalize">
                      {program.title?.toLowerCase() || 'Untitled Program'}
                    </h3>
                    <p className="line-clamp-2 text-sm leading-relaxed text-slate-500">
                      {program.description || 'No description provided.'}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${String(program.status || '').toLowerCase() === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {program.status || 'Draft'}
                  </span>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-y-4 border-y border-slate-50 py-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Batch/Year</p>
                    <p className="text-sm font-bold text-slate-700">{program.targetBatch || 'Graduating Class'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Applicants</p>
                    <p className="flex items-center gap-1.5 text-sm font-black text-emerald-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      {program.applicantCount || 0} Applied
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Start Date</p>
                    <p className="text-sm font-semibold text-slate-600">{formatDate(program.startDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">End Date</p>
                    <p className="text-sm font-semibold text-slate-600">{formatDate(program.endDate)}</p>
                  </div>
                </div>

                <div className="mb-6 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Required Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.length > 0 ? (
                      skills.map((skill) => (
                        <span key={`${id}-${skill}`} className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 border border-slate-100">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs italic text-slate-400">No specific skills listed</span>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                  <Button
                    as={Link}
                    to={`/employer/applicants?programId=${id}`}
                    variant="primary"
                    size="sm"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 font-bold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 active:scale-95"
                  >
                    View Applicants
                  </Button>

                  <div className="relative" ref={isMenuOpen ? menuRef : null}>
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(isMenuOpen ? null : id)}
                      className={`grid h-9 w-9 place-items-center rounded-xl transition-all duration-300 ${isMenuOpen ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 rotate-90' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>

                    {isMenuOpen && (
                      <div className="absolute bottom-full right-0 mb-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 z-50">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProgramForDetails(program);
                            setActiveMenuId(null);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </button>
                        <Link
                          to={`/employer/edit-internship/${id}`}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Edit Details
                        </Link>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            handleToggleStatus(program);
                            setActiveMenuId(null);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                        >
                          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {String(program.status || '').toLowerCase() === 'open' ? 'Close Program' : 'Open Program'}
                        </button>
                        <div className="my-1 h-px bg-slate-100" />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            handleDelete(program);
                            setActiveMenuId(null);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete Program
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {!loading && filteredPrograms.length > PAGE_SIZE ? (
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-base font-extrabold text-emerald-700">
              Showing {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filteredPrograms.length)} of {filteredPrograms.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className={`rounded-2xl border px-6 py-2 text-base font-extrabold transition disabled:opacity-50 disabled:cursor-not-allowed 
                  ${safePage <= 1 ? 'border-emerald-200 bg-emerald-50 text-emerald-400' : 'border-emerald-600 bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white'}`}
              >
                Previous
              </button>
              <span className="text-base font-extrabold text-emerald-700">Page {safePage} of {totalPages}</span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className={`rounded-2xl border px-6 py-2 text-base font-extrabold transition disabled:opacity-50 disabled:cursor-not-allowed 
                  ${safePage >= totalPages ? 'border-emerald-200 bg-emerald-50 text-emerald-400' : 'border-emerald-600 bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white'}`}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Program Detail Modal */}
      {selectedProgramForDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedProgramForDetails(null)}
          />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/80 px-8 py-6 backdrop-blur-md">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">{selectedProgramForDetails.title}</h2>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${String(selectedProgramForDetails.status || '').toLowerCase() === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {selectedProgramForDetails.status || 'Draft'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">• {selectedProgramForDetails.programType || 'Internship'}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedProgramForDetails(null)}
                className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-8 no-scrollbar" style={{ maxHeight: 'calc(90vh - 100px)' }}>
              <div className="grid gap-8">
                {/* Description Section */}
                <section>
                  <h4 className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Overview & Description</h4>
                  <p className="text-base leading-relaxed text-slate-600 whitespace-pre-wrap">
                    {selectedProgramForDetails.description || 'No description provided.'}
                  </p>
                </section>

                {/* Key Details Grid */}
                <section className="grid gap-4 rounded-3xl border border-slate-100 bg-slate-50/50 p-6 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Duration</p>
                    <p className="font-semibold text-slate-900">{selectedProgramForDetails.duration || 'Not specified'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</p>
                    <p className="font-semibold text-slate-900">{selectedProgramForDetails.location || 'Addis Ababa'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Work Modality</p>
                    <p className="font-semibold text-slate-900">{selectedProgramForDetails.workModality || 'On-site'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Compensation</p>
                    <p className="font-semibold text-slate-900">{selectedProgramForDetails.compensationType || 'Unpaid'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Min CGPA Required</p>
                    <p className="font-semibold text-slate-900">{selectedProgramForDetails.minCgpa || '0.00'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Interview Process</p>
                    <p className="font-semibold text-slate-900">{selectedProgramForDetails.interviewRequired ? 'Required' : 'Not Required'}</p>
                  </div>
                </section>

                {/* Target Section */}
                <section>
                  <h4 className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Academic Target</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-5 w-5 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Departments</p>
                        <p className="text-sm text-slate-500">{Array.isArray(selectedProgramForDetails.targetDepartments) && selectedProgramForDetails.targetDepartments.length > 0 ? selectedProgramForDetails.targetDepartments.join(', ') : 'All Departments'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-5 w-5 rounded-md bg-blue-100 flex items-center justify-center text-blue-600">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Target Batch</p>
                        <p className="text-sm text-slate-500">{selectedProgramForDetails.targetBatch || 'Graduating Class'}</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Skills Section */}
                <section>
                  <h4 className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Required Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(selectedProgramForDetails.requiredSkills) && selectedProgramForDetails.requiredSkills.map((skill) => (
                      <span key={skill} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 flex items-center justify-end border-t border-slate-100 bg-white px-8 py-4">
              <Button 
                variant="primary" 
                onClick={() => setSelectedProgramForDetails(null)}
                className="rounded-2xl px-8 font-bold"
              >
                Close Details
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-black tracking-tight text-slate-900">Delete Program?</h3>
            <p className="mb-8 text-sm font-medium leading-relaxed text-slate-500">
              Are you sure you want to delete <span className="font-bold text-slate-900">"{programToDelete?.title}"</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-2xl bg-slate-50 py-3.5 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-2xl bg-rose-600 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-rose-100 transition hover:bg-rose-700 active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
