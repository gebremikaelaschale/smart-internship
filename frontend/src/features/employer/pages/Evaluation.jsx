import React, { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { employerAPI } from '../employerAPI';

const INITIAL_FORM = {
  target: '',
  performanceRating: 4,
  comments: '',
  score: ''
};

export default function Evaluation() {
  const [targets, setTargets] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadTargets = async () => {
      try {
        setLoadingTargets(true);
        setError('');
        const { data } = await employerAPI.getEvaluationTargets();
        if (!active) return;
        const safeTargets = Array.isArray(data) ? data : [];
        setTargets(safeTargets);
        if (safeTargets.length > 0) {
          setForm((prev) => ({ ...prev, target: String(safeTargets[0].applicationId || '') }));
        }
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load students for evaluation.');
      } finally {
        if (active) setLoadingTargets(false);
      }
    };

    loadTargets();

    return () => {
      active = false;
    };
  }, []);

  const selectedTarget = useMemo(
    () => targets.find((item) => String(item?.applicationId || '') === String(form.target || '')) || null,
    [targets, form.target]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const setRating = (value) => {
    setForm((prev) => ({ ...prev, performanceRating: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!selectedTarget) {
      setError('Please choose a student to evaluate.');
      return;
    }

    const score = Number(form.score);
    if (Number.isNaN(score) || score < 0 || score > 100) {
      setError('Score must be between 0 and 100.');
      return;
    }

    if (!String(form.comments || '').trim()) {
      setError('Feedback is required.');
      return;
    }

    try {
      setSubmitting(true);
      await employerAPI.submitEvaluation({
        applicationId: selectedTarget.applicationId,
        studentId: selectedTarget.studentId,
        internshipId: selectedTarget.internshipId,
        performanceRating: Number(form.performanceRating),
        comments: String(form.comments || '').trim(),
        score
      });

      setMessage('Evaluation submitted successfully.');
      setForm((prev) => ({
        ...INITIAL_FORM,
        target: prev.target
      }));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to submit evaluation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Evaluation" description="Evaluate accepted students from your internships.">
      {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      {loadingTargets ? <p className="text-sm text-slate-500">Loading students...</p> : null}

      {!loadingTargets && targets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          No accepted students available for evaluation.
        </p>
      ) : null}

      {!loadingTargets && targets.length > 0 ? (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Student Name</span>
            <select
              name="target"
              value={form.target}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {targets.map((item) => (
                <option key={String(item?.applicationId || '')} value={String(item?.applicationId || '')}>
                  {item?.studentName || 'Unnamed Student'} - {item?.internshipTitle || 'Internship'}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Rating</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={`text-2xl ${value <= Number(form.performanceRating) ? 'text-amber-400' : 'text-slate-300'}`}
                  aria-label={`Set ${value} star rating`}
                >
                  {value <= Number(form.performanceRating) ? '★' : '☆'}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Feedback</span>
            <textarea
              name="comments"
              value={form.comments}
              onChange={handleChange}
              rows={5}
              placeholder="Share detailed feedback about performance, strengths, and areas for improvement."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Score %</span>
            <input
              type="number"
              name="score"
              min="0"
              max="100"
              value={form.score}
              onChange={handleChange}
              placeholder="e.g. 86"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              required
            />
          </label>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting} className="border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Submitting...' : 'Submit Evaluation'}
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
