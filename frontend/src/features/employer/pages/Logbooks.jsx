import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { employerAPI } from '../employerAPI';

const STATUS_CONFIG = {
  Draft: { color: 'text-slate-500 bg-slate-50 border-slate-200', label: 'Draft' },
  Submitted: { color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'To Check' },
  'Approved by Company': { color: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Accepted' },
  'Approved by University': { color: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Final Approval' },
  'Needs Revision': { color: 'text-rose-600 bg-rose-50 border-rose-200', label: 'Returned' },
  Declined: { color: 'text-rose-600 bg-rose-50 border-rose-200', label: 'Declined' }
};

export default function EmployerLogbooks() {
  const [logbooks, setLogbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLogbook, setSelectedLogbook] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState(null); // Success/Error messages

  // Review form states
  const [reviewMode, setReviewMode] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [scores, setScores] = useState({ technical: 5, communication: 5, teamwork: 5 });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  useEffect(() => {
    fetchLogbooks();
  }, []);

  const fetchLogbooks = async () => {
    try {
      setLoading(true);
      const { data } = await employerAPI.getLogbooks();
      setLogbooks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load logbooks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id, status, feedbackText, performanceScores) => {
    try {
      setIsSubmitting(true);
      await employerAPI.reviewLogbook(id, {
        status,
        feedback: feedbackText,
        performanceScores
      });

      setLogbooks(prev => prev.map(lb => lb._id === id ? {
        ...lb,
        companyStatus: status,
        companyFeedback: feedbackText,
        performanceScores,
        status: status === 'Approved' ? 'Approved by Company' : status
      } : lb));

      if (selectedLogbook?._id === id) {
        setSelectedLogbook(null);
      }
      setReviewMode(false);
      setMsg({ type: 'success', text: 'Report approved successfully!' });
      setTimeout(() => setMsg(null), 5000);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to process review.' });
      setTimeout(() => setMsg(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLogbooks = useMemo(() => {
    let result = logbooks;
    if (activeTab !== 'All') {
      result = result.filter(log => {
        if (activeTab === 'Pending') return log.status === 'Submitted';
        if (activeTab === 'Approved') return log.status.includes('Approved');
        if (activeTab === 'Needs Revision') return log.status === 'Needs Revision';
        return true;
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(log =>
        log.studentId?.fullName?.toLowerCase().includes(q) ||
        log.title?.toLowerCase().includes(q) ||
        log.weekNumber?.toString() === q
      );
    }
    return result;
  }, [logbooks, searchQuery, activeTab]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-12 py-8 pb-32 relative">
      <AnimatePresence>
        {msg && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-8 py-4 rounded-[24px] shadow-2xl font-black uppercase tracking-widest text-sm border-2 ${
              msg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {msg.type === 'success' ? '✅' : '❌'} {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-[24px] bg-cyan-700 flex items-center justify-center text-white shadow-2xl shadow-cyan-200">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <div>
            <h1 className="text-5xl font-black tracking-tight text-slate-900">Student Reports</h1>
            <p className="text-lg text-slate-500 font-medium mt-1">View and approve weekly work from your students.</p>
          </div>
        </div>
      </div>

      <div className="w-full px-6 lg:px-8 space-y-20">
        <div className="space-y-10">
          <div className="flex flex-col gap-10 border-b border-slate-100 pb-12 px-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="flex-1">
                <h3 className="text-4xl font-black text-slate-900 tracking-tight">Reports to Check</h3>
                <p className="text-[14px] font-black text-slate-800 uppercase tracking-widest mt-2">All reports from students</p>
              </div>

              <div className="flex flex-wrap gap-3 bg-white p-2 rounded-[32px] shadow-2xl shadow-slate-200/50 border-2 border-slate-50">
                {[{ id: 'All', label: 'All' }, { id: 'Pending', label: 'To Check' }, { id: 'Needs Revision', label: 'Returned' }, { id: 'Approved', label: 'Accepted' }].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-8 py-4 rounded-[24px] text-xs font-black uppercase tracking-[0.2em] transition-all transform active:scale-95 ${activeTab === tab.id
                        ? 'bg-cyan-700 text-white shadow-xl shadow-cyan-200'
                        : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-[12px] font-black text-slate-900 uppercase tracking-widest ml-1">Search Reports</label>
              <div className="flex items-center bg-white rounded-[40px] shadow-2xl shadow-slate-200/60 border-2 border-slate-200 px-8 py-6 focus-within:border-cyan-600 focus-within:ring-8 focus-within:ring-cyan-50 transition-all group">
                <span className="text-3xl text-cyan-700 opacity-60 mr-5 group-focus-within:opacity-100 transition-opacity">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name or title..."
                  className="flex-1 bg-transparent border-none outline-none text-2xl font-black text-slate-900 placeholder:text-slate-200 placeholder:font-bold"
                />
              </div>
            </div>
          </div>

          {filteredLogbooks.length === 0 ? (
            <div className="rounded-[40px] bg-white py-32 text-center border-2 border-dashed border-slate-100 shadow-inner">
              <div className="text-6xl mb-6 opacity-10">📂</div>
              <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">
                {searchQuery || activeTab !== 'All' ? 'No matches found' : 'No reports found yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                {filteredLogbooks.map(log => (
                  <div key={log._id} className="group relative rounded-[48px] bg-white p-10 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200/60 hover:border-cyan-200 transition-all cursor-default overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-8">
                        <div className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 ${STATUS_CONFIG[log.status]?.color || 'bg-slate-50 text-slate-500'}`}>
                          {STATUS_CONFIG[log.status]?.label || log.status}
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Week {log.weekNumber}</span>
                          <span className="text-[10px] font-bold text-slate-300 mt-1">{new Date(log.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                          {log.studentId?.profileImage ? (
                            <img src={log.studentId.profileImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xl">👤</span>
                          )}
                        </div>
                        <h4 className="text-xl font-black text-slate-900 line-clamp-1">{log.studentId?.fullName}</h4>
                      </div>

                      <p className="text-sm font-bold text-cyan-700 uppercase tracking-widest mb-4 line-clamp-1">{log.title || 'Untitled Report'}</p>
                      <p className="text-lg font-medium text-slate-500 line-clamp-3 mb-10 leading-relaxed h-[84px] overflow-hidden">{log.summary}</p>
                    </div>

                    <div className="flex items-center justify-between pt-8 border-t border-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-lg">⏱️</div>
                        <span className="text-sm font-black text-slate-900">{log.hoursWorked}h</span>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => {
                          setSelectedLogbook(log);
                          setReviewMode(log.status === 'Submitted' || log.status === 'Needs Revision');
                          setFeedback(log.companyFeedback || '');
                          setScores(log.performanceScores || { technical: 5, communication: 5, teamwork: 5 });
                        }} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-700 transition-all shadow-xl shadow-slate-200">
                          {log.status === 'Submitted' ? 'Check Report' : 'View Report'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedLogbook && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedLogbook(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-[48px] shadow-2xl p-8 sm:p-14"
            >
              <button onClick={() => setSelectedLogbook(null)} className="absolute right-8 top-8 rounded-full bg-slate-50 p-4 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              <div className="mb-12">
                <div className={`inline-block px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 ${STATUS_CONFIG[selectedLogbook.status]?.color || 'bg-slate-50 text-slate-500'}`}>
                  {STATUS_CONFIG[selectedLogbook.status]?.label || selectedLogbook.status}
                </div>
                <h2 className="mt-6 text-4xl font-black text-slate-900">Week {selectedLogbook.weekNumber} Report</h2>
                <div className="mt-6 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-[24px] bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                    {selectedLogbook.studentId?.profileImage ? (
                      <img src={selectedLogbook.studentId.profileImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-3xl">👤</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xl font-black text-slate-900 leading-none">{selectedLogbook.studentId?.fullName}</p>
                    <p className="text-sm font-bold text-cyan-600 uppercase mt-2 tracking-widest">{selectedLogbook.title}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-12 pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 flex items-center gap-6 shadow-sm">
                    <span className="text-4xl opacity-40">⏱️</span>
                    <div>
                      <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-1">Hours Worked</p>
                      <p className="text-3xl font-black text-slate-900">{selectedLogbook.hoursWorked || 0} Hrs</p>
                    </div>
                  </div>
                  {selectedLogbook.fileUrl && (
                    <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 flex items-center gap-6 shadow-sm">
                      <span className="text-4xl opacity-40">📄</span>
                      <div>
                        <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-1">Evidence attached</p>
                        <a href={selectedLogbook.fileUrl.startsWith('/') ? `http://localhost:5000${selectedLogbook.fileUrl}` : selectedLogbook.fileUrl} target="_blank" rel="noreferrer" className="text-cyan-700 font-black hover:underline">View Evidence</a>
                      </div>
                    </div>
                  )}
                </div>

                <section>
                  <p className="text-[12px] font-black uppercase tracking-widest text-slate-400 mb-4">Skills Applied</p>
                  <div className="relative group min-h-[76px] w-full rounded-[24px] border-2 border-slate-100 bg-white pl-16 pr-4 py-4 flex flex-wrap gap-2 items-center shadow-sm">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl opacity-40">🛠️</span>
                    {selectedLogbook.skills?.length > 0 ? (
                      selectedLogbook.skills.map(s => (
                        <span key={s} className="bg-cyan-100 text-cyan-700 text-[12px] font-black px-4 py-2 rounded-xl flex items-center gap-1 border border-cyan-200">
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400 italic">No specific skills listed</span>
                    )}
                  </div>
                </section>

                <section>
                  <p className="text-[12px] font-black uppercase tracking-widest text-slate-400 mb-4">Work Description</p>
                  <div className="rounded-[32px] bg-slate-50 p-8 border border-slate-100 shadow-sm">
                    <p className="text-lg font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">{selectedLogbook.summary}</p>
                  </div>
                </section>

                {selectedLogbook.goals?.[0]?.text && (
                  <section>
                    <p className="text-[12px] font-black uppercase tracking-widest text-slate-400 mb-4">Achievement</p>
                    <div className="rounded-[32px] bg-cyan-50/50 p-8 border border-cyan-100 shadow-sm">
                      <p className="text-lg font-bold text-cyan-900">✨ {selectedLogbook.goals[0].text}</p>
                    </div>
                  </section>
                )}

                <section className="pt-12 border-t border-slate-100">
                  <h3 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Your Feedback</h3>

                  {reviewMode ? (
                    <div className="space-y-10">
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                        {['Technical', 'Communication', 'Teamwork'].map((skill) => (
                          <div key={skill} className="bg-white p-6 rounded-[24px] border-2 border-slate-100 shadow-sm">
                            <label className="text-[12px] font-black uppercase tracking-widest text-slate-800 block mb-4">{skill}</label>
                            <input 
                              type="number" 
                              min="1" 
                              max="10" 
                              value={scores[skill.toLowerCase()]} 
                              onChange={(e) => {
                                let val = parseInt(e.target.value);
                                if (isNaN(val)) val = 1;
                                val = Math.min(10, Math.max(1, val));
                                setScores({ ...scores, [skill.toLowerCase()]: val });
                              }} 
                              className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 text-2xl font-black text-cyan-700 outline-none focus:border-cyan-400 focus:bg-white transition-all text-center" 
                            />
                            <p className="text-center mt-2 text-[10px] font-black text-slate-400 uppercase">Out of 10</p>
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="text-[12px] font-black uppercase tracking-widest text-slate-800 block mb-4 ml-1">Feedback / Comments</label>
                        <textarea placeholder="Write your feedback..." rows={4} className="w-full rounded-[32px] border-2 border-slate-100 bg-white p-8 text-lg font-medium text-slate-700 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-50 transition-all outline-none shadow-inner" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <button onClick={() => handleReview(selectedLogbook._id, 'Approved', feedback, scores)} disabled={isSubmitting} className="flex-1 rounded-full bg-cyan-700 py-5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-cyan-200 hover:bg-cyan-800 transition-all active:scale-95 disabled:opacity-50">
                          {isSubmitting ? 'Saving...' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="grid grid-cols-3 gap-6">
                        {['Technical', 'Communication', 'Teamwork'].map((s) => (
                          <div key={s} className="rounded-[32px] bg-white p-6 border-2 border-slate-100 text-center shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{s}</p>
                            <p className="text-3xl font-black text-cyan-700">{selectedLogbook.performanceScores?.[s.toLowerCase()] || 0}/10</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-[32px] bg-slate-50 p-8 border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Mentor Feedback</p>
                        <p className="text-lg font-bold text-slate-700 italic leading-relaxed">"{selectedLogbook.companyFeedback || 'No feedback provided.'}"</p>
                      </div>
                      <button onClick={() => { setReviewMode(true); }} className="w-full rounded-full border-2 border-slate-100 bg-white py-5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all active:scale-95">
                        Change Feedback
                      </button>
                    </div>
                  )}
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
