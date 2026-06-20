import React, { useEffect, useState, useMemo } from 'react';
import api from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_CONFIG = {
  Draft: { color: 'text-slate-500 bg-slate-50 border-slate-200', label: 'Draft' },
  Submitted: { color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Waiting for Review' },
  'Approved by Company': { color: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Mentor Approved' },
  'Approved by University': { color: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Final Approval' },
  'Needs Revision': { color: 'text-rose-600 bg-rose-50 border-rose-200', label: 'Fix Requested' },
  Declined: { color: 'text-rose-600 bg-rose-50 border-rose-200', label: 'Declined' }
};

export default function LogbookPage() {
  const [internship, setInternship] = useState(null);
  const [logbooks, setLogbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [attachmentMode, setAttachmentMode] = useState('url'); 
  const [selectedFile, setSelectedFile] = useState(null);
  const [skillInput, setSkillInput] = useState('');
  const [expandedLog, setExpandedLog] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const itemsPerPage = 6;

  const [form, setForm] = useState({
    title: '',
    weekNumber: '1',
    hoursWorked: '',
    skills: [],
    outcome: '',
    whatDidYouDo: '',
    fileUrl: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [internRes, logRes] = await Promise.all([
        api.get('/logbook/my-internship'),
        api.get('/logbook/mine')
      ]);
      setInternship(internRes.data);
      setLogbooks(logRes.data);
      
      if (!internRes.data || !internRes.data.internshipId) return;

      const logs = logRes.data;
      let nextWeek = 1;
      if (logs.length > 0) {
        const maxSubmittedWeek = Math.max(...logs.map(l => l.weekNumber || 0), 0);
        nextWeek = maxSubmittedWeek + 1;
      }
      setForm(prev => ({ ...prev, weekNumber: nextWeek.toString() }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredLogs = useMemo(() => {
    let result = logbooks;
    if (activeTab !== 'All') {
      result = result.filter(log => {
        if (activeTab === 'Drafts') return log.status === 'Draft';
        if (activeTab === 'Pending') return log.status === 'Submitted';
        if (activeTab === 'Approved') return log.status.includes('Approved');
        if (activeTab === 'Needs Revision') return log.status === 'Needs Revision';
        return true;
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(log => 
        log.weekNumber?.toString() === q ||
        log.title?.toLowerCase().includes(q) ||
        log.summary?.toLowerCase().includes(q) ||
        log.skills?.some(s => s.toLowerCase().includes(q))
      );
    }
    return result;
  }, [logbooks, searchQuery, activeTab]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleAddSkill = (skill) => {
    if (!skill.trim()) return;
    const newSkills = skill.split(',').map(s => s.trim()).filter(Boolean);
    setForm(prev => {
        const combined = [...prev.skills, ...newSkills];
        return { ...prev, skills: [...new Set(combined)] };
    });
    setSkillInput('');
  };

  const removeSkill = (skill) => {
    setForm(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));
  };

  const loadDraft = (log) => {
    setForm({
      title: log.title || '',
      weekNumber: (log.weekNumber || '').toString(),
      hoursWorked: (log.hoursWorked || '').toString(),
      skills: log.skills || [],
      outcome: log.goals?.[0]?.text || '',
      whatDidYouDo: log.summary || '',
      fileUrl: log.fileUrl || ''
    });
    setMsg({ type: 'success', text: 'Report details loaded. You can finish it now.' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteDraft = async (id) => {
    try {
      await api.delete(`/logbook/${id}`);
      setMsg({ type: 'success', text: 'Report deleted successfully.' });
      loadData();
    } catch (e) {
      console.error(e);
      setMsg({ type: 'error', text: e.response?.data?.message || 'Failed to delete draft.' });
    }
  };

  const handleDownloadPDF = (log) => {
    try {
        const element = document.getElementById(`report-detail-${log._id}`);
        if (!element) return;
        
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        
        const printDocument = iframe.contentWindow.document;
        printDocument.write('<html><head><title>Logbook_Report</title>');
        
        const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
        styles.forEach(style => {
            printDocument.write(style.outerHTML);
        });

        printDocument.write(`
            <style>
                @media print {
                    @page { margin: 20mm; }
                    body { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important;
                        font-family: system-ui, -apple-system, sans-serif;
                    }
                    .print-header { border-bottom: 2px solid #e2e8f0; margin-bottom: 30px; padding-bottom: 20px; }
                    .print-logo { height: 60px; width: auto; }
                }
            </style>
        `);

        printDocument.write('</head><body class="p-4 bg-white">');
        
        printDocument.write(`
            <div class="max-w-4xl mx-auto">
                <div class="print-header flex items-center justify-between">
                    <div>
                        <h1 class="text-4xl font-black text-slate-900 tracking-tight">Weekly Performance Report</h1>
                        <p class="text-[14px] font-black text-cyan-700 uppercase tracking-widest mt-2">
                            ${log.studentId?.fullName || 'Student'} • Week ${log.weekNumber}
                        </p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Generated On</p>
                        <p class="text-sm font-bold text-slate-900">${new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="mt-8">
                    ${element.innerHTML}
                </div>
                <div class="mt-20 pt-8 border-t border-slate-100 flex justify-between items-end">
                    <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Official Digital Record</p>
                        <div class="h-10 w-48 bg-slate-50 rounded-lg border border-slate-100 border-dashed flex items-center justify-center text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                            Verified Logbook Entry
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">System Hash</p>
                        <p class="text-[8px] font-mono text-slate-300">SN-${log._id.substring(0, 8).toUpperCase()}</p>
                    </div>
                </div>
            </div>
        `);
        
        printDocument.write('</body></html>');
        printDocument.close();
        
        // Wait for all images to load inside the iframe before printing
        const images = iframe.contentWindow.document.images;
        const totalImages = images.length;
        let loadedImages = 0;

        const checkReady = () => {
            loadedImages++;
            if (loadedImages >= totalImages) {
                setTimeout(() => {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                    }, 1000);
                }, 500);
            }
        };

        if (totalImages === 0) {
            checkReady();
        } else {
            for (let i = 0; i < totalImages; i++) {
                if (images[i].complete) {
                    checkReady();
                } else {
                    images[i].onload = checkReady;
                    images[i].onerror = checkReady;
                }
            }
        }
        
    } catch (err) {
        console.error("PDF generation error:", err);
        alert("Failed to generate PDF. Please try again.");
    }
  };

  const handleSubmit = async (e, type = 'Submitted') => {
    if (e) e.preventDefault();
    setMsg({ type: '', text: '' });
    if (type === 'Submitted' && (!form.whatDidYouDo.trim() || !form.title.trim())) {
      setMsg({ type: 'error', text: 'Please fill in the Task Name and Description.' });
      return;
    }
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('summary', form.whatDidYouDo);
      formData.append('internshipId', internship?.internshipId);
      formData.append('weekNumber', Number(form.weekNumber));
      formData.append('status', type);
      // Capture any un-added skills still in the text box
      let finalSkills = [...form.skills];
      if (skillInput.trim()) {
          const pendingSkills = skillInput.split(',').map(s => s.trim()).filter(Boolean);
          finalSkills = [...new Set([...finalSkills, ...pendingSkills])];
      }

      finalSkills.forEach(s => formData.append('skills[]', s));
      if (form.outcome) formData.append('goals[0][text]', form.outcome);
      
      // Handle file URL or File Upload attachment
      if (attachmentMode === 'file' && selectedFile) {
          formData.append('file', selectedFile);
      } else if (attachmentMode === 'url' && form.fileUrl) {
          formData.append('fileUrl', form.fileUrl);
      }

      await api.post('/logbook', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMsg({ type: 'success', text: type === 'Draft' ? 'Progress saved for later.' : 'Report sent successfully!' });
      if (type === 'Submitted') {
        setForm({ title: '', weekNumber: (Number(form.weekNumber) + 1).toString(), hoursWorked: '', skills: [], outcome: '', whatDidYouDo: '', fileUrl: '' });
        setSelectedFile(null);
      }
      await loadData();
    } catch (e) {
      console.error(e);
      const errorMsg = e.response?.data?.message || 'Something went wrong. Please check your connection and try again.';
      setMsg({ type: 'error', text: errorMsg });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
       <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="w-full space-y-12 py-8 pb-32">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between px-6 lg:px-8">
        <div className="flex items-center gap-6">
           <div className="h-16 w-16 rounded-[24px] bg-cyan-700 flex items-center justify-center text-white shadow-2xl shadow-cyan-200">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
           </div>
           <div>
              <h1 className="text-5xl font-black tracking-tight text-slate-900">Work Roadmap</h1>
              <p className="text-lg text-slate-500 font-medium mt-1">Status: <span className="text-emerald-500 font-bold uppercase tracking-widest text-xs">Connected</span></p>
           </div>
        </div>
        
        {/* White Styled Editable Dropdown for Week */}
        <div className="relative group self-start lg:self-center">
            <label className="absolute -top-6 left-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Reporting For</label>
            <div className="flex items-center bg-white rounded-[24px] shadow-xl shadow-slate-200 overflow-hidden border-2 border-slate-100 focus-within:border-cyan-500 transition-all">
                <div className="pl-6 py-5 text-lg font-black text-slate-900 uppercase tracking-[0.2em] pointer-events-none">
                    Week
                </div>
                <input 
                    type="number" 
                    min="1"
                    max="52"
                    value={form.weekNumber}
                    onChange={e => setForm({...form, weekNumber: e.target.value})}
                    placeholder="Num"
                    className="bg-white text-slate-900 w-24 pl-2 pr-4 py-5 text-lg font-black outline-none border-none focus:ring-0"
                />
                <div className="pr-4 pointer-events-none">
                    <svg className="w-4 h-4 text-cyan-600 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>
        </div>
      </div>

      <div className="w-full px-6 lg:px-8 space-y-20">
        {/* Entry Form */}
        <div className="rounded-[48px] bg-white p-8 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] border border-slate-100 sm:p-14">
          <div className="mb-12 flex items-center justify-between border-b border-slate-100 pb-8">
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Weekly Submission</h3>
              <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-widest">Internship Progress Report</p>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ready to Save</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>

          {msg.text && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`mb-10 rounded-[24px] p-6 text-sm font-bold border-2 ${msg.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
              {msg.type === 'error' ? '⚡' : '✨'} {msg.text}
            </motion.div>
          )}

          <form onSubmit={(e) => handleSubmit(e, 'Submitted')} className="space-y-10">
            <div className="flex flex-col gap-8 md:flex-row">
              <div className="flex-[3] space-y-3">
                <label className="text-[14px] font-black uppercase tracking-[0.15em] text-slate-800 ml-1">Task Name *</label>
                <div className="relative group">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl opacity-30 group-focus-within:opacity-100 transition-opacity">📝</span>
                  <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full rounded-[24px] border-2 border-slate-100 bg-white py-6 pl-16 pr-6 text-xl font-black text-slate-900 focus:border-cyan-500 focus:bg-white outline-none transition-all shadow-inner" placeholder="E.g., System Architecture Design" />
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <label className="text-[14px] font-black uppercase tracking-[0.15em] text-slate-800 ml-1">Hours Worked *</label>
                <div className="relative group">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl opacity-30 group-focus-within:opacity-100 transition-opacity">⏱️</span>
                  <input type="number" value={form.hoursWorked} onChange={e => setForm({...form, hoursWorked: e.target.value})} className="w-full rounded-[24px] border-2 border-slate-100 bg-white py-6 pl-16 pr-6 text-xl font-black text-slate-900 focus:border-cyan-500 focus:bg-white outline-none transition-all shadow-inner" placeholder="0" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[14px] font-black uppercase tracking-[0.15em] text-slate-800 ml-1">Skills Used</label>
              <div className="relative group min-h-[76px] w-full rounded-[24px] border-2 border-slate-100 bg-white pl-16 pr-4 py-4 flex flex-wrap gap-2 items-center focus-within:border-cyan-500 focus-within:bg-white transition-all shadow-inner">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl opacity-30 group-focus-within:opacity-100 transition-opacity">🛠️</span>
              {form.skills.map(skill => (
                  <span key={skill} className="bg-cyan-100 text-cyan-700 text-[12px] font-black px-4 py-2 rounded-xl flex items-center gap-1 border border-cyan-200">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} className="hover:text-cyan-900 font-bold ml-1">×</button>
                  </span>
              ))}
              <input 
                  type="text" 
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSkill(skillInput))}
                  className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-xl font-black text-slate-900 placeholder:font-medium placeholder:text-slate-300" 
                  placeholder="Add skill..." 
              />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[14px] font-black uppercase tracking-[0.15em] text-slate-800 ml-1">Description *</label>
              <textarea value={form.whatDidYouDo} onChange={e => setForm({...form, whatDidYouDo: e.target.value})} className="min-h-[260px] w-full rounded-[32px] border-2 border-slate-100 bg-white px-8 py-8 text-xl font-medium text-slate-700 focus:border-cyan-500 focus:bg-white outline-none transition-all leading-relaxed shadow-inner" placeholder="Provide a summary of your weekly contributions..." />
            </div>

            <div className="flex flex-col gap-8 md:flex-row">
                <div className="flex-1 space-y-3">
                    <label className="text-[14px] font-black uppercase tracking-[0.15em] text-slate-800 ml-1">Biggest Achievement (Optional)</label>
                    <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl opacity-30 group-focus-within:opacity-100 transition-opacity">✨</span>
                    <input type="text" value={form.outcome} onChange={e => setForm({...form, outcome: e.target.value})} className="w-full rounded-[24px] border-2 border-slate-100 bg-white py-6 pl-16 pr-6 text-xl font-black text-slate-900 focus:border-cyan-500 focus:bg-white outline-none transition-all shadow-inner" placeholder="What was your best work this week?" />
                    </div>
                </div>
                <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between ml-1">
                        <label className="text-[14px] font-black uppercase tracking-[0.15em] text-slate-800">Project Evidence (Optional)</label>
                        <div className="flex bg-slate-100 rounded-2xl p-1.5 shadow-inner">
                            <button type="button" onClick={() => setAttachmentMode('url')} className={`px-8 py-3 text-xs font-black uppercase tracking-[0.2em] rounded-xl transition-all ${attachmentMode === 'url' ? 'bg-white text-cyan-700 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Link</button>
                            <button type="button" onClick={() => setAttachmentMode('file')} className={`px-8 py-3 text-xs font-black uppercase tracking-[0.2em] rounded-xl transition-all ${attachmentMode === 'file' ? 'bg-white text-cyan-700 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Upload</button>
                        </div>
                    </div>
                    
                    {attachmentMode === 'url' ? (
                        <div className="relative group">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl opacity-30 group-focus-within:opacity-100 transition-opacity">🔗</span>
                            <input type="url" value={form.fileUrl} onChange={e => setForm({...form, fileUrl: e.target.value})} className="w-full rounded-[24px] border-2 border-slate-100 bg-white py-6 pl-16 pr-6 text-xl font-black text-slate-900 focus:border-cyan-500 focus:bg-white outline-none transition-all shadow-inner" placeholder="Link to Google Drive, GitHub, etc." />
                        </div>
                    ) : (
                        <div className="relative group flex items-center justify-center w-full rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-50 py-5 hover:bg-slate-100 hover:border-cyan-400 transition-all cursor-pointer overflow-hidden">
                            <input type="file" onChange={e => setSelectedFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-3xl mb-1">{selectedFile ? '✅' : '📁'}</span>
                                <span className="text-sm font-black text-slate-700">{selectedFile ? selectedFile.name : 'Click or Drag to upload file'}</span>
                                {!selectedFile && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">JPG, PNG, PDF, DOCX (Max 10MB)</span>}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between pt-10">
              <button 
                type="button" 
                onClick={(e) => handleSubmit(e, 'Draft')} 
                disabled={submitting} 
                className="rounded-full bg-slate-100 px-10 py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-700 hover:bg-slate-200 transition-all active:scale-95"
              >
                Save for Later
              </button>
              <button 
                type="submit" 
                disabled={submitting} 
                className="rounded-full bg-cyan-700 px-12 py-4 text-xs font-black uppercase tracking-[0.3em] text-white shadow-xl shadow-cyan-100 hover:bg-cyan-800 transition-all active:scale-95 disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>

        {/* Simplified Archive Section */}
        <div className="space-y-10">
          <div className="flex flex-col gap-10 border-b border-slate-100 pb-12 px-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex-1">
                    <h3 className="text-4xl font-black text-slate-900 tracking-tight">Report History</h3>
                    <p className="text-[14px] font-black text-slate-800 uppercase tracking-widest mt-2">All your previous reports</p>
                </div>
                
                {/* Large Status Buttons */}
                <div className="flex flex-wrap gap-3 bg-white p-2 rounded-[32px] shadow-2xl shadow-slate-200/50 border-2 border-slate-50">
                    {['All', 'Drafts', 'Pending', 'Approved'].map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => setActiveTab(tab)} 
                            className={`px-8 py-4 rounded-[24px] text-xs font-black uppercase tracking-[0.2em] transition-all transform active:scale-95 ${
                                activeTab === tab 
                                ? 'bg-cyan-700 text-white shadow-xl shadow-cyan-200' 
                                : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Unified Search Bar */}
            <div className="flex flex-col gap-3">
                <label className="text-[12px] font-black text-slate-900 uppercase tracking-widest ml-1">Find a Report (Week or Task Name)</label>
                <div className="flex items-center bg-white rounded-[40px] shadow-2xl shadow-slate-200/60 border-2 border-slate-200 px-8 py-6 focus-within:border-cyan-600 focus-within:ring-8 focus-within:ring-cyan-50 transition-all group">
                    <span className="text-3xl text-cyan-700 opacity-60 mr-5 group-focus-within:opacity-100 transition-opacity">🔍</span>
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by week number or title..." 
                        className="flex-1 bg-transparent border-none outline-none text-2xl font-black text-slate-900 placeholder:text-slate-200 placeholder:font-bold"
                    />
                </div>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
             <div className="rounded-[40px] bg-white py-32 text-center border-2 border-dashed border-slate-100 shadow-inner">
                <div className="text-6xl mb-6 opacity-10">📂</div>
                <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">
                    {searchQuery || activeTab !== 'All' ? 'No matches found' : 'No reports found yet'}
                </p>
             </div>
          ) : (
            <div className="space-y-12">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                {paginatedLogs.map(log => (
                <div key={log._id} className="group relative rounded-[48px] bg-white p-10 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200/60 hover:border-cyan-200 transition-all cursor-default">
                   <div className="flex items-start justify-between mb-8">
                      <div className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 ${STATUS_CONFIG[log.status]?.color || 'bg-slate-50 text-slate-500'}`}>
                         {STATUS_CONFIG[log.status]?.label || log.status}
                      </div>
                      <div className="flex flex-col items-end">
                         <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Week {log.weekNumber}</span>
                         <span className="text-[10px] font-bold text-slate-300 mt-1">{new Date(log.createdAt).toLocaleDateString()}</span>
                      </div>
                   </div>
                   
                   <h4 className="text-2xl font-black text-slate-900 line-clamp-1 mb-4 group-hover:text-cyan-700 transition-colors">{log.title || 'Untitled Report'}</h4>
                   <p className="text-lg font-medium text-slate-500 line-clamp-3 mb-10 leading-relaxed h-[84px] overflow-hidden">{log.summary}</p>
                   
                   <div className="flex items-center justify-between pt-8 border-t border-slate-50">
                      <div className="flex items-center gap-3">
                         <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-lg">⏱️</div>
                         <span className="text-sm font-black text-slate-900">{log.hoursWorked}h</span>
                      </div>
                      
                      <div className="flex gap-3">
                        {log.status === 'Draft' || log.status === 'Needs Revision' ? (
                            <div className="flex gap-2">
                                <button onClick={() => loadDraft(log)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-700 transition-all shadow-xl shadow-slate-200">Continue Editing</button>
                                {log.status === 'Draft' && (
                                    <button onClick={() => setDeleteConfirm(log._id)} className="bg-rose-50 text-rose-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm">Delete Draft</button>
                                )}
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => setExpandedLog(expandedLog === log._id ? null : log._id)} className="bg-slate-50 text-slate-400 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-slate-900 hover:shadow-md transition-all border border-transparent hover:border-slate-100">See Details</button>
                                {log.status === 'Submitted' && (
                                    <button onClick={() => setDeleteConfirm(log._id)} className="bg-rose-50 text-rose-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm">Delete</button>
                                )}
                            </div>
                        )}
                      </div>
                   </div>

                   <AnimatePresence>
                     {expandedLog === log._id && (
                       <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-8">
                          <div className="flex justify-end mb-4">
                              <button onClick={() => handleDownloadPDF(log)} className="bg-cyan-700 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-800 transition-all shadow-xl shadow-cyan-200 flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  Download PDF
                              </button>
                          </div>
                          <div id={`report-detail-${log._id}`} className="p-8 rounded-[32px] bg-slate-50 border border-slate-100 space-y-10">
                             {/* Deep Detail: Replicating Form Structure */}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Task Name</p>
                                    <p className="text-lg font-black text-slate-900">{log.title || 'Untitled'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Week & Hours Worked</p>
                                    <p className="text-lg font-black text-slate-900">Week {log.weekNumber} • {log.hoursWorked} Hours</p>
                                </div>
                             </div>

                             <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-3">Skills Used</p>
                                <div className="relative group min-h-[76px] w-full rounded-[24px] border-2 border-slate-100 bg-white pl-16 pr-4 py-4 flex flex-wrap gap-2 items-center shadow-sm">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl opacity-40">🛠️</span>
                                    {log.skills?.length > 0 && (
                                        log.skills.map(s => (
                                            <span key={s} className="bg-cyan-100 text-cyan-700 text-[12px] font-black px-4 py-2 rounded-xl flex items-center gap-1 border border-cyan-200">
                                                {s}
                                            </span>
                                        ))
                                    )}
                                </div>
                             </div>

                             <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-3">Full Description</p>
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 text-base text-slate-600 leading-relaxed">
                                    {log.summary}
                                </div>
                             </div>

                             <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-3">Biggest Achievement</p>
                                <div className={`p-6 rounded-2xl border text-base font-bold ${log.goals?.[0]?.text ? 'bg-cyan-50/50 border-cyan-100 text-cyan-900' : 'bg-slate-50 border-slate-100 text-slate-400 italic'}`}>
                                    {log.goals?.[0]?.text ? `✨ ${log.goals[0].text}` : 'No specific achievement listed.'}
                                </div>
                             </div>

                             <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-3">Project Evidence</p>
                                {log.fileUrl ? (
                                    <a href={log.fileUrl.startsWith('/') ? `http://localhost:5000${log.fileUrl}` : log.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white px-5 py-3 rounded-xl border border-slate-200 text-sm font-black text-cyan-700 hover:border-cyan-300 transition-all shadow-sm">
                                        {log.fileUrl.startsWith('/') ? '📁 Download Uploaded File' : '🔗 Open Shared Link'}
                                    </a>
                                ) : (
                                    <div className="bg-slate-50 px-5 py-3 rounded-xl border border-slate-100 text-sm font-medium text-slate-400 inline-block italic">
                                        No evidence attached.
                                    </div>
                                )}
                             </div>

                             {log.performanceScores && (
                               <div className="pt-8 border-t border-slate-200">
                                 <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tight">Industry Assessment</h3>
                                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    {['Technical', 'Communication', 'Teamwork'].map((skill) => (
                                      <div key={skill} className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm text-center">
                                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{skill}</p>
                                         <div className="flex items-center justify-center gap-1">
                                            <span className="text-3xl font-black text-cyan-700">{log.performanceScores[skill.toLowerCase()] || 0}</span>
                                            <span className="text-sm font-bold text-slate-300">/10</span>
                                         </div>
                                      </div>
                                    ))}
                                 </div>
                               </div>
                             )}

                             {(log.companyFeedback || log.performanceScores) && (
                               <div className="pt-8 border-t border-slate-200">
                                  <div className="flex items-center gap-4 mb-6">
                                     {log.mentorDetails?.profileImage ? (
                                         <img src={log.mentorDetails.profileImage.startsWith('/') ? `http://localhost:5000${log.mentorDetails.profileImage}` : log.mentorDetails.profileImage} alt="Company Logo" className="w-14 h-14 rounded-full object-cover border-2 border-emerald-100 shadow-sm" />
                                     ) : (
                                         <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl font-black shadow-sm">👨‍🏫</div>
                                     )}
                                     <div>
                                         <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">Reviewed By</p>
                                         <p className="text-lg font-black text-slate-900">{log.mentorDetails?.name || 'Industry Supervisor'}</p>
                                         <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-widest">
                                             {log.mentorDetails?.position && <span>💼 {log.mentorDetails.position}</span>}
                                             {log.mentorDetails?.email && <span>📧 {log.mentorDetails.email}</span>}
                                             {log.mentorDetails?.phone && <span>📱 {log.mentorDetails.phone}</span>}
                                         </div>
                                     </div>
                                  </div>
                                  {log.companyFeedback && (
                                    <div className="relative">
                                        <span className="absolute -top-4 -left-2 text-4xl opacity-10 text-emerald-900 pointer-events-none">"</span>
                                        <p className="text-lg font-bold text-emerald-900 italic leading-relaxed bg-emerald-50/50 px-8 py-6 rounded-[24px] border border-emerald-100 relative z-10">
                                          {log.companyFeedback}
                                        </p>
                                    </div>
                                  )}
                               </div>
                             )}

                             {log.universityFeedback && (
                               <div className="pt-8 border-t border-slate-200">
                                  <div className="flex items-center gap-4 mb-6">
                                     {log.advisor?.profileImage ? (
                                         <img src={log.advisor.profileImage.startsWith('/') ? `http://localhost:5000${log.advisor.profileImage}` : log.advisor.profileImage} alt="Advisor Photo" className="w-14 h-14 rounded-full object-cover border-2 border-indigo-100 shadow-sm" />
                                     ) : (
                                         <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl font-black shadow-sm">🎓</div>
                                     )}
                                     <div>
                                         <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-1">University Evaluator</p>
                                         <p className="text-lg font-black text-slate-900">{log.advisor?.fullName || log.advisor?.name || 'Academic Advisor'}</p>
                                         <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-widest">
                                             {log.advisor?.email && <span>📧 {log.advisor.email}</span>}
                                             {log.advisor?.phone && <span>📱 {log.advisor.phone}</span>}
                                         </div>
                                     </div>
                                  </div>
                                  <div className="relative">
                                      <span className="absolute -top-4 -left-2 text-4xl opacity-10 text-indigo-900 pointer-events-none">"</span>
                                      <p className="text-lg font-bold text-indigo-900 italic leading-relaxed bg-indigo-50/50 px-8 py-6 rounded-[24px] border border-indigo-100 relative z-10">
                                        {log.universityFeedback}
                                      </p>
                                  </div>
                               </div>
                             )}
                          </div>
                       </motion.div>
                     )}
                   </AnimatePresence>
                </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-8 border-t border-slate-100">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  
                  <div className="flex items-center gap-2">
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`w-12 h-12 rounded-2xl text-sm font-black transition-all ${currentPage === i + 1 ? 'bg-cyan-700 text-white shadow-lg shadow-cyan-200 scale-110' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-3xl mb-6 mx-auto">
                🗑️
              </div>
              <h3 className="text-2xl font-black text-slate-900 text-center mb-2">Delete Report?</h3>
              <p className="text-slate-500 text-center font-medium mb-8 leading-relaxed">
                Are you sure you want to permanently delete this? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeleteConfirm(null)} 
                  className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    handleDeleteDraft(deleteConfirm);
                    setDeleteConfirm(null);
                  }} 
                  className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
