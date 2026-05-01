import React, { useEffect, useState } from 'react';
import api from '@/services/api';

const STATUS_COLORS = {
  Submitted: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Reviewed: 'bg-green-100 text-green-800 border-green-200',
  Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Revisions Requested': 'bg-blue-100 text-blue-700 border-blue-200',
  Declined: 'bg-red-100 text-red-700 border-red-200'
};

export default function EmployerLogbooks() {
  const [logbooks, setLogbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/logbook/employer');
      setLogbooks(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('Failed to load logbooks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleReview = async (logId, status) => {
    setMsg(''); setError('');
    try {
      setReviewing(logId + status);
      await api.patch(`/logbook/${logId}/company-review`, { status, feedback });
      setMsg(`Logbook marked as "${status}".`);
      setFeedback('');
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || 'Review failed.');
    } finally {
      setReviewing(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">📋 Student Logbooks</h1>
        <p className="text-sm text-slate-500 mt-1">Review and approve weekly internship progress reports.</p>
      </div>

      {error && <p className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</p>}
      {msg && <p className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</p>}

      {logbooks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-slate-500 text-sm">No logbooks submitted yet by your interns.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {logbooks.map(log => (
            <div key={log._id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">
                        {log.studentId?.fullName || log.studentId?.name || 'Student'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${STATUS_COLORS[log.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {log.status}
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
                      <span className="text-[11px] text-slate-500 font-medium">{log.internshipId?.title}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] text-slate-500 font-semibold">Week {log.weekNumber}</span>
                      {log.hoursWorked && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] text-blue-600 font-bold flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            {log.hoursWorked} Hours
                          </span>
                        </>
                      )}
                    </div>
                    {log.startDate && log.endDate && (
                      <div className="text-[10px] text-slate-400 mt-1">
                        Range: {new Date(log.startDate).toLocaleDateString()} - {new Date(log.endDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right shrink-0">
                    Submitted: {new Date(log.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="text-sm text-slate-700 bg-slate-50/50 border border-slate-100 rounded-xl p-4 mb-4 whitespace-pre-wrap leading-relaxed">
                  {log.summary}
                </div>

                {log.attachments?.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Submitted Evidence</div>
                    <div className="flex flex-wrap gap-2">
                      {log.attachments.map((file, i) => (
                        <a 
                          key={i} 
                          href={file.url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          {file.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {log.companyFeedback && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-xs text-blue-800">
                    <div className="font-bold uppercase text-[9px] mb-1">Your Previous Feedback</div>
                    {log.companyFeedback}
                  </div>
                )}

                {log.status === 'Submitted' && (
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <textarea
                      rows={2}
                      placeholder="Optional feedback for the student..."
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReview(log._id, 'Approved')}
                        disabled={reviewing === log._id + 'Approved'}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase transition disabled:opacity-60"
                      >
                        {reviewing === log._id + 'Approved' ? 'Approving...' : '✅ Approve'}
                      </button>
                      <button
                        onClick={() => handleReview(log._id, 'Needs Revision')}
                        disabled={reviewing === log._id + 'Needs Revision'}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase transition disabled:opacity-60"
                      >
                        {reviewing === log._id + 'Needs Revision' ? 'Sending...' : '🔄 Revision'}
                      </button>
                      <button
                        onClick={() => handleReview(log._id, 'Declined')}
                        disabled={reviewing === log._id + 'Declined'}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold uppercase transition disabled:opacity-60"
                      >
                        {reviewing === log._id + 'Declined' ? 'Declining...' : '❌ Decline'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
