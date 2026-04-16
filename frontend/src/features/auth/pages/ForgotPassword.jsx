import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../authAPI';
import ErrorMessage from '@/components/common/ErrorMessage';
import { isStrongPassword, isValidLoginEmail } from '@/utils/authValidation';

function MailIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function BrandLogo() {
  return (
    <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200/70">
      <img src="/uog-logo.jpg" alt="UOG logo" className="h-full w-full rounded-xl object-contain" />
    </div>
  );
}

function LeftPanel() {
  return (
    <aside className="auth-left-panel hidden w-full max-w-[390px] px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between">
      <div>
        <div className="mb-16 flex items-center gap-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-3xl bg-white/95 p-2.5 shadow-lg ring-1 ring-white/40">
            <img src="/uog-logo.jpg" alt="UOG logo" className="h-full w-full rounded-2xl object-contain" />
          </div>
          <div>
            <p className="text-3xl font-semibold leading-none tracking-tight">UOG</p>
            <p className="font-['Montserrat'] text-[28px] font-semibold uppercase italic leading-[0.95] tracking-wide">Reset</p>
            <p className="font-['Montserrat'] text-[28px] font-semibold uppercase italic leading-[0.95] tracking-wide">Access</p>
          </div>
        </div>

        <div className="space-y-6">
          <p className="font-['Montserrat'] text-[30px] font-semibold uppercase italic leading-none">Secure<span className="text-blue-300">Recovery.</span></p>
          <p className="text-[13px] uppercase tracking-[0.25em] text-blue-200">Code-based password reset</p>
          <div className="space-y-3 pt-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold tracking-wide">Email verification code</div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold tracking-wide">Secure password update</div>
          </div>
        </div>
      </div>

      <p className="text-xs uppercase tracking-[0.35em] text-blue-200">University of Gondar © 2026</p>
    </aside>
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const validateEmail = () => {
    if (!email) {
      setEmailError('Email is required');
      return false;
    }

    if (!isValidLoginEmail(email)) {
      setEmailError('Use a valid Gmail or UOG email address');
      return false;
    }

    return true;
  };

  const validateResetForm = () => {
    const nextErrors = {};

    if (!code.trim()) {
      nextErrors.code = 'Verification code is required';
    } else if (!/^\d{6}$/.test(code.trim())) {
      nextErrors.code = 'Enter the 6-digit code from your email';
    }

    if (!newPassword) {
      nextErrors.password = 'New password is required';
    } else if (!isStrongPassword(newPassword)) {
      nextErrors.password = 'Use 8+ chars with uppercase, lowercase, number, and special character';
    }

    if (newPassword !== confirmPassword) {
      nextErrors.password = 'Passwords do not match';
    }

    setCodeError(nextErrors.code || '');
    setPasswordError(nextErrors.password || '');

    return Object.keys(nextErrors).length === 0;
  };

  const handleSendCode = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(false);
    setResetMessage('');

    if (!validateEmail()) {
      return;
    }

    setLoading(true);

    try {
      await authAPI.forgotPassword({ email });
      setStep('reset');
      setResetMessage('A 6-digit verification code has been sent to your email.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError('');

    if (!validateResetForm()) {
      return;
    }

    setLoading(true);

    try {
      await authAPI.resetPassword({
        email,
        code,
        newPassword
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetToEmailStep = () => {
    setStep('email');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setCodeError('');
    setPasswordError('');
    setError('');
    setSuccess(false);
    setResetMessage('');
  };

  if (success) {
    return (
      <div className="auth-dot-bg relative flex min-h-screen overflow-hidden px-4 py-8 lg:px-8">
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-8 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />

        <LeftPanel />

        <main className="flex flex-1 items-center justify-center px-2 py-8 lg:px-16">
          <section className="w-full max-w-[720px] rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-8 lg:p-10">
            <div className="mb-8 flex items-center gap-4">
              <BrandLogo />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-600">Authentication</p>
                <h1 className="font-['Montserrat'] text-4xl font-bold uppercase italic leading-none text-slate-900 md:text-5xl">Password updated</h1>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-emerald-100">
                    <MailIcon />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Your password has been updated</p>
                    <p className="mt-1 text-sm text-emerald-700">You can now sign in using your new password.</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-800">
                  We also invalidated the previous reset code.
                </div>

                <Link
                  to="/login"
                  className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#08143a] to-[#0a4a8a] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:brightness-110"
                >
                  Back to login
                </Link>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-[#f7f9fc] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">Next step</p>
                <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <p>Use the login page to access your account with the new password.</p>
                  <p>If you don’t see the update immediately, refresh the page or sign in again.</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-dot-bg relative flex min-h-screen overflow-hidden px-4 py-8 lg:px-8">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-8 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />

      <LeftPanel />

      <main className="flex flex-1 items-center justify-center px-2 py-8 lg:px-16">
        <section className="w-full max-w-[720px] rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-8 lg:p-10">
          <div className="mb-8 flex items-center gap-4">
            <BrandLogo />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-600">Authentication</p>
              <h1 className="font-['Montserrat'] text-4xl font-bold uppercase italic leading-none text-slate-900 md:text-5xl">Reset password</h1>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)] md:p-6">
              <p className="max-w-xl text-base leading-7 text-slate-600 md:text-lg">
                {step === 'email'
                  ? 'Enter your email address and we’ll send a 6-digit verification code.'
                  : 'Enter the code from your email and choose a new password.'}
              </p>

              {resetMessage ? (
                <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  {resetMessage}
                </div>
              ) : null}

              {step === 'email' ? (
                <form className="mt-6 space-y-5" onSubmit={handleSendCode}>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Email Address</label>
                    <div className={`flex h-14 items-center rounded-[20px] border bg-[#f7f9fc] px-4 transition focus-within:ring-4 ${
                      emailError ? 'border-red-300 focus-within:border-red-300 focus-within:ring-red-100' : 'border-slate-200 focus-within:border-brand-500 focus-within:ring-brand-100'
                    }`}>
                      <input
                        name="email"
                        type="email"
                        placeholder=""
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (emailError) setEmailError('');
                        }}
                        className="h-full w-full bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
                      />
                      <MailIcon />
                    </div>
                    {emailError ? <p className="mt-2 text-sm text-red-500">{emailError}</p> : null}
                  </div>

                  {error ? <ErrorMessage message={error} /> : null}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex h-14 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-[#08143a] to-[#0a4a8a] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-white shadow-[0_18px_30px_rgba(8,20,58,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {loading ? 'Sending...' : 'Send Verification Code'}
                    </button>

                    <Link
                      to="/login"
                      className="inline-flex h-14 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-50"
                    >
                      Back to login
                    </Link>
                  </div>
                </form>
              ) : (
                <form className="mt-6 space-y-5" onSubmit={handleResetPassword}>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verification Code</label>
                    <div className={`flex h-14 items-center rounded-[20px] border bg-[#f7f9fc] px-4 transition focus-within:ring-4 ${
                      codeError ? 'border-red-300 focus-within:border-red-300 focus-within:ring-red-100' : 'border-slate-200 focus-within:border-brand-500 focus-within:ring-brand-100'
                    }`}>
                      <input
                        name="code"
                        type="text"
                        inputMode="numeric"
                        maxLength="6"
                        placeholder="6-digit code"
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value.replace(/\D/g, ''));
                          if (codeError) setCodeError('');
                        }}
                        className="h-full w-full bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-400 tracking-[0.3em]"
                      />
                      <ShieldIcon />
                    </div>
                    {codeError ? <p className="mt-2 text-sm text-red-500">{codeError}</p> : null}
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">New Password</label>
                    <div className="flex h-14 items-center rounded-[20px] border border-slate-200 bg-[#f7f9fc] px-4 transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (passwordError) setPasswordError('');
                        }}
                        placeholder="Enter new password"
                        className="h-full w-full bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Confirm Password</label>
                    <div className="flex h-14 items-center rounded-[20px] border border-slate-200 bg-[#f7f9fc] px-4 transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (passwordError) setPasswordError('');
                        }}
                        placeholder="Confirm password"
                        className="h-full w-full bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    {passwordError ? <p className="mt-2 text-sm text-red-500">{passwordError}</p> : null}
                  </div>

                  {error ? <ErrorMessage message={error} /> : null}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex h-14 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-[#08143a] to-[#0a4a8a] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-white shadow-[0_18px_30px_rgba(8,20,58,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {loading ? 'Resetting...' : 'Reset Password'}
                    </button>

                    <button
                      type="button"
                      onClick={resetToEmailStep}
                      className="inline-flex h-14 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-50"
                    >
                      Change Email
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-[#f7f9fc] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">How it works</p>
              <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                <p>We send a 6-digit code to your Google email address.</p>
                <p>Use the code once, then create a new password and return to login.</p>
                <p>If the code expires, request a fresh one from the first step.</p>
              </div>
              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">Fast code delivery</div>
                <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">Secure account recovery</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
