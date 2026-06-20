import React, { useEffect, useState } from 'react';
import { adminAPI } from '../adminAPI';
import DepartmentFormModal from '../components/DepartmentFormModal';

export default function DeanHodManagement() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const departmentsRes = await adminAPI.getDepartments();

      setDepartments(Array.isArray(departmentsRes?.data) ? departmentsRes.data : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load HOD management data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAssignModal = (department) => {
    if (!department?._id) {
      setError('Please choose a department from the table first.');
      return;
    }
    setSelectedDepartment(department);
    setAssignOpen(true);
  };

  const closeAssignModal = () => {
    setAssignOpen(false);
    setSelectedDepartment(null);
  };

  const saveDepartmentHod = async (formData) => {
    if (!selectedDepartment?._id) {
      setError('Please choose a department first.');
      return;
    }

    const name = String(formData?.name || '').trim();
    const headName = String(formData?.head?.name || '').trim();
    const headEmail = String(formData?.head?.email || '').trim();
    const headPhone = String(formData?.head?.phone || '').trim();

    if (!name || !headName || !headEmail || !headPhone) {
      setError('Please provide department name and full HOD contact details.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      await adminAPI.updateDepartmentHod(selectedDepartment._id, {
        name,
        collegeId: formData?.collegeId,
        head: {
          name: headName,
          email: headEmail,
          phone: headPhone
        }
      });
      setMessage(selectedDepartment?.head?._id ? 'HOD replaced successfully.' : 'HOD assigned successfully.');

      closeAssignModal();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to assign HOD.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">HOD Management</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Heads of Departments</h2>
        </div>
        {/* Assign New HOD button removed to avoid confusion; use table row actions instead */}
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      {!loading && departments.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Phone Number</th>
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

                return (
                  <tr key={departmentId}>
                    <td className="px-4 py-3 font-medium text-slate-900">{headName}</td>
                    <td className="px-4 py-3 text-slate-700">{department?.head?.phone || 'Not assigned'}</td>
                    <td className="px-4 py-3 text-slate-700">{department?.name || 'Unnamed department'}</td>
                    <td className="px-4 py-3 text-slate-700">{headEmail}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {!hasHead ? (
                          <button
                            type="button"
                            onClick={() => openAssignModal(department)}
                            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700"
                          >
                            Assign to department
                          </button>
                        ) : null}

                        {hasHead ? (
                          <button
                            type="button"
                            onClick={() => openAssignModal(department)}
                            className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-600"
                          >
                            Replace HOD
                          </button>
                        ) : null}

                        {/* Remove action intentionally hidden */}
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

      <DepartmentFormModal
        open={assignOpen}
        editData={selectedDepartment}
        collegeName={selectedDepartment?.college?.name || ''}
        collegeId={selectedDepartment?.college?._id || ''}
        saving={saving}
        error={error}
        onClose={closeAssignModal}
        onSubmit={saveDepartmentHod}
      />
    </div>
  );
}
