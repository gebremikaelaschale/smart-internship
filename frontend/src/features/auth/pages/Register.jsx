import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { authAPI } from '../authAPI';
import ErrorMessage from '@/components/common/ErrorMessage';
import useAuth from '@/hooks/useAuth';
import { isStrongPassword, isValidGoogleEmail, startsWithCapitalLetter } from '@/utils/authValidation';
import EthiopianPhoneInput, { validateEthiopianPhone } from '@/components/ui/EthiopianPhoneInput';
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

function SparklesIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M12 2l1.5 5.2L19 9l-5.5 1.8L12 16l-1.5-5.2L5 9l5.5-1.8L12 2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 14l.7 2.4L22 17l-1.8.6-.7 2.4-.7-2.4L17 17l1.8-.6.7-2.4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const auth = useAuth();
  const redirectTimerRef = useRef(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [successToastVisible, setSuccessToastVisible] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'student',
    password: ''
  });

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const playSuccessSound = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 0.12);

      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.025, audioContext.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.22);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.24);

      oscillator.onended = () => {
        audioContext.close().catch(() => {});
      };
    } catch {
      // silent fallback if audio is blocked
    }
  };

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

      const phoneError = validateEthiopianPhone(form.phone);
      if (phoneError) {
        errors.phone = phoneError;
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
        phone: form.phone ? `+251${form.phone}` : null,
        role: form.role
      });

      auth.setSession({ user: data.user, token: data.token });
      const role = data.user?.role || form.role;
      const adminType = data.user?.adminType;
      const redirectPath = role === 'student' ? '/student/profile' : resolveDashboardRoute(role, adminType);

      setSuccessToastVisible(true);
      playSuccessSound();

      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }

      redirectTimerRef.current = setTimeout(() => {
        setSuccessToastVisible(false);
        navigate(redirectPath, { replace: true });
      }, 4000);
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
      <AnimatePresence>
        {successToastVisible ? (
          <motion.div
            key="registration-success-toast"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className="fixed bottom-5 right-5 z-[100] w-[min(92vw,460px)] rounded-2xl border border-emerald-500/45 bg-emerald-50/85 p-4 text-slate-900 shadow-[0_18px_45px_rgba(16,185,129,0.18)] backdrop-blur-xl"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/20">
                <SparklesIcon />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-['Inter'] text-sm font-semibold leading-6 text-[#002147]">
                  Account Created Successfully! Welcome to the UOG Internship Studio.
                </p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-700/80">
                  Taking you to your next step
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
                <EthiopianPhoneInput
                  value={form.phone}
                  onChange={(digits) => onFieldChange('phone', digits)}
                  error={fieldErrors.phone}
                />
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
