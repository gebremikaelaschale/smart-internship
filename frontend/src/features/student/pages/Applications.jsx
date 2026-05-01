import React, { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Loader from '@/components/common/Loader';
import ErrorMessage from '@/components/common/ErrorMessage';
import { studentAPI } from '../studentAPI';
import { motion, AnimatePresence } from 'framer-motion';

function getTracking(status) {
  const normalized = String(status || 'Pending').toLowerCase();
  const seen = !['pending'].includes(normalized);
  const shortlisted = ['shortlisted', 'interview', 'accepted', 'offered', 'placed'].includes(normalized);
  return { seen, shortlisted };
}

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirm',
    type: 'danger'
  });

  const [detailsModal, setDetailsModal] = useState({
    isOpen: false,
    application: null
  });

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await studentAPI.getApplications();
      setApplications(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Unable to fetch applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleWithdraw = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Withdraw Application',
      message: 'Are you sure you want to withdraw this application? This action cannot be undone.',
      confirmText: 'Withdraw',
      type: 'danger',
      onConfirm: async () => {
        try {
          await studentAPI.withdrawApplication(id);
          fetchApplications();
        } catch (err) {
          console.error(err);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleRespond = (id, status) => {
    const isAccept = status === 'Accepted';
    setConfirmModal({
      isOpen: true,
      title: isAccept ? 'Accept Offer' : 'Decline Offer',
      message: `Are you sure you want to ${isAccept ? 'accept' : 'decline'} this internship offer?`,
      confirmText: isAccept ? 'Accept' : 'Decline',
      type: isAccept ? 'success' : 'danger',
      onConfirm: async () => {
        try {
          await studentAPI.respondToOffer(id, status);
          fetchApplications();
        } catch (err) {
          console.error(err);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleViewDetails = (application) => {
    setDetailsModal({
      isOpen: true,
      application
    });
  };

  const quick = useMemo(() => {
    let seen = 0;
    let shortlisted = 0;

    applications.forEach((application) => {
      const state = getTracking(application?.status);
      if (state.seen) seen += 1;
      if (state.shortlisted) shortlisted += 1;
    });

    return { seen, shortlisted };
  }, [applications]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const internship = app?.internshipId;
      const company = internship?.companyProfile;
      
      const searchStr = `${internship?.title || ''} ${company?.companyName || ''} ${internship?.location || ''} ${internship?.department || ''}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || String(app?.status || 'Pending').toLowerCase() === statusFilter.toLowerCase();
      const matchesLocation = locationFilter === 'All' || String(internship?.location || '').toLowerCase().includes(locationFilter.toLowerCase());
      
      let matchesPayment = true;
      if (paymentFilter === 'Paid') matchesPayment = internship?.isPaid === true;
      else if (paymentFilter === 'Unpaid') matchesPayment = internship?.isPaid === false;
      
      return matchesSearch && matchesStatus && matchesLocation && matchesPayment;
    });
  }, [applications, searchTerm, statusFilter, locationFilter, paymentFilter]);

  const uniqueLocations = useMemo(() => {
    const locs = new Set();
    applications.forEach(app => {
      if (app.internshipId?.location) locs.add(app.internshipId.location);
    });
    return Array.from(locs);
  }, [applications]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pt-10">
      {/* 💎 Cyan Hero Section */}
      <div className="px-6 lg:px-10 mb-8">
        <div className="bg-gradient-to-br from-cyan-50/50 to-sky-50/50 rounded-[40px] p-10 relative overflow-hidden border border-cyan-100/50">
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 mb-2">APPLICATION HUB</p>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Your Applications</h2>
                <p className="text-slate-500 mt-2 font-medium max-w-lg">Monitor every submitted application and track statuses in real time from the backend.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white px-5 py-2 text-[11px] font-black text-slate-600 shadow-sm border border-slate-100">
                  Total submissions: <span className="text-cyan-600">{applications.length}</span>
                </span>
                <span className="rounded-full bg-white px-5 py-2 text-[11px] font-black text-slate-600 shadow-sm border border-slate-100">
                  Seen: <span className="text-sky-500">{quick.seen}</span>
                </span>
                <span className="rounded-full bg-emerald-50 px-5 py-2 text-[11px] font-black text-emerald-600 border border-emerald-100">
                  Ready for Placement: {quick.shortlisted}
                </span>
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
                placeholder="Search roles, companies, locations or departments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent py-7 pl-16 pr-8 text-lg text-slate-900 outline-none placeholder:text-slate-400 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Filters and Results */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4">
          <div className="flex items-center gap-6">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">FILTER BY</span>
            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-5 pr-10 text-xs font-bold text-slate-600 shadow-sm transition hover:border-cyan-300 focus:outline-none cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Seen">Seen</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Interview">Interview</option>
                <option value="Offered">Offered</option>
                <option value="Placed">Placed</option>
              </select>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-5 pr-10 text-xs font-bold text-slate-600 shadow-sm transition hover:border-cyan-300 focus:outline-none cursor-pointer"
              >
                <option value="All">All Locations</option>
                <option value="Remote">Remote</option>
                {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Results:</span>
             <span className="rounded-full bg-cyan-600 px-3 py-1 text-xs font-black text-white shadow-lg shadow-cyan-200">
              {filteredApplications.length}
            </span>
          </div>
        </div>
      </div>

      {loading ? <Loader label="Loading applications" /> : null}
      {error ? <ErrorMessage message={error} /> : null}

      {!loading && (
        <div className="w-full mx-auto px-6 lg:px-10 mt-8 pb-20">
          {applications.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-[40px] border border-slate-100 shadow-sm">
               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">📋</div>
               <h3 className="text-xl font-black text-slate-900 mb-2">No Applications Found</h3>
               <p className="text-slate-500 font-medium">You haven't submitted any applications yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApplications.map((application) => {
                const statusStr = String(application.status || 'Pending').toLowerCase();
                const isRejected = statusStr === 'rejected';
                const isWithdrawn = statusStr === 'withdrawn';
                const isPlaced = statusStr === 'placed';

                return (
                  <Card key={application._id} className="rounded-[28px] border-slate-100 bg-white p-5 shadow-[0_15px_40px_rgba(15,23,42,0.03)] hover:shadow-[0_20px_50px_rgba(15,23,42,0.06)] transition-all flex flex-col lg:flex-row lg:items-center gap-6">
                    {/* LEFT: Logo & Role */}
                    <div className="flex items-center gap-4 lg:w-[25%]">
                      <div className="h-14 w-14 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden">
                        {application?.internshipId?.companyProfile?.logo ? (
                          <img src={application.internshipId.companyProfile.logo} alt="Company" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xl font-bold text-slate-300">{(application?.internshipId?.title || 'C').charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 line-clamp-1">{application?.internshipId?.title || 'Internship'}</h3>
                        <p className="text-xs font-bold text-cyan-600 mt-0.5 line-clamp-1">{application?.internshipId?.companyProfile?.companyName || 'Company'}</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-tighter">Applied: {new Date(application.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* MIDDLE: Timeline */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-3 px-2">
                        <span className="flex items-center gap-1.5"><div className="h-1 w-1 rounded-full bg-slate-300"/> {application?.internshipId?.location || 'Not specified'}</span>
                        <span className="flex items-center gap-1.5"><div className="h-1 w-1 rounded-full bg-slate-300"/> {application?.internshipId?.duration || '5 months'}</span>
                        <span className="flex items-center gap-1.5"><div className="h-1 w-1 rounded-full bg-slate-300"/> Starts: {application?.internshipId?.startDate ? new Date(application.internshipId.startDate).toLocaleDateString() : '4/29/2026'}</span>
                      </div>

                      <div className="relative py-2">
                        {(() => {
                          const steps = ['pending', 'seen', 'shortlisted', 'interview', 'offered'];
                          const labels = ['APPLIED', 'SEEN', 'SHORTLISTED', 'INTERVIEW', 'STATUS'];
                          let stepIndex = steps.findIndex(s => s === statusStr);
                          if (isPlaced) stepIndex = 4;
                          if (stepIndex === -1 && (isRejected || isWithdrawn)) stepIndex = 4;
                          if (stepIndex === -1) stepIndex = 0;

                          const finalLabel = isRejected ? 'REJECTED' : isWithdrawn ? 'WITHDRAWN' : isPlaced ? 'PLACED' : (statusStr === 'accepted' ? 'ACCEPTED' : 'OFFERED');
                          
                          return (
                            <div className="relative flex justify-between w-full px-2">
                              <div className="absolute left-4 right-4 top-[9px] h-[2px] bg-slate-100 z-0"></div>
                              {!isRejected && !isWithdrawn && (
                                <div className={`absolute left-4 top-[9px] h-[2px] z-0 transition-all duration-500 ${isPlaced ? 'bg-emerald-400' : 'bg-cyan-400'}`} style={{ width: `${(stepIndex / 4) * 90}%` }}></div>
                              )}
                              {isRejected && <div className="absolute left-4 right-4 top-[9px] h-[2px] bg-rose-400 z-0"></div>}
                              
                              {labels.map((label, idx) => {
                                const isActive = !isRejected && !isWithdrawn && (idx <= stepIndex || isPlaced);
                                const isCurrent = !isRejected && !isWithdrawn && !isPlaced && idx === stepIndex;
                                const isFinalNode = idx === 4;
                                const actualLabel = isFinalNode ? finalLabel : label;

                                return (
                                  <div key={idx} className="flex flex-col items-center gap-2.5 z-10">
                                    <div className={`h-[18px] w-[18px] rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                                      (isFinalNode && isRejected) ? 'border-rose-500 bg-rose-50' :
                                      (isFinalNode && isPlaced) ? 'border-emerald-500 bg-emerald-50' :
                                      isCurrent ? 'border-cyan-500 ring-4 ring-cyan-50' :
                                      isActive ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200'
                                    }`}>
                                      {isActive && !isCurrent && !isFinalNode && <div className="h-1.5 w-1.5 rounded-full bg-cyan-500" />}
                                      {isCurrent && <div className="h-2 w-2 rounded-full bg-cyan-500" />}
                                      {isFinalNode && isPlaced && <svg className="h-2.5 w-2.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                                      {isFinalNode && isRejected && <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                                    </div>
                                    <span className={`text-[8px] font-black tracking-widest ${
                                      (isFinalNode && isRejected) ? 'text-rose-500' :
                                      (isFinalNode && isPlaced) ? 'text-emerald-600' :
                                      isActive ? 'text-slate-600' : 'text-slate-300'
                                    }`}>{actualLabel}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* RIGHT: Match & Button */}
                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-4 lg:w-[20%]">
                      <div className="flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 border border-sky-100">
                        <svg className="h-3 w-3 text-sky-500" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                        <span className="text-[10px] font-black text-sky-700">{application?.matchingScore || 0}% Match</span>
                      </div>
                      <button 
                        onClick={() => handleViewDetails(application)}
                        className="w-full lg:w-auto px-10 py-3 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
                      >
                        View Details
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm overflow-hidden rounded-[24px] bg-white p-6 shadow-2xl ring-1 ring-slate-200"
            >
              <div className="flex flex-col items-center text-center">
                <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
                  confirmModal.type === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {confirmModal.type === 'danger' ? (
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : (
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                
                <h3 className="text-xl font-bold text-slate-900">{confirmModal.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{confirmModal.message}</p>
                
                <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row">
                  <button 
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmModal.onConfirm}
                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition ${
                      confirmModal.type === 'danger' 
                        ? 'bg-rose-600 shadow-rose-200 hover:bg-rose-500' 
                        : 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-500'
                    }`}
                  >
                    {confirmModal.confirmText}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Application Details Modal */}
      <AnimatePresence>
        {detailsModal.isOpen && detailsModal.application && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailsModal({ isOpen: false, application: null })}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 p-6 sm:px-8">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{detailsModal.application.internshipId?.title || 'Application Details'}</h3>
                  <p className="text-sm font-medium text-violet-600 mt-1">
                    {detailsModal.application.internshipId?.companyProfile?.companyName || 'Review your application submission'}
                  </p>
                </div>
                <button 
                  onClick={() => setDetailsModal({ isOpen: false, application: null })}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
                {/* 0. Internship Overview Grid */}
                <section>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {detailsModal.application.internshipId?.department && (
                      <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department</p>
                        <p className="text-sm font-semibold text-slate-700">{detailsModal.application.internshipId.department}</p>
                      </div>
                    )}
                    {detailsModal.application.internshipId?.duration && (
                      <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Duration</p>
                        <p className="text-sm font-semibold text-slate-700">{detailsModal.application.internshipId.duration}</p>
                      </div>
                    )}
                    {(detailsModal.application.internshipId?.isPaid || detailsModal.application.internshipId?.stipend) && (
                      <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Stipend</p>
                        <p className="text-sm font-semibold text-emerald-600">
                          {detailsModal.application.internshipId.isPaid ? (detailsModal.application.internshipId.stipend || 'Paid') : 'Unpaid'}
                        </p>
                      </div>
                    )}
                    {detailsModal.application.internshipId?.startDate && (
                      <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Date</p>
                        <p className="text-sm font-semibold text-slate-700">
                          {new Date(detailsModal.application.internshipId.startDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {detailsModal.application.internshipId?.studentsNeeded && (
                      <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Openings</p>
                        <p className="text-sm font-semibold text-slate-700">{detailsModal.application.internshipId.studentsNeeded} Positions</p>
                      </div>
                    )}
                    {detailsModal.application.internshipId?.programType && (
                      <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Program Type</p>
                        <p className="text-sm font-semibold text-violet-600">{detailsModal.application.internshipId.programType}</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* 1. Internship Info */}
                <section>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800">Internship Description</h4>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-5">
                    <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
                      {detailsModal.application.internshipId?.description || 'No description provided for this internship.'}
                    </p>
                  </div>
                </section>

                {/* 2. Requirements & Skills */}
                {(detailsModal.application.internshipId?.requirements?.length > 0 || detailsModal.application.internshipId?.requiredSkills?.length > 0) && (
                  <section>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-12 w-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                      </div>
                      <h4 className="text-lg font-bold text-slate-800">Requirements & Skills</h4>
                    </div>
                    
                    <div className="space-y-4">
                      {detailsModal.application.internshipId.requiredSkills?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Technical Skills</p>
                          <div className="flex flex-wrap gap-2">
                            {detailsModal.application.internshipId.requiredSkills.map((skill, i) => (
                              <span key={i} className="rounded-lg bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {detailsModal.application.internshipId.requirements?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">General Requirements</p>
                          <ul className="grid grid-cols-1 gap-2">
                            {detailsModal.application.internshipId.requirements.map((req, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 bg-white border border-slate-100 rounded-xl p-3">
                                <svg className="h-4 w-4 text-sky-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                {req}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* 3. Cover Letter */}
                <section>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800">Your Cover Letter</h4>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/30 p-5">
                    <p className="text-sm leading-relaxed text-slate-600 italic whitespace-pre-wrap">
                      {detailsModal.application.coverLetter || 'You did not include a cover letter with this application.'}
                    </p>
                  </div>
                </section>

                {/* 4. Application Timeline */}
                <section>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800">Application Timeline</h4>
                  </div>
                  <div className="space-y-4 border-l-2 border-slate-100 ml-6 pl-6">
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white" />
                      <p className="text-sm font-bold text-slate-800">Application Submitted</p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(detailsModal.application.createdAt).toLocaleString()}</p>
                    </div>
                    {detailsModal.application.timeline?.map((event, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-violet-500 ring-4 ring-white" />
                        <p className="text-sm font-bold text-slate-800">{event.status}</p>
                        <p className="text-xs text-slate-400 mt-1">{new Date(event.date).toLocaleString()}</p>
                        {event.comment && <p className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg italic">"{event.comment}"</p>}
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50 p-6 text-center">
                <button 
                  onClick={() => setDetailsModal({ isOpen: false, application: null })}
                  className="rounded-xl bg-slate-900 px-8 py-3 text-sm font-bold text-white transition hover:bg-slate-800 shadow-lg shadow-slate-200"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
