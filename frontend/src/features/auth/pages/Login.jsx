import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../authAPI';
import ErrorMessage from '@/components/common/ErrorMessage';
import useAuth from '@/hooks/useAuth';
import { isValidLoginEmail } from '@/utils/authValidation';
import { resolveDashboardRoute } from '@/utils/roleRedirect';

function EyeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-6 10-6c2.4 0 4.4.8 6 1.9" />
      <path d="M22 12s-3.5 6-10 6c-2.4 0-4.4-.8-6-1.9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validateForm = () => {
    const errors = {};

    if (!form.email) {
      errors.email = 'Email is required';
    } else if (!isValidLoginEmail(form.email)) {
      errors.email = 'Use a valid Gmail or UOG email address';
    }

    if (!form.password) {
      errors.password = 'Password is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await authAPI.login(form);

      auth.setSession({ user: data.user, token: data.token });
      const role = data.user?.role || 'student';
      const adminType = String(data.user?.adminType || '').toLowerCase();
      navigate(resolveDashboardRoute(role, adminType), { replace: true });
    } catch (requestError) {
      const errorMessage = requestError.response?.data?.message;

      if (!requestError.response) {
        setError('Unable to reach the server. Check that backend is running and try again.');
        return;
      }

      if (errorMessage?.toLowerCase().includes('email')) {
        setFieldErrors((prev) => ({ ...prev, email: errorMessage }));
      } else if (errorMessage?.toLowerCase().includes('password')) {
        setFieldErrors((prev) => ({ ...prev, password: errorMessage }));
      } else {
        setError(errorMessage || 'Unable to sign in. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-dot-bg flex min-h-screen">
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

          <div className="space-y-6">
            <p className="font-['Montserrat'] text-[30px] font-semibold uppercase italic leading-none">Secure<span className="text-blue-300">Login.</span></p>
            <p className="text-[13px] uppercase tracking-[0.25em] text-blue-200">University Access Gate</p>
            <div className="space-y-3 pt-4">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold tracking-wide">University Data Protection</div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold tracking-wide">Live Account Verification</div>
            </div>
          </div>
        </div>

        <p className="text-xs uppercase tracking-[0.35em] text-blue-200">University of Gondar © 2026</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10 lg:px-16">
        <div className="w-full max-w-[560px]">
          <div className="mb-8 flex items-center gap-4">
            <div className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-md ring-1 ring-slate-200">
              <img src="/uog-logo.jpg" alt="UOG logo" className="h-full w-full rounded-xl object-contain" />
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none">UOG</p>
              <p className="font-['Montserrat'] text-xl font-semibold uppercase italic leading-[0.95] tracking-wide text-slate-700">Internship Portal</p>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Student Placement</p>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Secure Access</p>
          <h1 className="font-['Montserrat'] text-5xl font-bold uppercase italic leading-none text-slate-900">Login.</h1>
          <p className="mb-8 mt-2 text-xl font-normal text-slate-500">Welcome back! Please enter your details to continue.</p>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Email Address</label>
              <input
                name="email"
                type="email"
                placeholder=""
                value={form.email}
                onChange={handleChange}
                className={`h-14 w-full rounded-[20px] border bg-[#f0f4fb] px-5 text-lg font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                  fieldErrors.email ? 'border-red-300 focus:border-red-300 focus:ring-red-100' : 'border-slate-200 focus:border-blue-300 focus:ring-blue-100'
                }`}
              />
              {fieldErrors.email ? <p className="mt-1 text-sm text-red-500">{fieldErrors.email}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Password</label>
              <div className={`flex h-14 items-center overflow-hidden rounded-[20px] border bg-[#f0f4fb] transition focus-within:ring-4 ${
                fieldErrors.password ? 'border-red-300 focus-within:border-red-300 focus-within:ring-red-100' : 'border-slate-200 focus-within:border-blue-300 focus-within:ring-blue-100'
              }`}>
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  className="h-full w-full bg-transparent px-5 text-lg font-medium text-slate-900 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="mr-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {fieldErrors.password ? <p className="mt-1 text-sm text-red-500">{fieldErrors.password}</p> : null}
            </div>

            {error ? <ErrorMessage message={error} /> : null}

            <div className="flex items-center justify-end pt-1">
              <Link to="/forgot-password" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 hover:text-blue-700">
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-14 w-full rounded-full bg-gradient-to-r from-[#08143a] to-[#091f59] text-sm font-semibold uppercase tracking-[0.16em] text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Signing In...' : 'Login Now  ->'}
            </button>

            <p className="pt-4 text-center text-lg font-medium italic text-slate-400">
              New here?{' '}
              <Link
                to="/register"
                className="font-semibold text-brand-600 transition hover:text-brand-700 hover:underline hover:underline-offset-4"
              >
                Create an account
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
