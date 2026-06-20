import React, { useEffect, useState, useMemo } from 'react';
import Card from '@/components/ui/Card';
import { employerAPI } from '../employerAPI';
import ProgramSubNav from '../components/ProgramSubNav';
import Modal from '@/components/common/Modal';

function progressColor(progress) {
  if (progress >= 80) return 'bg-emerald-500';
  if (progress >= 40) return 'bg-cyan-500';
  return 'bg-amber-500';
}

function statusPill(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'active') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  if (value === 'closed') return 'bg-slate-100 text-slate-600 border border-slate-200';
  return 'bg-amber-100 text-amber-700 border border-amber-200';
}

const ITEMS_PER_PAGE = 8;

export default function ActiveInterns() {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState({ name: '', reason: '' });

  useEffect(() => {
    let active = true;
    const loadInterns = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await employerAPI.getActiveInterns();
        if (!active) return;
        setInterns(Array.isArray(data) ? data : []);
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load active interns.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadInterns();
    return () => { active = false; };
  }, []);

  // Filter Logic
  const filteredInterns = useMemo(() => {
    const query = search.toLowerCase().trim();
    return interns.filter(item => {
      const nameMatch = (item?.student?.name || '').toLowerCase().includes(query);
      const programMatch = (item?.internship?.title || '').toLowerCase().includes(query);
      const deptMatch = !deptFilter || (item?.student?.department || '') === deptFilter;
      const sourceMatch = !filterSource || (item?.source || 'student') === filterSource;
      return (nameMatch || programMatch) && deptMatch && sourceMatch;
    });
  }, [interns, search, deptFilter, filterSource]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredInterns.length / ITEMS_PER_PAGE);
  const paginatedInterns = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInterns.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInterns, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, deptFilter, filterSource]);

  // Stats Logic
  const stats = useMemo(() => {
    const total = interns.length;
    const avgProgress = total > 0 ? Math.round(interns.reduce((acc, curr) => acc + (curr.progress || 0), 0) / total) : 0;
    const highPerformers = interns.filter(i => (i.progress || 0) >= 80).length;
    const pendingTasks = interns.reduce((acc, curr) => acc + ((curr.tasks?.total || 0) - (curr.tasks?.completed || 0)), 0);
    return { total, avgProgress, highPerformers, pendingTasks };
  }, [interns]);

  const departments = [...new Set(interns.map(i => i?.student?.department).filter(Boolean))];

  return (
    <div className="space-y-6">
      <ProgramSubNav />

      {/* Header & Stats */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Internship Management</h1>
          <p className="text-sm font-medium text-slate-500">Track real-time progress and performance of your active interns.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="group relative overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-500 to-teal-700 p-6 shadow-[0_20px_50px_rgba(16,185,129,0.3)] transition-all hover:shadow-[0_30px_60px_rgba(16,185,129,0.4)] hover:-translate-y-1 min-w-[200px]">
            {/* 3D Glassmorphism Effect */}
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl transition-all group-hover:bg-white/20" />
            
            <p className="relative z-10 text-[11px] font-black uppercase tracking-[0.15em] text-emerald-100/80">Active Interns</p>
            <div className="relative z-10 mt-2 flex items-baseline gap-2">
              <p className="text-5xl font-black text-white tracking-tighter drop-shadow-md">
                {stats.total}
              </p>
              <div className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <Card title="Active Interns Directory" description="Manage and monitor student performance across all your active programs.">
        {/* Search & Filter Bar */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-4xl">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400">🔍</span>
            <input
              type="text"
              className="w-full rounded-[20px] border-2 border-slate-200 bg-slate-50 py-4 pl-12 pr-6 text-lg font-bold text-slate-900 outline-none transition-all focus:border-emerald-400 focus:bg-white focus:ring-8 focus:ring-emerald-50 placeholder:text-slate-400"
              placeholder="Search interns by name or program..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <select
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none hover:border-slate-300 transition-colors"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none hover:border-slate-300 transition-colors"
              value={filterSource}
              onChange={e => setFilterSource(e.target.value)}
            >
              <option value="">All Sources</option>
              <option value="student">Direct Applicants</option>
              <option value="hod">University Placement</option>
            </select>
          </div>
        </div>

        {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          </div>
        ) : filteredInterns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-xl shadow-slate-200/50">
              <span className="text-4xl">👨‍💻</span>
            </div>
            <h3 className="mb-2 text-xl font-black text-slate-900">{search || deptFilter ? 'No results found' : 'No active interns yet'}</h3>
            <p className="mb-8 max-w-sm text-sm font-medium leading-relaxed text-slate-500">
              {search || deptFilter ? 'Try adjusting your search or filters to find what you are looking for.' : "You currently have no active interns. Once you 'Accept' applicants, they will appear here."}
            </p>
            {!search && !deptFilter && (
              <button 
                onClick={() => window.location.href = '/employer/applicants'}
                className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-4 text-sm font-black text-white shadow-xl shadow-emerald-200 transition-all hover:bg-emerald-700 active:scale-95"
              >
                Go to Applicants <span>→</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-[24px] border border-slate-100 bg-white shadow-sm mb-6">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Name</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Program</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Progress Tracking</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedInterns.map((item) => {
                    const progress = Number(item?.progress || 0);
                    return (
                      <tr key={String(item?.applicationId || `${item?.student?.id}-${item?.internship?.id}`)} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900">{item?.student?.name}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">{item?.student?.department}</span>
                            <div className="flex items-center gap-1">
                              {item?.source === 'hod' || item?.placement_source === 'HOD_ASSIGNED' ? (
                                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700 border border-amber-200 shadow-sm">
                                  <span className="text-[10px] font-black uppercase tracking-wider">University Placement</span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCurrentNote({ name: item?.assignedBy || 'University HOD', reason: item?.hod_note || 'Facilitated by University agreement' });
                                      setNoteModalOpen(true);
                                    }}
                                    className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-200/50 hover:bg-amber-200 transition-colors"
                                    title="View Assignment Note"
                                  >
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                  </button>
                                </div>
                              ) : (
                                <div className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-600 border border-blue-100 shadow-sm">
                                  <span className="text-[10px] font-black uppercase tracking-wider">Direct Applicant</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-600">{item?.internship?.title}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-48">
                            <div className="mb-2 flex items-center justify-between">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${progress >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'}`}>
                                {progress}% Complete
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">
                                {item?.tasks?.completed || 0}/{item?.tasks?.total || 0} Tasks
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full transition-all duration-500 ${progressColor(progress)}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusPill(item?.status)}`}>
                            {item?.status || 'Active'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-right">
                          <button
                            onClick={() => window.location.href = `/employer/logbooks?studentId=${item?.student?.id}`}
                            className="rounded-xl border-2 border-emerald-600 bg-white px-4 py-2 text-[10px] font-black text-emerald-600 uppercase tracking-wider hover:bg-emerald-50 transition-all active:scale-95 shadow-sm"
                          >
                            Logbook
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2">
                <p className="text-xs font-bold text-slate-500">
                  Page <span className="text-slate-900">{currentPage}</span> of {totalPages} 
                  <span className="mx-2 text-slate-200">|</span> 
                  Showing {paginatedInterns.length} of {filteredInterns.length} interns
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
                  >
                    &larr; Prev
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Modal open={noteModalOpen} onClose={() => setNoteModalOpen(false)} title="University Assignment Details">
         <div className="space-y-4">
            <div className="rounded-2xl bg-amber-50 p-6 border border-amber-100">
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 mb-2">Assigned By</p>
               <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-lg shadow-sm border border-amber-100">🎓</div>
                  <p className="text-lg font-black text-slate-900">{currentNote.name}</p>
               </div>
            </div>
            <div className="space-y-2">
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Assignment Reason / Note</p>
               <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 italic text-slate-600 leading-relaxed font-medium">
                  "{currentNote.reason}"
               </div>
            </div>
            <button 
              onClick={() => setNoteModalOpen(false)}
              className="w-full py-4 rounded-xl bg-slate-900 text-white font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
            >
               Got it, thanks
            </button>
         </div>
      </Modal>
    </div>
  );
}
