import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { employerAPI } from '../employerAPI';

const PAGE_SIZE = 6;

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Not specified';
  return date.toLocaleDateString();
}

export default function MyPrograms() {
  const [programs, setPrograms] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyProgramId, setBusyProgramId] = useState('');

  const loadPrograms = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await employerAPI.getMyPrograms();
      setPrograms(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load your programs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sortBy]);

  const handleToggleStatus = async (program) => {
    const nextStatus = String(program?.status || '').toLowerCase() === 'open' ? 'Closed' : 'Open';

    try {
      setBusyProgramId(String(program._id || ''));
      setError('');
      setMessage('');
      await employerAPI.updateProgramStatus(program._id, nextStatus);
      setMessage(`Program status updated to ${nextStatus}.`);
      await loadPrograms();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update status.');
    } finally {
      setBusyProgramId('');
    }
  };

  const handleDelete = async (program) => {
    const confirmed = window.confirm('Delete this internship program?');
    if (!confirmed) return;

    try {
      setBusyProgramId(String(program._id || ''));
      setError('');
      setMessage('');
      await employerAPI.deleteProgram(program._id);
      setMessage('Program deleted successfully.');
      await loadPrograms();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to delete program.');
    } finally {
      setBusyProgramId('');
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPrograms = programs.filter((program) => {
    const statusValue = String(program?.status || '').toLowerCase();
    const matchesStatus = statusFilter === 'all' || statusValue === statusFilter;
    if (!matchesStatus) return false;

    if (!normalizedQuery) return true;

    const searchableText = [
      program?.title,
      program?.description,
      program?.location,
      program?.duration,
      ...(Array.isArray(program?.requiredSkills) ? program.requiredSkills : [])
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });

  const sortedPrograms = [...filteredPrograms].sort((a, b) => {
    if (sortBy === 'oldest') {
      return new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0);
    }

    if (sortBy === 'title-asc') {
      return String(a?.title || '').localeCompare(String(b?.title || ''));
    }

    if (sortBy === 'title-desc') {
      return String(b?.title || '').localeCompare(String(a?.title || ''));
    }

    return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
  });

  const totalPages = Math.max(1, Math.ceil(sortedPrograms.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedPrograms = sortedPrograms.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="space-y-6">
      <Card title="My Programs" description="Manage internship programs posted by your organization.">
        {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search programs by title, skill, location..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />

          <Button type="button" variant={statusFilter === 'all' ? 'primary' : 'outline'} onClick={() => setStatusFilter('all')}>
            All
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant={statusFilter === 'open' ? 'primary' : 'outline'} onClick={() => setStatusFilter('open')}>
              Open
            </Button>
            <Button type="button" variant={statusFilter === 'closed' ? 'primary' : 'outline'} onClick={() => setStatusFilter('closed')}>
              Closed
            </Button>
          </div>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title-asc">Title A-Z</option>
            <option value="title-desc">Title Z-A</option>
          </select>
        </div>

        {loading ? <p className="text-sm text-slate-500">Loading programs...</p> : null}

        {!loading && filteredPrograms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No matching programs found.
          </p>
        ) : null}

        <div className="space-y-4">
          {pagedPrograms.map((program) => {
            const id = String(program?._id || '');
            const busy = busyProgramId === id;
            const skills = Array.isArray(program?.requiredSkills) ? program.requiredSkills.filter(Boolean) : [];

            return (
              <article key={id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{program.title || 'Untitled Program'}</h3>
                    <p className="mt-1 text-sm text-slate-600">{program.description || 'No description provided.'}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${String(program.status || '').toLowerCase() === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                    {program.status || 'Open'}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                  <p><span className="font-semibold text-slate-700">Duration:</span> {program.duration || 'Not specified'}</p>
                  <p><span className="font-semibold text-slate-700">Students Needed:</span> {program.studentsNeeded || 'Not specified'}</p>
                  <p><span className="font-semibold text-slate-700">Start Date:</span> {formatDate(program.startDate)}</p>
                  <p><span className="font-semibold text-slate-700">End Date:</span> {formatDate(program.endDate)}</p>
                </div>

                {skills.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {skills.slice(0, 8).map((skill) => (
                      <span key={`${id}-${skill}`} className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    as={Link}
                    to={`/employer/applicants?programId=${id}`}
                    variant="primary"
                    size="sm"
                  >
                    View Applicants
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => handleToggleStatus(program)}
                  >
                    {busy ? 'Working...' : String(program.status || '').toLowerCase() === 'open' ? 'Close Program' : 'Reopen Program'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => handleDelete(program)}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        {!loading && filteredPrograms.length > PAGE_SIZE ? (
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Showing {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filteredPrograms.length)} of {filteredPrograms.length}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" disabled={safePage <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </Button>
              <span className="text-sm font-medium text-slate-700">Page {safePage} of {totalPages}</span>
              <Button type="button" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
