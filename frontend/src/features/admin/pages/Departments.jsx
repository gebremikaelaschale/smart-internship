import React, { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Modal from '@/components/common/Modal';
import { adminAPI } from '../adminAPI';

export default function Departments() {
  const [items, setItems] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [headCandidates, setHeadCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [editDepartmentName, setEditDepartmentName] = useState('');

  const [departmentName, setDepartmentName] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [createHeadId, setCreateHeadId] = useState('');
  const [createHeadName, setCreateHeadName] = useState('');
  const [createHeadEmail, setCreateHeadEmail] = useState('');
  const [headId, setHeadId] = useState('');

  const headOptions = useMemo(() => headCandidates, [headCandidates]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [departmentsResponse, collegesResponse, headsResponse] = await Promise.all([
        adminAPI.getDepartments(),
        adminAPI.getColleges(),
        adminAPI.getDepartmentHeadCandidates()
      ]);

      setItems(Array.isArray(departmentsResponse?.data) ? departmentsResponse.data : []);
      setColleges(Array.isArray(collegesResponse?.data) ? collegesResponse.data : []);
      setHeadCandidates(Array.isArray(headsResponse?.data) ? headsResponse.data : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load departments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetCreateForm = () => {
    setDepartmentName('');
    setCollegeId('');
    setCreateHeadId('');
    setCreateHeadName('');
    setCreateHeadEmail('');
    setCreateOpen(false);
  };

  const openAssignModal = (department) => {
    setSelectedDepartment(department);
    setHeadId(String(department?.head?._id || ''));
    setAssignOpen(true);
  };

  const closeAssignModal = () => {
    setSelectedDepartment(null);
    setHeadId('');
    setAssignOpen(false);
  };

  const openViewModal = (department) => {
    setSelectedDepartment(department);
    setViewOpen(true);
  };

  const closeViewModal = () => {
    setSelectedDepartment(null);
    setViewOpen(false);
  };

  const openEditModal = (department) => {
    setSelectedDepartment(department);
    setEditDepartmentName(String(department?.name || ''));
    setEditOpen(true);
  };

  const closeEditModal = () => {
    setSelectedDepartment(null);
    setEditDepartmentName('');
    setEditOpen(false);
  };

  const saveDepartment = async () => {
    const name = String(departmentName || '').trim();
    if (!name || !collegeId) {
      setError('Department name and college are required.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');
      const payload = {
        name,
        collegeId
      };

      const headName = String(createHeadName || '').trim();
      const headEmail = String(createHeadEmail || '').trim();
      if (headName && headEmail) {
        payload.head = { name: headName, email: headEmail };
      } else if (createHeadId) {
        payload.headId = createHeadId;
      }

      const { data } = await adminAPI.createDepartment(payload);
      setMessage(data?.message || 'Department created successfully.');
      if (data?.temporaryPassword) {
        setMessage(`${data?.message || 'Department created successfully.'} Temporary password was emailed to the HOD.`);
      }
      resetCreateForm();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to create department.');
    } finally {
      setSaving(false);
    }
  };

  const saveHead = async () => {
    if (!selectedDepartment?._id) return;

    try {
      setSaving(true);
      setError('');
      setMessage('');
      const { data } = await adminAPI.assignDepartmentHead(selectedDepartment._id, { headId: headId || undefined });
      const updated = data?.department;
      if (updated?._id) {
        setItems((prev) => prev.map((item) => (String(item?._id || '') === String(updated._id)
          ? { ...item, head: updated.head }
          : item)));
      }
      setMessage('Department head assignment updated successfully.');
      closeAssignModal();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to assign department head.');
    } finally {
      setSaving(false);
    }
  };

  const saveDepartmentEdit = async () => {
    if (!selectedDepartment?._id) return;

    const name = String(editDepartmentName || '').trim();
    if (!name) {
      setError('Department name is required.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');
      const { data } = await adminAPI.updateDepartment(selectedDepartment._id, { name });
      const updated = data?.department;

      if (updated?._id) {
        setItems((prev) => prev.map((item) => (
          String(item?._id || '') === String(updated._id)
            ? { ...item, ...updated }
            : item
        )));
      }

      setMessage(data?.message || 'Department updated successfully.');
      closeEditModal();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update department.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Departments"
      description="Create departments and assign department heads using live database users."
      action={(
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Create Department
        </button>
      )}
    >
      {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading departments...</p> : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Department Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">HOD</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Students count</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((department) => (
                <tr key={String(department?._id || '')}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{department?.name || 'Unnamed department'}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{department?.head?.fullName || department?.head?.name || 'Not assigned'}</p>
                    {department?.head?.email ? <p className="text-xs text-slate-500">{department.head.email}</p> : null}
                  </td>
                  <td className="px-4 py-3">{department?.memberCount ?? 0}</td>
                  <td className="px-4 py-3">
                    {department?.head?._id ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                        Missing HOD
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openViewModal(department)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(department)}
                        className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openAssignModal(department)}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                      >
                        Assign HOD
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && items.length === 0 ? <p className="text-sm text-slate-500">No departments found.</p> : null}

      <Modal open={createOpen} title="Create Department" onClose={resetCreateForm}>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Department Name</label>
            <input
              value={departmentName}
              onChange={(event) => setDepartmentName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="e.g. Software Engineering"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">College</label>
            <select
              value={collegeId}
              onChange={(event) => setCollegeId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="">Select a college</option>
              {colleges.map((college) => (
                <option key={String(college?._id || '')} value={college?._id || ''}>
                  {college?.name || 'Unnamed college'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">HOD Name</label>
            <input
              value={createHeadName}
              onChange={(event) => setCreateHeadName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="e.g. Aster Kebede"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">HOD Email</label>
            <input
              value={createHeadEmail}
              onChange={(event) => setCreateHeadEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="e.g. hod.se@uog.edu.et"
            />
          </div>

          <div className="text-xs text-slate-500">
            Or choose an existing department head.
            <select
              value={createHeadId}
              onChange={(event) => setCreateHeadId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="">No head assigned yet</option>
              {headOptions.map((candidate) => (
                <option key={String(candidate?._id || '')} value={candidate?._id || ''}>
                  {(candidate?.fullName || candidate?.name || 'Unnamed user')} - {candidate?.email || 'no email'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetCreateForm} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Cancel
            </button>
            <button type="button" onClick={saveDepartment} disabled={saving} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? 'Saving...' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={assignOpen} title="Assign Department Head" onClose={closeAssignModal}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Assign a department head for <span className="font-semibold text-slate-900">{selectedDepartment?.name || 'this department'}</span>.
          </p>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Department Head</label>
            <select
              value={headId}
              onChange={(event) => setHeadId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="">Remove head assignment</option>
              {headOptions.map((candidate) => (
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
            <button type="button" onClick={saveHead} disabled={saving} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Head'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={viewOpen} title="Department Details" onClose={closeViewModal}>
        <div className="space-y-3 text-sm">
          <p><span className="font-semibold text-slate-700">Department Name:</span> <span className="text-slate-900">{selectedDepartment?.name || 'N/A'}</span></p>
          <p><span className="font-semibold text-slate-700">College:</span> <span className="text-slate-900">{selectedDepartment?.college?.name || 'N/A'}</span></p>
          <p><span className="font-semibold text-slate-700">HOD:</span> <span className="text-slate-900">{selectedDepartment?.head?.fullName || selectedDepartment?.head?.name || 'Not assigned'}</span></p>
          <p><span className="font-semibold text-slate-700">Students count:</span> <span className="text-slate-900">{selectedDepartment?.memberCount ?? 0}</span></p>
          <div>
            <span className="font-semibold text-slate-700">Status:</span>{' '}
            {selectedDepartment?.head?._id ? (
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span>
            ) : (
              <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">Missing HOD</span>
            )}
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={closeViewModal} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Close
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} title="Edit Department" onClose={closeEditModal}>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Department Name</label>
            <input
              value={editDepartmentName}
              onChange={(event) => setEditDepartmentName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Enter department name"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeEditModal} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Cancel
            </button>
            <button type="button" onClick={saveDepartmentEdit} disabled={saving} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
