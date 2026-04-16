import React, { useEffect, useState } from 'react';
import Modal from '@/components/common/Modal';
import { adminAPI } from '../adminAPI';

export default function DeanHodManagement() {
  const [departments, setDepartments] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingDepartmentId, setSavingDepartmentId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedHeadId, setSelectedHeadId] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [departmentsRes, headsRes] = await Promise.all([
        adminAPI.getDepartments(),
        adminAPI.getDepartmentHeadCandidates()
      ]);

      setDepartments(Array.isArray(departmentsRes?.data) ? departmentsRes.data : []);
      setCandidates(Array.isArray(headsRes?.data) ? headsRes.data : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load HOD management data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAssignModal = (department, currentHeadId = '') => {
    setSelectedDepartmentId(String(department?._id || ''));
    setSelectedHeadId(String(currentHeadId || ''));
    setAssignOpen(true);
  };

  const closeAssignModal = () => {
    setAssignOpen(false);
    setSelectedDepartmentId('');
    setSelectedHeadId('');
  };

  const assignHead = async () => {
    if (!selectedDepartmentId || !selectedHeadId) {
      setError('Please choose both department and HOD.');
      return;
    }

    try {
      setSavingDepartmentId(selectedDepartmentId);
      setError('');
      setMessage('');
      await adminAPI.assignDepartmentHead(selectedDepartmentId, { headId: selectedHeadId });
      setMessage('HOD assigned successfully.');
      closeAssignModal();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to assign HOD.');
    } finally {
      setSavingDepartmentId('');
    }
  };

  const removeHead = async (departmentId) => {
    try {
      setSavingDepartmentId(String(departmentId || ''));
      setError('');
      setMessage('');
      await adminAPI.assignDepartmentHead(departmentId, { headId: undefined });
      setMessage('HOD removed successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to remove HOD.');
    } finally {
      setSavingDepartmentId('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">HOD Management</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Heads of Departments</h2>
        </div>
        <button
          type="button"
          onClick={() => openAssignModal(null, '')}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Assign New HOD
        </button>
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      {!loading && departments.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Department</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map((department) => {
                const hasHead = Boolean(department?.head?._id);
                const headName = department?.head?.fullName || department?.head?.name || 'Not assigned';
                const headEmail = department?.head?.email || 'Not assigned';
                const departmentId = String(department?._id || '');
                const isSaving = savingDepartmentId === departmentId;

                return (
                  <tr key={departmentId}>
                    <td className="px-4 py-3 font-medium text-slate-900">{headName}</td>
                    <td className="px-4 py-3 text-slate-700">{department?.name || 'Unnamed department'}</td>
                    <td className="px-4 py-3 text-slate-700">{headEmail}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {!hasHead ? (
                          <button
                            type="button"
                            onClick={() => openAssignModal(department, '')}
                            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700"
                          >
                            Assign to department
                          </button>
                        ) : null}

                        {hasHead ? (
                          <button
                            type="button"
                            onClick={() => openAssignModal(department, String(department?.head?._id || ''))}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
                          >
                            Replace HOD
                          </button>
                        ) : null}

                        {hasHead ? (
                          <button
                            type="button"
                            onClick={() => removeHead(departmentId)}
                            disabled={isSaving}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
                          >
                            {isSaving ? 'Removing...' : 'Remove'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Loading HOD management from database...</p> : null}
      {!loading && departments.length === 0 ? <p className="text-sm text-slate-500">No departments found for your scope.</p> : null}

      <Modal open={assignOpen} title="Assign HOD" onClose={closeAssignModal}>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Department</label>
            <select
              value={selectedDepartmentId}
              onChange={(event) => setSelectedDepartmentId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={String(department?._id || '')} value={department?._id || ''}>
                  {department?.name || 'Unnamed department'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">HOD</label>
            <select
              value={selectedHeadId}
              onChange={(event) => setSelectedHeadId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="">Select HOD</option>
              {candidates.map((candidate) => (
                <option key={String(candidate?._id || '')} value={candidate?._id || ''}>
                  {(candidate?.fullName || candidate?.name || 'Unnamed user')} - {candidate?.email || 'no email'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeAssignModal} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Cancel
            </button>
            <button
              type="button"
              onClick={assignHead}
              disabled={savingDepartmentId === selectedDepartmentId}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingDepartmentId === selectedDepartmentId ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
