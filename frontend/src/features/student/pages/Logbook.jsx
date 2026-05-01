import React, { useEffect, useState, useMemo } from 'react';
import api from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const STATUS_CONFIG = {
  Draft: { color: 'text-slate-500 bg-slate-100', label: 'Draft' },
  Submitted: { color: 'text-amber-600 bg-amber-50', label: 'Pending Review' },
  'Approved by Company': { color: 'text-cyan-700 bg-cyan-50', label: 'Company Approved' },
  'Approved by University': { color: 'text-cyan-700 bg-cyan-50', label: 'Final Approved' },
  'Needs Revision': { color: 'text-rose-600 bg-rose-50', label: 'Needs Revision' },
  Declined: { color: 'text-rose-600 bg-rose-50', label: 'Declined' }
};

export default function LogbookPage() {
  const [internship, setInternship] = useState(null);
  const [logbooks, setLogbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState({});
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [attachmentMode, setAttachmentMode] = useState('url'); // 'file' or 'url'
  const [selectedFile, setSelectedFile] = useState(null);

  const [form, setForm] = useState({
    title: '',
    weekNumber: '',
    hoursWorked: '',
    category: 'Development',
    skills: '',
    outcome: '',
    whatDidYouDo: '',
    fileUrl: ''
  });

  const loadData = async () => {
    try {
      const [internRes, logRes] = await Promise.all([
        api.get('/logbook/my-internship'),
        api.get('/logbook/mine')
      ]);
      setInternship(internRes.data);
      setLogbooks(logRes.data);
      
      if (!internRes.data || !internRes.data.internshipId) {
        setLoading(false);
        return;
      }
      let nextWeek = 1;
      
      const logs = logRes.data;
      if (logs.length > 0) {
        // Find max week number among non-drafts
        const submittedLogs = logs.filter(l => l.status !== 'Draft');
        const maxSubmittedWeek = submittedLogs.length > 0 
          ? Math.max(...submittedLogs.map(l => l.weekNumber || 0))
          : 0;
        nextWeek = maxSubmittedWeek + 1;
      }
      
      setForm(prev => ({ ...prev, weekNumber: nextWeek.toString() }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDraft = (log) => {
    // Parse summary to extract fields
    const summary = log.summary || '';
    const categoryMatch = summary.match(/\*\*Category:\*\* (.*)/);
    const skillsMatch = summary.match(/\*\*Skills:\*\* (.*)/);
    const outcomeMatch = summary.match(/\*\*Outcome:\*\* (.*)/);
    const detailsMatch = summary.split('**Details:**\n');

    setForm({
      title: log.title || '',
      weekNumber: (log.weekNumber || '').toString(),
      hoursWorked: (log.hoursWorked || '').toString(),
      category: categoryMatch ? categoryMatch[1] : 'Development',
      skills: skillsMatch ? (skillsMatch[1] === 'None' ? '' : skillsMatch[1]) : '',
      outcome: outcomeMatch ? (outcomeMatch[1] === 'Pending' ? '' : outcomeMatch[1]) : '',
      whatDidYouDo: detailsMatch.length > 1 ? detailsMatch[1] : summary,
      fileUrl: log.fileUrl || ''
    });

    if (log.fileUrl) {
      setAttachmentMode(log.fileUrl.startsWith('/uploads') ? 'file' : 'url');
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMsg({ type: 'success', text: 'Draft loaded. You can continue writing.' });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e, type = 'Submitted') => {
    if (e) e.preventDefault();
    setMsg({ type: '', text: '' });
    
    if (type === 'Submitted' && !form.whatDidYouDo.trim()) {
      setMsg({ type: 'error', text: 'Please describe your activities before submitting.' });
      return;
    }

    if (!internship?.internshipId) {
      setMsg({ type: 'error', text: 'Critical Error: No internship ID associated with your session.' });
      return;
    }

    try {
      setSubmitting(true);
      const formattedSummary = `**Category:** ${form.category}\n**Skills:** ${form.skills || 'None'}\n**Outcome:** ${form.outcome || 'Pending'}\n\n**Details:**\n${form.whatDidYouDo}`;
      
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('summary', formattedSummary);
      formData.append('internshipId', internship?.internshipId);
      formData.append('weekNumber', Number(form.weekNumber));
      formData.append('hoursWorked', Number(form.hoursWorked || 0));
      formData.append('status', type);
      
      if (attachmentMode === 'file' && selectedFile) {
        formData.append('file', selectedFile);
      } else {
        formData.append('fileUrl', form.fileUrl);
      }
      
      await api.post('/logbook', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setMsg({ 
        type: 'success', 
        text: type === 'Draft' ? 'Draft saved successfully.' : 'Report submitted and archived successfully.' 
      });
      
      if (type === 'Submitted') {
        setForm(prev => ({
          ...prev, title: '', whatDidYouDo: '', category: 'Development', skills: '', outcome: '', hoursWorked: '', fileUrl: '', weekNumber: (Number(prev.weekNumber) + 1).toString()
        }));
        setSelectedFile(null);
      }
      
      // Automatic data refresh for both Draft and Submitted
      loadData();
      
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.message || 'Transaction failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLogExpansion = (id) => setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));

  const renderSummary = (text) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-cyan-700 font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const getCleanSummaryPreview = (text) => {
    if (!text) return '';
    return text.replace(/\*\*/g, '').replace(/\n/g, ' ');
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
       <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-700 border-t-transparent" />
    </div>
  );

  if (!internship || !internship.internshipId) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-10 text-center">
       <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-6">📂</div>
       <h2 className="text-2xl font-bold text-slate-900 mb-2">No Active Internship Found</h2>
       <p className="text-slate-500 max-w-md">You need to have an "Accepted" internship application to access the logbook system. Please make sure your employer has accepted your application.</p>
       <button onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-cyan-700 px-6 py-2 text-sm font-semibold text-white">Retry Connection</button>
    </div>
  );

  return (
    <div className="space-y-6 w-full">
      <div className="w-full space-y-6">
        
        <div className="student-panel rounded-[34px] border border-cyan-100 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.22),transparent_35%),linear-gradient(180deg,#ecfeff_0%,#ffffff_55%)] p-6 shadow-[0_24px_70px_rgba(14,116,144,0.14)] lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700 mb-3">Internship Logbook</p>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <h1 className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
               Week {form.weekNumber} Activity
            </h1>
            <div className="flex items-center gap-2">
              <span className="rounded-2xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-md">
                {internship?.internshipTitle || 'Active Session'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-[34px] border border-cyan-100 bg-white p-8 shadow-[0_12px_30px_rgba(14,116,144,0.08)] lg:p-10">
              <div className="mb-8 border-b border-slate-100 pb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">New Entry</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Record Progress</h3>
                <p className="mt-2 text-sm text-slate-500 italic">Fields marked with <span className="text-rose-500">*</span> are mandatory</p>
              </div>

              {msg.text && (
                <div className={`mb-8 rounded-2xl p-6 border text-base font-medium ${msg.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                   {msg.text}
                </div>
              )}

              <form onSubmit={(e) => handleSubmit(e, 'Submitted')} className="space-y-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold uppercase tracking-[0.15em] text-cyan-700 ml-1">Task Title <span className="text-rose-500">*</span></label>
                    <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-base text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500" placeholder="E.g., API Implementation" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold uppercase tracking-[0.15em] text-cyan-700 ml-1">Category <span className="text-rose-500">*</span></label>
                    <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-base text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 appearance-none">
                      <option>Development</option><option>Meeting</option><option>Research</option><option>Documentation</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold uppercase tracking-[0.15em] text-cyan-700 ml-1">Skills Used</label>
                    <input type="text" value={form.skills} onChange={e => setForm({...form, skills: e.target.value})} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-base text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500" placeholder="E.g., React, Node.js" />
                  </div>
                  <div className="flex gap-6">
                     <div className="flex-1 space-y-2">
                        <label className="block text-sm font-bold uppercase tracking-[0.15em] text-cyan-700 ml-1">Outcome</label>
                        <input type="text" value={form.outcome} onChange={e => setForm({...form, outcome: e.target.value})} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-base text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500" placeholder="E.g., Feature Complete" />
                     </div>
                     <div className="w-28 shrink-0 space-y-2">
                        <label className="block text-sm font-bold uppercase tracking-[0.15em] text-cyan-700 ml-1">Hours <span className="text-rose-500">*</span></label>
                        <input type="number" value={form.hoursWorked} onChange={e => setForm({...form, hoursWorked: e.target.value})} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-base text-slate-900 text-center font-bold focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500" placeholder="0" />
                     </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold uppercase tracking-[0.15em] text-cyan-700 ml-1">Detailed Description <span className="text-rose-500">*</span></label>
                  <textarea value={form.whatDidYouDo} onChange={e => setForm({...form, whatDidYouDo: e.target.value})} className="min-h-[160px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-base text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 leading-relaxed" placeholder="Explain what you accomplished this week in detail..." />
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-sm font-semibold text-slate-900">Attach Work/Document</p>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button type="button" onClick={() => setAttachmentMode('url')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${attachmentMode === 'url' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500'}`}>URL Link</button>
                      <button type="button" onClick={() => setAttachmentMode('file')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${attachmentMode === 'file' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500'}`}>File Upload</button>
                    </div>
                  </div>

                  {attachmentMode === 'url' ? (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Provide a GitHub, Google Drive, or Cloud Link</p>
                      <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500 transition-all">
                        <div className="px-5 text-slate-400">🔗</div>
                        <input type="text" value={form.fileUrl} onChange={e => setForm({...form, fileUrl: e.target.value})} className="w-full bg-transparent px-2 py-4 text-sm outline-none font-medium" placeholder="https://github.com/your-project..." />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Upload PDF, DOCX, or Images (Max 10MB)</p>
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 hover:bg-slate-100 hover:border-cyan-500 cursor-pointer transition-all group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <p className="text-sm text-slate-500 font-semibold group-hover:text-cyan-700">{selectedFile ? selectedFile.name : 'Click to select or drag & drop'}</p>
                          <p className="text-xs text-slate-400 mt-1">PDF, DOCX, PNG, JPG</p>
                        </div>
                        <input type="file" className="hidden" onChange={e => setSelectedFile(e.target.files[0])} accept=".pdf,.docx,.png,.jpg,.jpeg" />
                      </label>
                      {selectedFile && (
                        <div className="flex items-center justify-between p-3 bg-cyan-50 rounded-xl border border-cyan-100">
                          <span className="text-xs font-semibold text-cyan-700 truncate max-w-[200px]">{selectedFile.name}</span>
                          <button type="button" onClick={() => setSelectedFile(null)} className="text-rose-500 text-xs font-bold hover:underline">Remove</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button type="submit" disabled={submitting} className="rounded-2xl bg-cyan-700 px-10 py-4 text-sm font-bold uppercase tracking-[0.15em] text-white shadow-lg shadow-cyan-700/20 hover:bg-cyan-800 transition-all active:scale-95 disabled:opacity-50">
                    {submitting ? 'Processing...' : 'Submit Log'}
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
               <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 pl-2">Submission History</p>
               {logbooks.length === 0 && (
                 <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No logs found.</div>
               )}
               {logbooks.map(log => (
                 <div key={log._id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
                   <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                           <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">WK {log.weekNumber}</span>
                           <span className={`rounded-full px-3 py-0.5 text-[9px] font-bold uppercase tracking-widest ${STATUS_CONFIG[log.status]?.color || 'bg-slate-100 text-slate-500'}`}>
                             {STATUS_CONFIG[log.status]?.label || log.status}
                           </span>
                           <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className="text-2xl font-bold text-slate-900 mb-1">{log.title || 'Weekly Log'}</h4>
                      </div>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => toggleLogExpansion(log._id)} className="text-sm font-bold text-cyan-600 hover:text-cyan-800 bg-slate-50 px-4 py-2 rounded-lg">
                          {expandedLogs[log._id] ? 'Less' : 'View Details'}
                        </button>
                      </div>
                   </div>
                   
                   {!expandedLogs[log._id] && (
                     <p className="mt-4 text-lg text-slate-600 leading-relaxed line-clamp-2">{getCleanSummaryPreview(log.summary)}</p>
                   )}

                   {(log.status === 'Declined' || log.status === 'Needs Revision') && log.companyFeedback && (
                      <div className="mt-4 rounded-xl bg-rose-50 p-6 border border-rose-100">
                        <p className="text-xs font-bold uppercase tracking-widest text-rose-600 mb-2">Critical Mentor Feedback</p>
                        <p className="text-lg font-medium text-slate-900">{log.companyFeedback}</p>
                      </div>
                   )}

                   <AnimatePresence>
                      {expandedLogs[log._id] && (
                         <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="mt-6 border-t border-slate-100 pt-6 space-y-6">
                               <div className="rounded-2xl bg-slate-50 p-6 border border-slate-100">
                                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Student Log ({log.hoursWorked || 0} Hours)</p>
                                  <div className="text-lg text-slate-700 whitespace-pre-wrap leading-relaxed">{renderSummary(log.summary)}</div>
                               </div>
                               {log.companyFeedback && (log.status !== 'Declined' && log.status !== 'Needs Revision') && (
                                  <div className="rounded-2xl bg-cyan-50 p-6 border border-cyan-100">
                                     <p className="text-xs font-bold uppercase tracking-widest text-cyan-700 mb-3">Supervisor Feedback</p>
                                     <p className="text-lg text-slate-900 leading-relaxed">{log.companyFeedback}</p>
                                  </div>
                               )}
                            </div>
                         </motion.div>
                      )}
                   </AnimatePresence>
                 </div>
               ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[34px] border border-cyan-100 bg-white p-8 shadow-[0_12px_30px_rgba(14,116,144,0.08)] lg:p-10">
               <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700 mb-8">Performance Summary</p>
               <div className="space-y-8">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Total Hours Logged</p>
                    <p className="text-4xl font-bold tracking-tight text-slate-900">
                      {logbooks.filter(l => l.status !== 'Draft').reduce((acc, l) => acc + (l.hoursWorked || 0), 0)}
                      <span className="text-lg text-slate-400 font-medium ml-2">hrs</span>
                    </p>
                  </div>
                  <div className="h-px w-full bg-slate-100"></div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Approved Tasks</p>
                    <p className="text-4xl font-bold tracking-tight text-slate-900">{logbooks.filter(l => l.status.includes('Approved')).length}</p>
                  </div>
               </div>
            </div>

            <div className="rounded-[34px] border border-cyan-100 bg-white p-8 shadow-[0_12px_30px_rgba(14,116,144,0.08)] lg:p-10">
               <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700 mb-6">Assigned Mentor</p>
               <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.22),transparent_35%),linear-gradient(180deg,#ecfeff_0%,#ffffff_55%)] text-cyan-700 font-bold text-xl border border-cyan-100 shadow-sm">
                     {internship?.mentor?.name?.charAt(0) || 'M'}
                  </div>
                  <div>
                     <p className="text-lg font-semibold text-slate-900">{internship?.mentor?.name || 'Pending Mentor'}</p>
                     <p className="text-sm text-slate-500 font-medium">{internship?.companyName || 'Company'}</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
