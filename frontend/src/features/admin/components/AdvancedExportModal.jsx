import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdvancedExportModal({
  open,
  title,
  loading = false,
  onClose,
  onConfirm
}) {
  const [fileName, setFileName] = useState(`Institutional_User_Report_${Date.now()}`);
  const [format, setFormat] = useState('pdf');

  const handleConfirm = () => {
    if (loading) return;
    onConfirm({ fileName: fileName.trim() || 'User_Report', format });
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-[40px] bg-white shadow-[0_32px_64px_-16px_rgba(15,23,42,0.25)]"
          >
            {/* Header with Gradient Background */}
            <div className="bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_50%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-10 py-8 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{title}</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">Configure your professional data report settings.</p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full bg-white p-2 text-slate-400 hover:text-slate-900 shadow-sm border border-slate-100 transition-all hover:scale-110"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-10 space-y-8">
              {/* File Name Input */}
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700 ml-1">
                  Custom File Name
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="Enter file name..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-900 transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 outline-none pl-14"
                    disabled={loading}
                  />
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-600 transition-colors">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Format Selection Cards */}
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700 ml-1">
                  Report Format
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setFormat('pdf')}
                    className={`relative flex flex-col items-center justify-center gap-4 rounded-3xl border-2 p-8 transition-all ${
                      format === 'pdf'
                        ? 'border-cyan-600 bg-cyan-50/50 shadow-[0_10px_20px_rgba(8,145,178,0.1)]'
                        : 'border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`rounded-2xl p-4 transition-all ${format === 'pdf' ? 'bg-cyan-600 text-white scale-110 shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}>
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className={`text-base font-black uppercase tracking-widest ${format === 'pdf' ? 'text-cyan-900' : 'text-slate-500'}`}>PDF Document</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">High Fidelity Printing</p>
                    </div>
                    {format === 'pdf' && (
                      <div className="absolute top-4 right-4">
                        <div className="h-6 w-6 rounded-full bg-cyan-600 flex items-center justify-center text-white shadow-sm">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => setFormat('excel')}
                    className={`relative flex flex-col items-center justify-center gap-4 rounded-3xl border-2 p-8 transition-all ${
                      format === 'excel'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-[0_10px_20px_rgba(16,185,129,0.1)]'
                        : 'border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`rounded-2xl p-4 transition-all ${format === 'excel' ? 'bg-emerald-600 text-white scale-110 shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}>
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className={`text-base font-black uppercase tracking-widest ${format === 'excel' ? 'text-emerald-900' : 'text-slate-500'}`}>Excel Sheet</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Raw Data Extraction</p>
                    </div>
                    {format === 'excel' && (
                      <div className="absolute top-4 right-4">
                        <div className="h-6 w-6 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-10 flex gap-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-5 text-sm font-black uppercase tracking-[0.2em] text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`flex-[2] rounded-2xl py-5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:-translate-y-1 disabled:opacity-50 ${
                  format === 'pdf' ? 'bg-cyan-700 hover:bg-cyan-600 shadow-cyan-900/10' : 'bg-emerald-700 hover:bg-emerald-600 shadow-emerald-900/10'
                }`}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm Export'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
