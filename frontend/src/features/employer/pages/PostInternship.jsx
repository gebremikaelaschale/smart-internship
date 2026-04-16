import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { employerAPI } from '../employerAPI';

const INITIAL_FORM = {
  title: '',
  description: '',
  skillInput: '',
  skills: [],
  duration: '',
  startDate: '',
  endDate: '',
  slots: ''
};

export default function PostInternship() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const parsedSkills = useMemo(
    () => form.skills,
    [form.skills]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const addSkill = () => {
    const nextSkill = form.skillInput.trim();
    if (!nextSkill) {
      return;
    }

    const exists = form.skills.some((skill) => skill.toLowerCase() === nextSkill.toLowerCase());
    if (exists) {
      setForm((prev) => ({ ...prev, skillInput: '' }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      skills: [...prev.skills, nextSkill],
      skillInput: ''
    }));
  };

  const handleSkillsKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkill();
    }
  };

  const removeSkill = (skillToRemove) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove)
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.title || !form.description || !form.duration || !form.startDate || !form.endDate || !form.slots) {
      setError('Please fill all required internship fields.');
      return;
    }

    if (parsedSkills.length === 0) {
      setError('Please add at least one skill tag.');
      return;
    }

    if (new Date(form.endDate) < new Date(form.startDate)) {
      setError('End date must be the same as or after start date.');
      return;
    }

    const studentsNeeded = Number(form.slots);
    if (!Number.isInteger(studentsNeeded) || studentsNeeded < 1) {
      setError('Slots must be at least 1.');
      return;
    }

    try {
      setSubmitting(true);
      await employerAPI.createInternship({
        title: form.title.trim(),
        description: form.description.trim(),
        requiredSkills: parsedSkills,
        location: 'Not specified',
        duration: form.duration.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        deadline: form.endDate,
        studentsNeeded,
        programType: 'Internship Program',
        trainingFocus: true
      });

      setSuccess('Internship posted successfully.');
      setForm(INITIAL_FORM);

      window.setTimeout(() => {
        navigate('/employer/my-programs');
      }, 900);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to post internship.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Post Internship" description="Create and publish an internship opportunity for students.">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <Input
          label="Title"
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Backend Engineering Internship"
          required
        />
        <Input
          label="Duration"
          name="duration"
          value={form.duration}
          onChange={handleChange}
          placeholder="e.g. 3 months"
          required
        />
        <Input
          label="Start Date"
          name="startDate"
          type="date"
          value={form.startDate}
          onChange={handleChange}
          required
        />
        <Input
          label="End Date"
          name="endDate"
          type="date"
          value={form.endDate}
          onChange={handleChange}
          required
        />
        <Input
          label="Slots"
          name="slots"
          type="number"
          min="1"
          value={form.slots}
          onChange={handleChange}
          placeholder="e.g. 10"
          required
        />

        <div className="md:col-span-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Skills (tags)</span>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
              <div className="mb-2 flex flex-wrap gap-2">
                {form.skills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-200"
                  >
                    {skill} x
                  </button>
                ))}
              </div>
              <input
                name="skillInput"
                value={form.skillInput}
                onChange={handleChange}
                onKeyDown={handleSkillsKeyDown}
                onBlur={addSkill}
                placeholder="Type a skill and press Enter"
                className="w-full border-0 bg-transparent px-1 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </label>
        </div>

        <div className="md:col-span-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={5}
              required
              placeholder="Describe the internship role, responsibilities, and expected outcomes."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>

        {error ? <p className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {success ? <p className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

        <div className="md:col-span-2 flex justify-end">
          <Button
            type="submit"
            disabled={submitting}
            className="border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
