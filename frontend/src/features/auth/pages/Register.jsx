import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../authAPI';
import ErrorMessage from '@/components/common/ErrorMessage';
import useAuth from '@/hooks/useAuth';
import { isStrongPassword, isValidGoogleEmail, startsWithCapitalLetter } from '@/utils/authValidation';
import { resolveDashboardRoute } from '@/utils/roleRedirect';

const STEPS = [
  { id: 1, title: 'Basic Details', subtitle: 'Your name and contact' },
  { id: 2, title: 'Your Role', subtitle: 'Choose your role' },
  { id: 3, title: 'Password', subtitle: 'Secure your account' }
];

function StepIcon({ active, completed, icon }) {
  return (
    <div className={`grid h-12 w-12 place-items-center rounded-2xl border transition ${
      active
        ? 'border-white/30 bg-white text-blue-900 shadow-[0_10px_30px_rgba(0,0,0,0.25)]'
        : completed
        ? 'border-green-300/40 bg-green-300 text-blue-900'
        : 'border-white/10 bg-transparent text-blue-300'
    }`}>
      <span className="text-lg font-semibold">{completed ? '✓' : icon}</span>
    </div>
  );
}

function StepSidebar({ step }) {
  return (
    <aside className="auth-left-panel hidden w-full max-w-[390px] px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between">
      <div>
        <div className="mb-16 flex items-center gap-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-3xl bg-white/95 p-2.5 shadow-lg ring-1 ring-white/40">
            <img src="/uog-logo.jpg" alt="UOG logo" className="h-full w-full rounded-2xl object-contain" />
          </div>
          <div>
              <p className="text-3xl font-semibold leading-none tracking-tight">UOG</p>
              <p className="font-['Montserrat'] text-[28px] font-semibold uppercase italic leading-[0.95] tracking-wide">Internship</p>
              <p className="font-['Montserrat'] text-[28px] font-semibold uppercase italic leading-[0.95] tracking-wide">Portal</p>
          </div>
        </div>

        <div className="space-y-8">
          {STEPS.map((item) => {
            const active = item.id === step;
            const completed = item.id < step;
            const icon = item.id === 1 ? '◉' : item.id === 2 ? '◍' : '◌';

            return (
              <div key={item.id} className="flex items-center gap-4">
                <StepIcon active={active} completed={completed} icon={icon} />
                <div>
                  <p className={`text-lg font-semibold uppercase tracking-wide ${active ? 'text-white' : 'text-blue-300/60'}`}>{item.title}</p>
                  <p className={`text-xs uppercase tracking-[0.18em] ${active ? 'text-blue-200' : 'text-blue-300/40'}`}>{item.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs uppercase tracking-[0.35em] text-blue-200">University of Gondar © 2026</p>
    </aside>
  );
}

function FieldLabel({ children }) {
  return <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{children}</label>;
}

function EyeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'student',
    password: ''
  });

  const copyByStep = {
    1: { title: 'Basic Info', subtitle: 'Please fill in your details to create an account.' },
    2: { title: 'Setup Role', subtitle: 'Please fill in your details to create an account.' },
    3: { title: 'Password', subtitle: 'Please fill in your details to create an account.' }
  };

  const validateStep = (currentStep) => {
    const errors = {};

    if (currentStep === 1) {
      if (!form.fullName.trim()) {
        errors.fullName = 'Full name is required';
      } else if (!startsWithCapitalLetter(form.fullName)) {
        errors.fullName = 'Full name must start with a capital letter';
      }

      if (!form.email) {
        errors.email = 'Email is required';
      } else if (!isValidGoogleEmail(form.email)) {
        errors.email = 'Please enter a valid Google email format';
      }

      if (form.phone && !/^\+?[0-9\s-]{8,15}$/.test(form.phone)) {
        errors.phone = 'Please enter a valid phone number';
      }
    }

    if (currentStep === 2 && !form.role) {
      errors.role = 'Please choose your role';
    }

    if (currentStep === 3) {
      if (!form.password) {
        errors.password = 'Password is required';
      } else if (!isStrongPassword(form.password)) {
        errors.password = 'Use 8+ chars with uppercase, lowercase, number, and special character.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onFieldChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const submitRegistration = async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await authAPI.register({
        name: form.fullName,
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone || null,
        role: form.role
      });

      auth.setSession({ user: data.user, token: data.token });
      navigate(resolveDashboardRoute(data.user?.role || form.role, data.user?.adminType), { replace: true });
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Unable to create account. Please try again.';
      const status = requestError.response?.status;
      const lowerMessage = message.toLowerCase();

      if (status === 409 || lowerMessage.includes('already exists') || lowerMessage.includes('already registered')) {
        const friendlyEmailMessage = 'This email is already registered. Please sign in or use another email address.';
        setFieldErrors((prev) => ({ ...prev, email: friendlyEmailMessage }));
        setError('Account already exists for this email. Please sign in or use Forgot Password.');
        setStep(1);
        return;
      }

      if (lowerMessage.includes('email')) {
        setFieldErrors((prev) => ({ ...prev, email: message }));
        setError('Please review your email and try again.');
        setStep(1);
      } else if (lowerMessage.includes('password')) {
        setFieldErrors((prev) => ({ ...prev, password: message }));
        setStep(3);
      } else if (lowerMessage.includes('full name') || lowerMessage.includes('name')) {
        setFieldErrors((prev) => ({ ...prev, fullName: message }));
        setError('Please correct your full name and try again.');
        setStep(1);
      } else if (lowerMessage.includes('role')) {
        setFieldErrors((prev) => ({ ...prev, role: message }));
        setStep(2);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (!validateStep(step)) return;

    if (step < 3) {
      setStep((prev) => prev + 1);
      setError('');
      return;
    }

    submitRegistration();
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
      setError('');
    }
  };

  return (
    <div className="auth-dot-bg flex min-h-screen">
      <StepSidebar step={step} />

      <main className="flex flex-1 items-center justify-center px-4 py-10 lg:px-16">
        <section className="w-full max-w-[600px]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Step {step} of 3</p>
          <h1 className="font-['Montserrat'] text-5xl font-bold uppercase italic leading-none text-slate-900">{copyByStep[step].title}</h1>
          <p className="mb-8 mt-2 text-xl font-normal text-slate-500">{copyByStep[step].subtitle}</p>

          {error ? <ErrorMessage message={error} /> : null}

          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <FieldLabel>Full Name</FieldLabel>
                <input
                  value={form.fullName}
                  onChange={(e) => onFieldChange('fullName', e.target.value)}
                  placeholder=""
                  className={`h-14 w-full rounded-[20px] border bg-[#f0f4fb] px-5 text-lg font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                    fieldErrors.fullName ? 'border-red-300 focus:border-red-300 focus:ring-red-100' : 'border-slate-200 focus:border-blue-300 focus:ring-blue-100'
                  }`}
                />
                {fieldErrors.fullName ? <p className="mt-1 text-sm text-red-500">{fieldErrors.fullName}</p> : null}
              </div>

              <div>
                <FieldLabel>Email Address</FieldLabel>
                <input
                  value={form.email}
                  onChange={(e) => onFieldChange('email', e.target.value)}
                  placeholder=""
                  className={`h-14 w-full rounded-[20px] border bg-[#f0f4fb] px-5 text-lg font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                    fieldErrors.email ? 'border-red-300 focus:border-red-300 focus:ring-red-100' : 'border-slate-200 focus:border-blue-300 focus:ring-blue-100'
                  }`}
                />
                {fieldErrors.email ? <p className="mt-1 text-sm text-red-500">{fieldErrors.email}</p> : null}
              </div>

              <div>
                <FieldLabel>Phone Number (Optional for SMS recovery)</FieldLabel>
                <input
                  value={form.phone}
                  onChange={(e) => onFieldChange('phone', e.target.value)}
                  placeholder="+251 91..."
                  className={`h-14 w-full rounded-[20px] border bg-[#f0f4fb] px-5 text-lg font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                    fieldErrors.phone ? 'border-red-300 focus:border-red-300 focus:ring-red-100' : 'border-slate-200 focus:border-blue-300 focus:ring-blue-100'
                  }`}
                />
                {fieldErrors.phone ? <p className="mt-1 text-sm text-red-500">{fieldErrors.phone}</p> : null}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <FieldLabel>Select Role</FieldLabel>
              <select
                value={form.role}
                onChange={(e) => onFieldChange('role', e.target.value)}
                className="h-14 w-full rounded-[20px] border border-slate-200 bg-[#f0f4fb] px-5 text-lg font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="student">Student</option>
                <option value="employer">Employer</option>
              </select>
              {fieldErrors.role ? <p className="mt-1 text-sm text-red-500">{fieldErrors.role}</p> : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div>
                <FieldLabel>Create Password</FieldLabel>
                <div className={`flex h-14 items-center overflow-hidden rounded-[20px] border bg-[#f0f4fb] transition focus-within:ring-4 ${
                  fieldErrors.password ? 'border-red-300 focus-within:border-red-300 focus-within:ring-red-100' : 'border-slate-200 focus-within:border-blue-300 focus-within:ring-blue-100'
                }`}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => onFieldChange('password', e.target.value)}
                    placeholder="••••••••"
                    className="h-full w-full bg-transparent px-5 text-lg font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="mr-4 rounded-full p-2 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon />
                  </button>
                </div>
                {fieldErrors.password ? <p className="mt-1 text-sm font-semibold italic text-red-500">{fieldErrors.password}</p> : null}
              </div>

              <div className="rounded-3xl bg-blue-100 px-5 py-4 text-xs font-semibold uppercase tracking-[0.06em] text-blue-700">
                By creating an account, you agree to our university policies.
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="h-14 w-14 rounded-3xl bg-slate-200 text-xl font-medium text-slate-500 transition hover:bg-slate-300"
              >
                ‹
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className={`h-14 flex-1 rounded-full text-sm font-semibold uppercase tracking-[0.16em] text-white shadow-[0_18px_30px_rgba(3,40,91,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70 ${step === 3 ? 'bg-gradient-to-r from-[#08143a] to-[#091f59]' : 'bg-gradient-to-r from-[#083f7f] to-[#074988]'}`}
            >
              {loading ? 'Creating Account...' : step === 3 ? 'Create Account  ✦' : 'Next Step  →'}
            </button>
          </div>

          <p className="pt-8 text-center text-lg font-medium italic text-slate-400">
            Already have an account? <Link to="/login" className="font-semibold text-blue-800 hover:text-blue-900">Sign In</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
