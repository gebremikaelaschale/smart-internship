import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import { adminAPI } from '../adminAPI';

export default function EvaluationsAdmin() {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvaluations = async () => {
    try {
      setLoading(true);
      const { data } = await adminAPI.getEvaluations();
      setEvaluations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load evaluations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvaluations();
  }, []);

  return (
    <Card title="Student Evaluations" description="View performance reviews and grades submitted by employer supervisors.">
      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading evaluations...</p>
      ) : (
        <>
          {evaluations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No evaluations found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Student</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">College / Dept</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Internship</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 text-center">Rating</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 text-center">Score</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Supervisor Feedback</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {evaluations.map((ev) => (
                    <tr key={ev._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{ev.studentId?.fullName || ev.studentId?.name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">{ev.studentId?.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{ev.studentId?.college || '-'}</div>
                        <div className="text-xs text-slate-500">{ev.studentId?.department || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 font-medium">{ev.internshipId?.title || 'Internship'}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center text-amber-500">
                          {'★'.repeat(ev.performanceRating)}{'☆'.repeat(5 - ev.performanceRating)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${ev.score >= 80 ? 'bg-green-100 text-green-700' : ev.score >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                          {ev.score}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="line-clamp-2 text-slate-600 max-w-xs" title={ev.comments}>{ev.comments}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
