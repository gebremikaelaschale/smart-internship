import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { adminAPI } from '@/features/admin/adminAPI';
import { API_BASE_URL } from '@/utils/constants';
import OfficialEvaluationForm from '@/features/evaluation/components/OfficialEvaluationForm';
import { Download, Eye, Loader2 } from 'lucide-react';

function getStudentLabel(item) {
  return item?.studentId?.fullName || item?.studentId?.name || 'Unknown Student';
}

function getDepartmentLabel(item) {
  return item?.studentId?.department || '-';
}

function getCollegeLabel(item) {
  return item?.studentId?.college || '-';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
}

function formatCriteriaLabel(label) {
  return String(label || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getAuthToken() {
  return localStorage.getItem('token') || '';
}

function getDownloadFileName(response, fallbackName) {
  const contentDisposition = response?.headers?.['content-disposition'] || response?.headers?.['Content-Disposition'] || '';
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
  const encodedName = match?.[1] || match?.[2];

  if (encodedName) {
    try {
      return decodeURIComponent(encodedName.replace(/"/g, ''));
    } catch {
      return encodedName.replace(/"/g, '');
    }
  }

  return fallbackName;
}

function getScoreTone(score) {
  if (score >= 85) {
    return {
      ring: 'from-emerald-400 via-emerald-500 to-teal-600',
      badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      label: 'Excellent'
    };
  }

  if (score >= 65) {
    return {
      ring: 'from-sky-400 via-blue-500 to-indigo-600',
      badge: 'bg-blue-50 text-blue-700 ring-blue-200',
      label: 'Strong'
    };
  }

  return {
    ring: 'from-amber-400 via-orange-500 to-rose-500',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    label: 'Developing'
  };
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value || '-'}</p>
    </div>
  );
}

export default function CompletedEvaluations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [companyProfile, setCompanyProfile] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await adminAPI.getEvaluations({ page: 1, limit: 1000 });
        if (!active) return;

        const rows = Array.isArray(data?.items) ? data.items : [];
        const submitted = rows.filter((row) => {
          const status = String(row?.evaluationStatus || '').trim().toLowerCase();
          return status === 'submitted' || status === 'completed' || Boolean(row?.officialPdf?.fileName || row?.officialPdf?.data);
        });
        setItems(submitted);
      } catch (fetchError) {
        if (!active) return;
        setError(fetchError?.response?.data?.message || 'Failed to load submitted documents.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => items, [items]);

  const selectedDocument = useMemo(
    () => rows.find((row) => String(row?._id) === String(selectedId)) || null,
    [rows, selectedId]
  );

  const officialPreviewData = useMemo(() => {
    if (!selectedDocument) return null;

    const student = selectedDocument?.studentId || {};
    const acceptanceForm = selectedDocument?.acceptanceForm || {};

    return {
      acceptanceData: {
        studentName: getStudentLabel(selectedDocument),
        studentIdNumber: student?.studentIdNumber || student?.idNumber || student?.id_number || '',
        studentDepartment: student?.department || getDepartmentLabel(selectedDocument),
        studentYear: student?.year || student?.academicYear || '',
        studentPhone: student?.phone || '',
        studentEmail: student?.email || '',
        studentSignature: student?.studentSignatureUrl || student?.studentSignature || student?.student_signature || '',
        studentPhoto: student?.profileImage || '',
        companyName: acceptanceForm?.companyName || '',
        placeTown: acceptanceForm?.placeTown || '',
        contactPerson: acceptanceForm?.contactPerson || '',
        companyPhone: acceptanceForm?.companyPhone || '',
        companyEmail: acceptanceForm?.companyEmail || '',
        representativeName: acceptanceForm?.representativeName || '',
        representativeSignature: acceptanceForm?.representativeSignature || '',
        representativeDate: acceptanceForm?.representativeDate || '',
        academicHeader: {
          college: student?.college || getCollegeLabel(selectedDocument),
          department: student?.department || getDepartmentLabel(selectedDocument),
          hasAcademicInfo: Boolean(student?.college || student?.department),
          fallback: 'University of Gondar (College/Department Pending)'
        }
      },
      evaluationData: {
        studentName: getStudentLabel(selectedDocument),
        studentIdNumber: student?.studentIdNumber || student?.idNumber || student?.id_number || '',
        studentDepartment: student?.department || getDepartmentLabel(selectedDocument),
        studentPhone: student?.phone || '',
        studentEmail: student?.email || '',
        supervisorName: selectedDocument?.supervisorName || selectedDocument?.supervisorId?.fullName || selectedDocument?.supervisorId?.name || '',
        companyName: acceptanceForm?.companyName || '',
        contactPerson: acceptanceForm?.contactPerson || '',
        companyLogo: companyProfile?.logoUrl || companyProfile?.logo || '',
        companySignature: acceptanceForm?.representativeSignature || '',
        criteriaScores: selectedDocument?.criteriaScores || {},
        score: selectedDocument?.score ?? 0,
        evaluationDate: formatDate(selectedDocument?.dateEvaluated || selectedDocument?.createdAt),
        academicHeader: {
          college: student?.college || getCollegeLabel(selectedDocument),
          department: student?.department || getDepartmentLabel(selectedDocument),
          hasAcademicInfo: Boolean(student?.college || student?.department),
          fallback: 'University of Gondar (College/Department Pending)'
        }
      }
    };
  }, [companyProfile, selectedDocument]);

  useEffect(() => {
    let active = true;

    const loadCompanyProfile = async () => {
      if (!selectedDocument?._id || !selectedDocument?.companyId) {
        setCompanyProfile(null);
        setPreviewLoading(false);
        setPreviewError('');
        return;
      }

      try {
        setPreviewLoading(true);
        setPreviewError('');
        const { data } = await adminAPI.getCompanyProfile(selectedDocument.companyId);
        if (!active) return;
        setCompanyProfile(data?.item || data?.company || data || null);
      } catch (companyError) {
        if (!active) return;
        setCompanyProfile(null);
        setPreviewError(companyError?.response?.data?.message || 'Failed to load the company identity for this document.');
      } finally {
        if (active) setPreviewLoading(false);
      }
    };

    loadCompanyProfile();

    return () => {
      active = false;
    };
  }, [selectedDocument]);

  const handleAdminDownload = async (evaluation) => {
    const evaluationId = evaluation?._id;
    if (!evaluationId) return;

    const token = getAuthToken();
    if (!token) {
      setError('No token provided. Please sign in again and retry the download.');
      return;
    }

    const fallbackName = evaluation?.officialPdf?.fileName || `Evaluation_${getStudentLabel(evaluation)}.pdf`;

    try {
      setError('');
      setDownloadingId(evaluationId);

      const response = await axios.get(`${API_BASE_URL}/evaluation/admin/${evaluationId}/download-pdf`, {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const fileName = getDownloadFileName(response, fallbackName);
      const fileUrl = window.URL.createObjectURL(response.data);
      const anchor = document.createElement('a');

      anchor.href = fileUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(fileUrl);
    } catch (downloadError) {
      const responseMessage = downloadError?.response?.data?.message;
      setError(responseMessage || 'Failed to download the official PDF. Please try again.');
    } finally {
      setDownloadingId('');
    }
  };

  return (
    <>
      <Card
        title="Submitted Documents"
        description="Official evaluation forms submitted by industry partners for students in your department."
      >
        {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-500">Loading submitted documents...</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No submitted documents are available yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead className="bg-slate-50/90 backdrop-blur">
                  <tr>
                    <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Student</th>
                    <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">College / Dept</th>
                    <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Internship</th>
                    <th className="px-5 py-4 text-center text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Score</th>
                    <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Submitted</th>
                    <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-transparent">
                  {rows.map((row) => {
                    const score = Number(row?.score || 0);
                    const status = String(row?.evaluationStatus || 'Submitted').trim();
                    const scoreTone = getScoreTone(score);
                    const isDownloading = downloadingId === row._id;
                    return (
                      <tr
                        key={row._id}
                        className="group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(15,23,42,0.08)]"
                      >
                        <td className="border-b border-slate-100 px-5 py-4 first:rounded-l-2xl group-hover:bg-white">
                          <div className="font-semibold text-slate-900">{getStudentLabel(row)}</div>
                          <div className="text-xs text-slate-500">{row.studentId?.email || 'No email'}</div>
                        </td>
                        <td className="border-b border-slate-100 px-5 py-4 group-hover:bg-white">
                          <div className="text-slate-700">{getCollegeLabel(row)}</div>
                          <div className="text-xs text-slate-500">{getDepartmentLabel(row)}</div>
                        </td>
                        <td className="border-b border-slate-100 px-5 py-4 group-hover:bg-white">
                          <div className="font-medium text-slate-900">{row.internshipId?.title || 'Internship'}</div>
                        </td>
                        <td className="border-b border-slate-100 px-5 py-4 text-center group-hover:bg-white">
                          <div className="mx-auto inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
                            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${scoreTone.ring} text-[11px] font-black text-white shadow-lg`}>
                              {score}%
                            </span>
                            <div className="text-left leading-tight">
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Score</p>
                              <p className={`mt-0.5 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${scoreTone.badge}`}>
                                {scoreTone.label}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-slate-100 px-5 py-4 whitespace-nowrap text-slate-500 group-hover:bg-white">
                          <div>{formatDate(row?.dateEvaluated || row?.createdAt)}</div>
                          <div className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">{status}</div>
                        </td>
                        <td className="border-b border-slate-100 px-5 py-4 text-right group-hover:bg-white last:rounded-r-2xl">
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedId(row._id)}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md"
                            >
                              <Eye className="h-4 w-4" />
                              View Online
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdminDownload(row)}
                              disabled={isDownloading}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-700 to-slate-900 px-4 py-3 text-xs font-bold text-white shadow-[0_12px_28px_rgba(30,41,59,0.22)] transition-all hover:-translate-y-0.5 hover:from-indigo-600 hover:to-slate-800 hover:shadow-[0_16px_34px_rgba(30,41,59,0.28)] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                              {isDownloading ? 'Generating...' : 'Download PDF'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Showing {rows.length} submitted document{rows.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        )}
      </Card>

      {selectedDocument ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-3 py-4 sm:px-4">
          <div className="w-full max-w-[calc(100vw-1rem)] rounded-[28px] border-2 border-black bg-white shadow-[0_35px_90px_rgba(15,23,42,0.34)]">
            <div className="flex items-center justify-between gap-4 border-b-2 border-black px-6 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Official University of Gondar Form</p>
                <h3 className="truncate text-2xl font-black text-black">{getStudentLabel(selectedDocument)}</h3>
                <p className="text-sm font-semibold text-slate-600">
                  {selectedDocument?.officialPdf?.fileName || `Evaluation_${getStudentLabel(selectedDocument)}.pdf`}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAdminDownload(selectedDocument)}
                  disabled={downloadingId === selectedDocument._id}
                  className="rounded-xl border border-slate-300 px-5 py-3 font-black text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {downloadingId === selectedDocument._id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {downloadingId === selectedDocument._id ? 'Generating...' : 'Download this PDF'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setSelectedId('')}
                  className="rounded-xl bg-slate-900 px-5 py-3 font-black text-white transition hover:bg-slate-800"
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="max-h-[calc(100vh-110px)] overflow-y-auto bg-[#f1f5f9] p-4">
              {previewError ? (
                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{previewError}</p>
              ) : null}

              {previewLoading ? (
                <div className="flex items-center justify-center rounded-[24px] border-2 border-black bg-white p-8 text-center">
                  <div>
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-700" />
                    <p className="mt-4 text-sm font-semibold text-slate-600">Loading official form preview...</p>
                  </div>
                </div>
              ) : officialPreviewData ? (
                <div className="overflow-x-auto">
                  <OfficialEvaluationForm
                    readOnly
                    acceptanceData={officialPreviewData.acceptanceData}
                    evaluationData={officialPreviewData.evaluationData}
                  />
                </div>
              ) : (
                <div className="rounded-[24px] border-2 border-black bg-white p-8 text-center">
                  <p className="text-lg font-black text-black">No document loaded</p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">The official form could not be prepared for this submission.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}