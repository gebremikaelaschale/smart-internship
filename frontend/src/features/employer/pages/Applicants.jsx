import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '@/components/ui/Card';
import { employerAPI } from '../employerAPI';
import ProgramSubNav from '../components/ProgramSubNav';
import StudentProfileDrawer from '../components/StudentProfileDrawer';
import Modal from '@/components/common/Modal';

function statusPill(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'hod_assigned') return 'bg-purple-100 text-purple-700';
  if (value === 'placed' || value === 'accepted') return 'bg-emerald-100 text-emerald-700';
  if (value === 'rejected') return 'bg-rose-100 text-rose-700';
  if (value === 'shortlisted' || value === 'shortlist') return 'bg-violet-100 text-violet-700';
  if (value === 'interview') return 'bg-indigo-100 text-indigo-700';
  if (value === 'under review') return 'bg-cyan-100 text-cyan-700';
  if (value === 'withdrawn') return 'bg-slate-100 text-slate-500';
  return 'bg-amber-100 text-amber-700';
}

export default function Applicants() {
  const [searchParams] = useSearchParams();
  const programId = String(searchParams.get('programId') || '').trim();

  // 1. States
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState({ name: '', reason: '' });
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingApplication, setRejectingApplication] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Filter States
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSkill, setFilterSkill] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [matchScoreFilter, setMatchScoreFilter] = useState('all');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Pagination & Selection States
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 2. Data Memos
  const filteredApplications = useMemo(() => {
    let list = Array.isArray(applications) ? applications : [];
    if (programId) {
      list = list.filter(app => String(app?.internshipId?._id || '') === programId);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(app =>
        (app?.studentId?.fullName || '').toLowerCase().includes(s) ||
        (app?.studentProfile?.skills || []).some(skill => skill.toLowerCase().includes(s))
      );
    }
    if (filterDept) {
      list = list.filter(app => app?.studentProfile?.department === filterDept);
    }
    if (filterStatus) {
      list = list.filter(app => app?.status === filterStatus);
    }
    if (filterSkill) {
      list = list.filter(app => (app?.studentProfile?.skills || []).includes(filterSkill));
    }
    if (filterSource) {
      list = list.filter(app => (app?.source || 'student') === filterSource);
    }
    if (matchScoreFilter === 'top') {
      list = list.filter(app => (Number(app.match_score ?? app.matchingScore ?? app.matchScore ?? 0) >= 80));
    }
    if (matchScoreFilter === 'good') {
      list = list.filter(app => (Number(app.match_score ?? app.matchingScore ?? app.matchScore ?? 0) >= 60));
    }
    list = [...list].sort((a, b) => {
      const aScore = Number(a.match_score ?? a.matchingScore ?? a.matchScore ?? 0);
      const bScore = Number(b.match_score ?? b.matchingScore ?? b.matchScore ?? 0);
      if (aScore === bScore) {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      return sortDirection === 'asc' ? aScore - bScore : bScore - aScore;
    });
    return list;
  }, [applications, programId, search, filterDept, filterStatus, filterSkill, filterSource, matchScoreFilter, sortDirection]);

  const paginatedApplications = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredApplications.slice(start, start + itemsPerPage);
  }, [filteredApplications, currentPage]);

  const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);

  const stats = useMemo(() => {
    const list = Array.isArray(applications) ? applications : [];
    return {
      total: list.length,
      highMatch: list.filter(app => (app.match_score ?? app.matchingScore ?? 0) >= 80).length,
      pending: list.filter(app => ['Applied', 'Pending', 'Under Review'].includes(app.status)).length,
      accepted: list.filter(app => ['Accepted', 'Placed'].includes(app.status)).length
    };
  }, [applications]);

  // Bulk Selection Logic
  const allVisibleIds = useMemo(() => paginatedApplications.map(app => String(app?._id || '')), [paginatedApplications]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !allVisibleIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...allVisibleIds])]);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Helper for filter dropdown options
  const allDepartments = useMemo(() => [...new Set(applications.map(app => app?.studentProfile?.department).filter(Boolean))], [applications]);
  const allStatuses = useMemo(() => [...new Set(applications.map(app => app?.status).filter(Boolean))], [applications]);
  const allSkills = useMemo(() => {
    const set = new Set();
    applications.forEach(app => (app?.studentProfile?.skills || []).forEach(s => set.add(s)));
    return Array.from(set);
  }, [applications]);

  // 3. Handlers
  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError('');
      // pass query params as an object to the API wrapper
      const { data } = await employerAPI.getApplicants(programId ? { programId } : {});
      console.log('Employer applicants payload:', data);
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to fetch applications.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (applicationId, status, reason = '') => {
    try {
      setBusyId(String(applicationId || ''));
      setError('');
      setMessage('');
      const trimmedReason = String(reason || '').trim();
      const payload = { status, remarks: trimmedReason };
      if (String(status || '').toLowerCase() === 'rejected') {
        payload.reason = trimmedReason;
        payload.rejectionReason = trimmedReason;
      }
      const { data } = await employerAPI.updateApplicationStatus(applicationId, payload);
      const finalStatus = data?.status || status;
      const finalReason = String(data?.rejection_reason_by_company || data?.rejectionReason || trimmedReason || '').trim();
      setApplications(prev => prev.map(item => String(item?._id) === String(applicationId) ? {
        ...item,
        status: finalStatus,
        rejectionReason: finalReason,
        rejection_reason_by_company: finalReason
      } : item));
      if (selectedApp && String(selectedApp._id) === String(applicationId)) {
        setSelectedApp(prev => prev ? {
          ...prev,
          status: finalStatus,
          rejectionReason: finalReason,
          rejection_reason_by_company: finalReason
        } : prev);
      }
      setMessage(`Updated to ${finalStatus}`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Update failed.');
    } finally {
      setBusyId('');
    }
  };

  const handleOpenReject = (application) => {
    setRejectingApplication(application);
    setRejectionReason(String(application?.rejection_reason_by_company || application?.rejectionReason || ''));
    setRejectModalOpen(true);
  };

  const isUniversityPlacement = (application) => {
    const status = String(application?.status || '').toLowerCase();
    return status === 'hod_assigned' || String(application?.placement_source || '').toUpperCase() === 'HOD_ASSIGNED' || String(application?.source || '').toLowerCase() === 'hod';
  };

  const getUniversityPlacementNote = (application) => String(application?.hod_assignment_note || application?.hod_note || '').trim();

  const handleConfirmReject = async () => {
    const applicationId = rejectingApplication?._id;
    if (!applicationId) return;

    const trimmedReason = String(rejectionReason || '').trim();
    if (!trimmedReason) {
      setError('Please provide a rejection reason before confirming.');
      return;
    }

    setRejectModalOpen(false);

    setApplications(prev => prev.map(item => String(item?._id) === String(applicationId) ? {
      ...item,
      status: 'Rejected',
      rejectionReason: trimmedReason,
      rejection_reason_by_company: trimmedReason
    } : item));
    if (selectedApp && String(selectedApp._id) === String(applicationId)) {
      setSelectedApp(prev => prev ? {
        ...prev,
        status: 'Rejected',
        rejectionReason: trimmedReason,
        rejection_reason_by_company: trimmedReason
      } : prev);
    }

    setRejectingApplication(null);
    setRejectionReason('');
    await updateStatus(applicationId, 'Rejected', trimmedReason);
  };

  const handleBulkAction = async (action) => {
    for (const id of selectedIds) {
      await updateStatus(id, action);
    }
    setSelectedIds([]);
  };

  const [removeId, setRemoveId] = useState(null);

  const handleRemove = async () => {
    if (!removeId) return;
    try {
      setBusyId(String(removeId));
      await employerAPI.deleteApplication(removeId);
      setApplications(prev => prev.filter(item => String(item._id) !== String(removeId)));
      setMessage('Applicant removed from your view successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to remove applicant.');
    } finally {
      setBusyId('');
      setRemoveId(null);
    }
  };

  const openProfile = (app) => {
    setSelectedApp(app);
    setIsDrawerOpen(true);
  };

  // 4. Effects
  useEffect(() => {
    fetchApplications();
  }, [programId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterDept, filterStatus, filterSkill, filterSource, matchScoreFilter, sortDirection]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900">Applicants Management</h2>
        <button
          onClick={() => {
            const headers = ['Student Name', 'Email', 'Department', 'Year', 'Skills', 'Match Score', 'Program', 'Source', 'Status', 'Date'];
            const rows = filteredApplications.map(app => [
              `"${app.studentId?.fullName || 'N/A'}"`,
              `"${app.studentId?.email || 'N/A'}"`,
              `"${app.studentProfile?.department || 'N/A'}"`,
              `"${app.studentProfile?.yearOfStudy || 'N/A'}"`,
              `"${(app.studentProfile?.skills || []).join(', ')}"`,
              `"${app.match_score ?? app.matchingScore ?? app.matchScore ?? 0}%"`,
              `"${app.internshipId?.title || 'N/A'}"`,
              `"${(app.source || 'student') === 'hod' ? 'University Placement' : 'Direct Applicant'}"`,
              `"${app.status || 'N/A'}"`,
              `"${new Date(app.createdAt).toLocaleDateString()}"`
            ]);
            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Industry_Report_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-xl shadow-slate-200 transition-all hover:bg-slate-800 active:scale-95"
        >
          📥 Export HR Report
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Applicants', val: stats.total, color: 'text-slate-900', bg: 'bg-blue-50' },
          { label: 'High Match (>80%)', val: stats.highMatch, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Pending Review', val: stats.pending, color: 'text-slate-900', bg: 'bg-indigo-50' },
          { label: 'Accepted Interns', val: stats.accepted, color: 'text-emerald-600', bg: 'bg-emerald-50' }
        ].map((s, idx) => (
          <div key={idx} className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
            <h4 className={`text-2xl font-black ${s.color}`}>{s.val}</h4>
          </div>
        ))}
      </div>

      <Card title="Program Applications" description="Review and manage student applications for your programs.">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-4xl">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400">🔍</span>
            <input
              type="text"
              className="w-full rounded-[20px] border-2 border-slate-200 bg-slate-50 py-4 pl-12 pr-6 text-lg font-bold text-slate-900 outline-none transition-all focus:border-emerald-400 focus:bg-white focus:ring-8 focus:ring-emerald-50 placeholder:text-slate-400"
              placeholder="Search by name or skills..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
              <option value="">Departments</option>
              {allDepartments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Statuses</option>
              {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none" value={filterSkill} onChange={e => setFilterSkill(e.target.value)}>
              <option value="">Skills</option>
              {allSkills.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none" value={matchScoreFilter} onChange={e => setMatchScoreFilter(e.target.value)}>
              <option value="all">Show All</option>
              <option value="top">Top Matches (80%+)</option>
              <option value="good">Good Matches (60%+)</option>
            </select>
            <select className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-emerald-400" value={filterSource} onChange={e => setFilterSource(e.target.value)}>
              <option value="">All Sources</option>
              <option value="student">Direct Applicants</option>
              <option value="hod">University Placement</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-white"
            >
              Sort: {sortDirection === 'desc' ? 'High → Low' : 'Low → High'}
            </button>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
            <span className="text-sm font-bold text-emerald-700">{selectedIds.length} Selected</span>
            <div className="h-4 w-px bg-emerald-200 mx-1" />
            <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md" onClick={() => handleBulkAction('Accepted')}>Bulk Accept</button>
            <button className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 shadow-md" onClick={() => handleBulkAction('Rejected')}>Bulk Reject</button>
            <button className="rounded-lg bg-slate-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-600 shadow-md" onClick={() => handleBulkAction('Pending')}>Bulk Reset</button>
          </div>
        )}

        {error ? <p className="mb-4 text-sm text-rose-600 font-bold bg-rose-50 p-3 rounded-xl border border-rose-100">{error}</p> : null}
        {message ? <p className="mb-4 text-sm text-emerald-700 font-bold bg-emerald-50 p-3 rounded-xl border border-emerald-100">{message}</p> : null}

        {loading ? <p className="py-10 text-center text-slate-500 font-medium italic">Loading applicants data...</p> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-3"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" /></th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">Name</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">Dept</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">Score</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">Program</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedApplications.map((app) => {
                  const status = app.status || 'Pending';
                  const isWithdrawn = String(status).toLowerCase() === 'withdrawn';
                  const isUniversityAssigned = isUniversityPlacement(app);
                  const isFinalized = ['placed', 'accepted', 'rejected', 'hod_assigned'].includes(String(status).toLowerCase());
                  const universityNote = getUniversityPlacementNote(app);

                  return (
                    <tr key={app._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-2 py-3"><input type="checkbox" checked={selectedIds.includes(String(app._id))} onChange={() => toggleSelectOne(String(app._id))} className="rounded" /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-900">{app.studentId?.fullName}</span>
                          <div className="flex items-center gap-2">
                            {isUniversityAssigned ? (
                              <div className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-1 text-purple-700 border border-purple-200 shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-wider">University Placement</span>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentNote({ name: app?.assignedBy || 'University HOD', reason: universityNote || 'University recommendation note not provided.' });
                                    setNoteModalOpen(true);
                                  }}
                                  className="flex h-4 w-4 items-center justify-center rounded-full bg-purple-200/50 hover:bg-purple-200 transition-colors"
                                  title="View University Recommendation"
                                >
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </button>
                              </div>
                            ) : (
                              <div className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-600 border border-blue-100 shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-wider">Direct Applicant</span>
                              </div>
                            )}
                            <button onClick={() => openProfile(app)} className="w-fit text-[10px] font-black text-emerald-700 uppercase tracking-wider hover:underline">🔍 Profile</button>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{app.studentProfile?.department}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const score = Number(app.match_score ?? app.matchingScore ?? app.matchScore ?? 0);
                          const cls = score === 0 ? 'text-rose-600' : (score > 70 ? 'text-cyan-600' : 'text-slate-900');
                          const badgeText = score >= 95 ? 'EXCELLENT FIT' : score >= 90 ? 'TOP PICK' : null;
                          return (
                            <span className={`inline-flex items-center gap-2 font-bold ${cls}`}>
                              <span>{score}%</span>
                              {badgeText ? (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                                  {badgeText}
                                </span>
                              ) : null}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate">{app.internshipId?.title}</td>
                      <td className="px-4 py-3">
                        {isUniversityAssigned ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentNote({ name: app?.assignedBy || 'University HOD', reason: universityNote || 'University recommendation note not provided.' });
                              setNoteModalOpen(true);
                            }}
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusPill('hod_assigned')} transition-all hover:shadow-sm`}
                            title="View university recommendation"
                          >
                            University Placement
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        ) : (
                          <span className={`inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusPill(status)}`}>
                            {status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {isWithdrawn || isFinalized ? (
                            <>
                              {String(status).toLowerCase() === 'placed' && (
                                <button
                                  onClick={() => window.location.href = `/employer/logbooks?studentId=${app.studentId?._id}`}
                                  className="rounded-xl border-2 border-emerald-600 bg-white px-3 py-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-wider hover:bg-emerald-50 transition-all active:scale-95 shadow-sm"
                                >
                                  Logbook
                                </button>
                              )}
                              <button 
                                onClick={() => updateStatus(app._id, 'Pending')}
                                disabled={!!busyId}
                                className="text-[10px] font-black text-slate-400 uppercase tracking-wider hover:text-indigo-600 transition-colors"
                                title="Reset to Pending"
                              >
                                🔄 Reset
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => updateStatus(app._id, 'Accepted')}
                                disabled={!!busyId}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white uppercase tracking-wider shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleOpenReject(app)}
                                disabled={!!busyId}
                                className="rounded-lg bg-rose-600 px-3 py-1.5 text-[10px] font-black text-white uppercase tracking-wider shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
              <div className="text-sm font-bold text-slate-600">
                Page <span className="text-slate-900">{currentPage}</span> of <span className="text-slate-900">{totalPages || 1}</span> 
                <span className="mx-3 text-slate-300">|</span>
                <span className="text-slate-500 font-medium text-xs">
                  Showing {filteredApplications.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredApplications.length)} of {filteredApplications.length} applicants
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={currentPage === 1} 
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-40 active:scale-95"
                >
                  &lt; Prev
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                  disabled={currentPage === totalPages || totalPages === 0} 
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-40 active:scale-95"
                >
                  Next &gt;
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <StudentProfileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} application={selectedApp} onStatusUpdate={updateStatus} isBusy={!!busyId} />

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

      <Modal
        open={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectingApplication(null);
          setRejectionReason('');
        }}
        title="Reject Applicant"
      >
        <div className="space-y-5">
          <div className="rounded-2xl bg-rose-50 p-5 border border-rose-100">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 mb-2">Please provide a reason for rejection</p>
            <p className="text-sm leading-relaxed text-slate-600">
              This will be shared with the student to help them improve.
            </p>
          </div>

          <div>
            <label htmlFor="rejectionReason" className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">
              Reason for Rejection
            </label>
            <textarea
              id="rejectionReason"
              rows={5}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Write constructive feedback for the student..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-50"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setRejectModalOpen(false);
                setRejectingApplication(null);
                setRejectionReason('');
              }}
              className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-black text-slate-600 transition-all hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReject}
              disabled={!String(rejectionReason || '').trim()}
              className="flex-1 rounded-2xl bg-rose-600 py-3 text-sm font-black text-white shadow-lg shadow-rose-100 transition-all hover:bg-rose-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      </Modal>

      {/* Premium Remove Confirmation Modal */}
      {removeId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setRemoveId(null)} />
          <div className="relative w-full max-w-md transform overflow-hidden rounded-[32px] bg-white p-8 shadow-2xl transition-all">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-amber-600 shadow-inner">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <h3 className="mb-2 text-2xl font-black text-slate-900">Remove from View?</h3>
              <p className="mb-8 text-sm font-medium leading-relaxed text-slate-500 px-4">
                Are you sure you want to remove this student from your current list? This will archive the record from your dashboard view.
              </p>
              <div className="flex w-full flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setRemoveId(null)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-black text-slate-600 transition-all hover:bg-slate-50 hover:border-slate-300"
                >
                  No, Keep
                </button>
                <button
                  onClick={handleRemove}
                  className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-black text-white shadow-lg shadow-slate-200 transition-all hover:bg-slate-800 active:scale-95"
                >
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
