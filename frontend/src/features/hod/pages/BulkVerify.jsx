import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import Button from '@/components/ui/Button';
import { adminAPI } from '@/features/admin/adminAPI';

const STORAGE_KEY = 'hod-bulk-verify-saved-data';

const HEADER_MAP = {
  studentid: 'studentId',
  id: 'studentId',
  student_id: 'studentId',
  studentidnumber: 'studentId',
  studentidnumber: 'studentId',
  fullname: 'fullName',
  full_name: 'fullName',
  studentname: 'fullName',
  student_name: 'fullName',
  name: 'fullName'
};

function normalizeHeader(value = '') {
  const key = String(value || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  return HEADER_MAP[key] || key;
}

function parseCsvLine(line = '') {
  return String(line || '')
    .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
    .map((cell) => String(cell || '').trim().replace(/^\"|\"$/g, '').replace(/\"\"/g, '\"'));
}

function parseCsvContent(text) {
  const rows = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (rows.length === 0) {
    return { headers: [], items: [], errors: ['CSV file is empty or contains only whitespace.'] };
  }

  const headerRow = parseCsvLine(rows[0]).map(normalizeHeader);
  const requiredHeaders = ['studentId', 'fullName'];
  const missingHeaders = requiredHeaders.filter((required) => !headerRow.includes(required));

  if (missingHeaders.length > 0) {
    return {
      headers: headerRow,
      items: [],
      errors: [`Missing required CSV headers: ${missingHeaders.join(', ')}.`]
    };
  }

  const parsedItems = rows.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const rowData = headerRow.reduce((acc, header, cellIndex) => ({
      ...acc,
      [header]: String(cells[cellIndex] || '').trim()
    }), {});

    const studentId = String(rowData.studentId || rowData.id || '').trim();
    const fullName = String(rowData.fullName || rowData.name || '').trim();
    const parsed = {
      row: index + 2,
      studentId,
      fullName,
      raw: line,
      saved: false
    };

    const issues = [];
    if (!studentId) {
      issues.push('Missing student ID');
    } else if (!/^\d+$/.test(studentId)) {
      issues.push('Student ID must contain only digits');
    }

    if (!fullName) {
      issues.push('Missing student name');
    } else if (!/^\S+(?:\s+\S+)/.test(fullName)) {
      issues.push('Student name should include first and last name');
    }

    return {
      ...parsed,
      valid: issues.length === 0,
      issues
    };
  });

  return { headers: headerRow, items: parsedItems, errors: [] };
}

export default function BulkVerify() {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const persisted = window.localStorage.getItem(STORAGE_KEY);
      if (!persisted) return;

      const parsed = JSON.parse(persisted);
      if (Array.isArray(parsed.rows) && parsed.rows.length > 0) {
        setRows(parsed.rows);
        setFileName(parsed.fileName || 'restored-upload.csv');
        setSavedAt(parsed.savedAt || '');
        setFeedback('Loaded saved verification state. Review and confirm again.');
      }
    } catch {
      // ignore invalid restore data
    }
  }, []);

  const parsedCount = useMemo(() => rows.length, [rows]);
  const validRows = useMemo(() => rows.filter((item) => item.valid), [rows]);
  const invalidRows = useMemo(() => rows.filter((item) => !item.valid), [rows]);
  const unsavedValidRows = useMemo(() => rows.filter((item) => item.valid && !item.saved), [rows]);
  const duplicateIds = useMemo(() => {
    const counts = rows.reduce((acc, item) => {
      const id = String(item.studentId || '').trim();
      if (!id) return acc;
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).filter(([, count]) => count > 1).map(([id]) => id);
  }, [rows]);

  const fileInputRef = useRef(null);
  const rowsPerPage = 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const currentRows = rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const resetState = () => {
    setRows([]);
    setErrors([]);
    setFeedback('');
    setFileName('');
    setSavedAt('');
    setCurrentPage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    setFeedback('');
    setErrors([]);
    setRows([]);
    setSavedAt('');
    setCurrentPage(1);
    setFileName(file?.name || '');

    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrors(['Please upload a CSV file with .csv extension.']);
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCsvContent(text);
      setErrors(parsed.errors);
      setRows(parsed.items);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      setErrors(['Unable to read the selected file. Please try again with a valid CSV.']);
    }
  };

  const handleSaveToDatabase = async () => {
    if (unsavedValidRows.length === 0) {
      setFeedback('There are no valid rows left to save.');
      return;
    }

    setSaving(true);
    setFeedback('Saving verified students to the database...');

    const savedAtIso = new Date().toISOString();
    const updatedRows = [...rows];
    const saveResults = [];

    for (const item of unsavedValidRows) {
      try {
        await adminAPI.updateHodVerificationRequest(item.studentId, { status: 'Verified' });
        const index = updatedRows.findIndex((row) => row.row === item.row && String(row.studentId) === String(item.studentId));
        if (index !== -1) {
          updatedRows[index] = { ...updatedRows[index], saved: true };
        }
        saveResults.push({ success: true, studentId: item.studentId });
      } catch (error) {
        saveResults.push({
          success: false,
          studentId: item.studentId,
          message: error?.response?.data?.message || error?.message || 'Failed to save this row.'
        });
      }
    }

    const failedSaves = saveResults.filter((result) => !result.success);
    setRows(updatedRows);
    setSavedAt(savedAtIso);

    if (failedSaves.length === 0) {
      setFeedback(`Saved ${saveResults.length} verified student records to the database. Invalid rows remain unchanged.`);
    } else {
      setFeedback(`Saved ${saveResults.length - failedSaves.length} verified records; ${failedSaves.length} failed. Check row details and try again.`);
      setErrors((prev) => [
        ...prev,
        ...failedSaves.map((result) => `Student ${result.studentId}: ${result.message}`)
      ]);
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ fileName, rows: updatedRows, savedAt: savedAtIso }));
    }

    setSaving(false);
  };

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-[32px] border border-cyan-100 bg-white px-6 py-8 shadow-[0_15px_40px_rgba(15,23,42,0.04)]">
        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-500">DEPARTMENT-LEVEL OVERSIGHT</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-800">Bulk Student Verification</h1>
            <p className="mt-3 text-sm text-slate-500">Upload the official registrar CSV file to auto-verify students in bulk.</p>
          </div>

          <Button variant="outline" size="sm" className="self-start border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900">
            <Upload className="mr-2 h-4 w-4" /> Download Template
          </Button>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 border border-cyan-100">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">CSV Upload Management</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-800">Upload & verify student records</h2>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <label className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <span className="text-sm font-semibold text-slate-800">Upload CSV file</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="mt-4 w-full cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-white/90 px-4 py-5 text-sm text-slate-700 transition focus:border-cyan-500 focus:outline-none"
              />
              {fileName ? <p className="mt-3 text-sm text-slate-500">Selected file: <span className="font-semibold text-slate-800">{fileName}</span></p> : null}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  onClick={handleSaveToDatabase}
                  disabled={saving || unsavedValidRows.length === 0 || parsedCount === 0}
                >
                  {saving ? 'Saving...' : 'Confirm & Save to Database'}
                </Button>
                <Button type="button" variant="outline" onClick={resetState} className="text-slate-700 hover:text-slate-900">
                  Clear Upload
                </Button>
              </div>
            </label>
          </div>
        </div>
      </section>

      {errors.length > 0 ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50/70 p-5 text-sm text-rose-700 shadow-sm">
          <div className="font-semibold">CSV Validation Errors</div>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
            {errors.map((error, index) => <li key={index}>{error}</li>)}
          </ul>
        </div>
      ) : null}

      {feedback ? (
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 shadow-sm">
          {feedback}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_15px_40px_rgba(15,23,42,0.04)] overflow-x-auto">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">CSV Preview</p>
              <p className="text-sm text-slate-500">Review rows before saving to the system.</p>
            </div>
            <p className="text-sm text-slate-500">Page {currentPage} of {pageCount}</p>
          </div>

          <div className="min-w-[640px]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3 pr-4 font-semibold text-slate-700">Row</th>
                  <th className="py-3 pr-4 font-semibold text-slate-700">Student ID</th>
                  <th className="py-3 pr-4 font-semibold text-slate-700">Student Name</th>
                  <th className="py-3 pr-4 font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.map((item) => (
                  <tr key={`${item.row}-${item.studentId}`} className="border-b border-slate-100">
                    <td className="py-3 pr-4 text-slate-600">{item.row}</td>
                    <td className="py-3 pr-4 font-medium text-slate-900">{item.studentId || '-'}</td>
                    <td className="py-3 pr-4 text-slate-700">{item.fullName || '-'}</td>
                    <td className="py-3 pr-4">
                      {item.saved ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Saved</span>
                      ) : item.valid ? (
                        <span className="inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">Valid</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">Invalid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">Showing {currentRows.length} rows on this page.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
                disabled={currentPage === pageCount}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
