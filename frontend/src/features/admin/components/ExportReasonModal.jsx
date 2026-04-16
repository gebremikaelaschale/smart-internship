import React, { useState } from 'react';
import Modal from '@/components/common/Modal';

export default function ExportReasonModal({
  open,
  title,
  confirmLabel = 'Export',
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
      setError('Please provide at least 8 characters explaining why you are exporting this data.');
      return;
    }

    setError('');
    await onConfirm?.(cleanReason);
    reset();
  };

  return (
    <Modal open={open} title={title} onClose={handleClose}>
      <p className="text-sm text-slate-700">Export actions are audited. Please provide a business reason.</p>
      <div className="mt-3">
        <label htmlFor="export-reason" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Export reason
        </label>
        <textarea
          id="export-reason"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            if (error) setError('');
          }}
          rows={3}
          placeholder="Example: Weekly governance review for department meeting."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          disabled={loading}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Exporting...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
