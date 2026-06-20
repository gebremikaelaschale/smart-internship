import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExportReasonModal({
  open,
  title = 'Download Report',
  confirmLabel = 'Download',
  onClose,
  onConfirm,
  loading = false
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setReason('');
    setError('');
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose?.();
  };

  const handleConfirm = async () => {
    const cleanReason = String(reason || '').trim();
    if (cleanReason.length < 8) {
      setError('Please provide at least 8 characters explaining why you are downloading this report.');
      return;
    }

    setError('');
    await onConfirm?.(cleanReason);
    reset();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Blur Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-[40px] bg-white shadow-[0_32px_64px_-16px_rgba(15,23,42,0.25)]"
          >
            {/* Header with Premium Radial Gradient */}
            <div className="bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_50%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-10 py-8 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                    {title === 'Export Applications CSV' ? 'Download Report' : title}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Export actions are audited. Please provide a business reason.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="rounded-full bg-white p-2 text-slate-400 hover:text-slate-900 shadow-sm border border-slate-100 transition-all hover:scale-110 disabled:opacity-50"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-10 space-y-6">
              <div className="space-y-3">
                <label htmlFor="export-reason" className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700 ml-1">
                  Reason for downloading data
                </label>
                <div className="relative group">
                  <textarea
                    id="export-reason"
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                      if (error) setError('');
                    }}
                    rows={4}
                    placeholder="e.g. Weekly department placement meeting and progress review."
                    className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-sm font-bold text-slate-900 transition-all focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none placeholder:text-slate-400 placeholder:font-medium resize-none shadow-sm"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Error Notice */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-xs font-black uppercase tracking-widest text-rose-700 shadow-sm"
                >
                  ⚠️ {error}
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-10 flex gap-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-5 text-sm font-black uppercase tracking-[0.2em] text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-[2] rounded-2xl bg-cyan-700 py-5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-cyan-900/10 transition-all hover:bg-cyan-600 hover:-translate-y-1 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Processing...' : (confirmLabel === 'Export' ? 'Download' : confirmLabel)}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
