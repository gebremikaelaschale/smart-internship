import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const EMPTY_FORM = {
  name: '',
  hodFullName: '',
  hodEmail: '',
  hodPhone: ''
};

function toFormState(editData) {
  return {
    name: String(editData?.name || ''),
    hodFullName: String(editData?.head?.fullName || editData?.head?.name || ''),
    hodEmail: String(editData?.head?.email || ''),
    hodPhone: String(editData?.head?.phone || '')
  };
}

export default function DepartmentFormModal({
  open,
  editData = null,
  collegeName = '',
  collegeId = '',
  saving = false,
  error = '',
  onClose,
  onSubmit
}) {
  const isEditMode = Boolean(editData?._id);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    setForm(isEditMode ? toFormState(editData) : EMPTY_FORM);
  }, [open, editData, isEditMode]);

  const title = useMemo(() => (isEditMode ? 'Edit Department' : 'Create Department'), [isEditMode]);
  const description = useMemo(() => (
    isEditMode
      ? 'Update department registry details and keep backend records in sync.'
      : 'Register a new academic department and assign HOD contact details.'
  ), [isEditMode]);

  const parentCollegeLabel = String(editData?.college?.name || collegeName || '');
  const parentCollegeId = String(editData?.college?._id || collegeId || '');

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit?.({
      name: form.name,
      collegeId: parentCollegeId,
      collegeName: parentCollegeLabel,
      editData,
      head: {
        name: form.hodFullName,
        email: form.hodEmail,
        phone: form.hodPhone
      }
    });
  };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          <motion.form
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onSubmit={handleSubmit}
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[40px] bg-white shadow-[0_32px_64px_-16px_rgba(15,23,42,0.25)]"
          >
            <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_50%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-10 py-8">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{title}</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-full border border-slate-100 bg-white p-2 text-slate-400 shadow-sm transition-all hover:scale-110 hover:text-slate-900 disabled:opacity-50"
                  aria-label={isEditMode ? 'Close edit department modal' : 'Close create department modal'}
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto p-10">
              <div className="space-y-3">
                <label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">
                  Department Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setField('name', event.target.value)}
                  className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-base font-bold text-slate-900 shadow-sm outline-none transition-all placeholder:font-medium placeholder:text-slate-400 focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5"
                  placeholder="e.g. Software Engineering"
                  disabled={saving}
                />
              </div>

              <div className="space-y-3">
                <label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Parent College
                </label>
                <input
                  type="text"
                  value={parentCollegeLabel || 'Unavailable'}
                  readOnly
                  disabled
                  className="w-full cursor-not-allowed rounded-3xl border border-slate-200 bg-slate-50 p-5 text-base font-bold text-slate-500 shadow-sm outline-none"
                />
              </div>

              <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-8 space-y-6">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">HOD Contact Details</h3>
                  <p className="mt-1 text-xs font-medium text-slate-500">Keep the department leadership contact information aligned with the backend records.</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">
                      HOD Full Name
                    </label>
                    <input
                      type="text"
                      value={form.hodFullName}
                      onChange={(event) => setField('hodFullName', event.target.value)}
                      className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-base font-bold text-slate-900 shadow-sm outline-none transition-all placeholder:font-medium placeholder:text-slate-400 focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5"
                      placeholder="e.g. Aster Kebede"
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">
                      HOD Email
                    </label>
                    <input
                      type="email"
                      name="hodEmail"
                      autoComplete="email"
                      inputMode="email"
                      value={form.hodEmail}
                      onChange={(event) => setField('hodEmail', event.target.value)}
                      className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-base font-bold text-slate-900 shadow-sm outline-none transition-all placeholder:font-medium placeholder:text-slate-400 focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5"
                      placeholder="e.g. hod@gmail.com"
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">
                      HOD Phone Number
                    </label>
                    <input
                      type="tel"
                      name="hodPhone"
                      autoComplete="tel"
                      inputMode="tel"
                      value={form.hodPhone}
                      onChange={(event) => setField('hodPhone', event.target.value)}
                      className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-base font-bold text-slate-900 shadow-sm outline-none transition-all placeholder:font-medium placeholder:text-slate-400 focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5"
                      placeholder="e.g. +251 912 345 678"
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              {error ? (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-xs font-black uppercase tracking-widest text-rose-700 shadow-sm"
                >
                  {error}
                </motion.div>
              ) : null}
            </div>

            <div className="flex gap-4 bg-slate-50 p-10">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-5 text-sm font-black uppercase tracking-[0.2em] text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-[2] rounded-2xl bg-cyan-700 py-5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-cyan-900/10 transition-all hover:-translate-y-1 hover:bg-cyan-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Department')}
              </button>
            </div>
          </motion.form>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
