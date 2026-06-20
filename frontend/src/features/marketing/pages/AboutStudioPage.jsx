import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  GraduationCap,
  MapPin,
  Menu,
  Phone,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
  Mail,
  LineChart
} from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'About Us', href: '/about' },
  { label: 'Leadership', href: '/#leadership' },
  { label: 'Partners', href: '/#industry-partners' },
  { label: 'Campus', href: '/#gallery' },
  { label: 'Stats', href: '/#stats' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Contact', href: '/#contact' }
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: 'easeOut' } }
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } }
};

const missionPillars = [
  {
    icon: Target,
    title: 'Easy to Use',
    text: 'Everything is digital and simple to follow.',
    tone: 'from-sky-50 via-white to-cyan-50',
    accent: 'text-sky-600'
  },
  {
    icon: Brain,
    title: 'Safe & Verified',
    text: 'We only work with trusted partners for students.',
    tone: 'from-indigo-50 via-white to-blue-50',
    accent: 'text-indigo-600'
  },
  {
    icon: LineChart,
    title: 'Real Growth',
    text: 'You get real work experience before you graduate.',
    tone: 'from-emerald-50 via-white to-green-50',
    accent: 'text-emerald-600'
  }
];

const engineSteps = [
  {
    step: '01',
    title: 'Companies Join Us',
    icon: Building2,
    tone: 'from-sky-50 via-white to-cyan-50',
    accent: 'text-sky-600',
    text: 'Organizations sign up and tell us what they do.'
  },
  {
    step: '02',
    title: 'We Check Them',
    icon: ShieldCheck,
    tone: 'from-amber-50 via-white to-yellow-50',
    accent: 'text-[#d4af37]',
    text: 'Our Super Admin checks every company to make sure they are safe and good for students.'
  },
  {
    step: '03',
    title: 'Students Sign Up',
    icon: GraduationCap,
    tone: 'from-emerald-50 via-white to-green-50',
    accent: 'text-emerald-600',
    text: 'Students create a simple profile with their skills and department.'
  },
  {
    step: '04',
    title: 'Smart Matching (AI)',
    icon: Cpu,
    tone: 'from-indigo-50 via-white to-blue-50',
    accent: 'text-indigo-600',
    text: 'Our system automatically finds the best company for each student based on their skills.'
  },
  {
    step: '05',
    title: 'You Start Working',
    icon: Rocket,
    tone: 'from-rose-50 via-white to-orange-50',
    accent: 'text-rose-600',
    text: 'The student gets placed and begins their professional journey.'
  }
];

function HomeStyleNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${scrolled ? 'border-slate-200 bg-white/92 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl' : 'border-transparent bg-transparent'}`}>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-xl ring-1 ring-white/70">
            <img src="/uog-logo.jpg" alt="University of Gondar logo" className="h-full w-full rounded-2xl object-cover" />
          </div>
          <div>
            <p className="font-['Montserrat'] text-base font-semibold text-[#002147]">UOG Internship Studio</p>
            <p className="text-xs text-[#002147]/70">University of Gondar</p>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 text-sm font-medium lg:absolute lg:left-1/2 lg:transform lg:-translate-x-1/2">
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || (item.href === '/about' && location.pathname === '/about');
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`group relative inline-flex items-center rounded-full px-3.5 py-2 text-[13px] font-medium transition-all duration-200 hover:bg-[#f0f4f8] hover:text-[#002147] ${isActive ? 'bg-[#fff8db] text-[#d4af37] shadow-[0_0_18px_rgba(212,175,55,0.22)]' : 'text-[#002147]'}`}
                >
                  <span className={`relative z-10 ${isActive ? 'drop-shadow-[0_0_10px_rgba(212,175,55,0.5)]' : ''}`}>{item.label}</span>
                  <span className={`absolute inset-x-2 -bottom-0.5 h-[2px] rounded-full bg-[#FFD700] transition-all duration-300 ${isActive ? 'w-[calc(100%-16px)] opacity-100' : 'w-0 opacity-0 group-hover:w-[calc(100%-16px)] group-hover:opacity-100'}`} />
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="hidden md:flex absolute right-6 top-3 items-center gap-3">
          <Link
            to="/login"
            className="rounded-full px-3 py-2 text-sm font-medium border border-transparent transition-colors duration-200 active:translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD700]/30 text-[#002147] hover:bg-[#f0f4f8]"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="rounded-full bg-[#FFD700] px-5 py-2.5 text-sm font-semibold text-[#002147] shadow-[0_18px_40px_rgba(255,215,0,0.22)] transition transform hover:-translate-y-0.5 hover:scale-105 active:translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD700]/40"
          >
            Sign Up
          </Link>
        </div>

        <button type="button" onClick={() => setOpen((current) => !current)} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors lg:hidden ${scrolled ? 'border-slate-200 bg-white text-[#002147]' : 'border-transparent bg-transparent text-[#002147]'}`} aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white/96 px-4 py-4 backdrop-blur-xl lg:hidden">
          <div className="space-y-1 text-sm font-medium text-slate-700">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-4 py-3 transition-all duration-200 hover:bg-[#f0f4f8] hover:text-[#002147] ${location.pathname === item.href ? 'bg-[#fff8db] text-[#d4af37]' : ''}`}
              >
                {item.label}
              </Link>
            ))}
            <Link to="/login" onClick={() => setOpen(false)} className="block rounded-xl border border-slate-200 px-4 py-3 text-center transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD700]/30">
              Sign In
            </Link>
            <Link to="/register" onClick={() => setOpen(false)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-4 py-3 font-semibold text-[#002147] active:scale-95 active:brightness-95">
              <Sparkles className="h-4 w-4" />
              Sign Up
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function HomeStyleFooter() {
  const handleScroll = (e, href) => {
    if (!href || !href.startsWith('#')) return;
    e.preventDefault();
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.pushState(null, '', window.location.pathname + href);
    }
  };

  return (
    <footer className="bg-[#F0F4F8] text-[#002147] font-['Inter'] relative overflow-hidden border-t border-slate-200">
      <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-[#FFD700]/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8 lg:gap-16">
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-5">
              <div className="h-24 w-24 shrink-0 rounded-full bg-white p-1.5 shadow-[0_4px_20px_rgba(0,33,71,0.08)] ring-1 ring-slate-200 lg:h-32 lg:w-32">
                <img src="/uog-logo.jpg" alt="UOG" className="h-full w-full rounded-full object-cover" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-wide text-[#002147] lg:text-2xl whitespace-nowrap">University of Gondar</h3>
                <p className="mt-1 text-sm font-semibold tracking-wide text-[#d4af37] lg:text-base whitespace-nowrap">Internship Studio</p>
              </div>
            </div>
            <p className="mt-8 max-w-sm text-sm leading-relaxed text-slate-600">
              Empowering the next generation of Ethiopian professionals by bridging the gap between academic theory and real-world industrial practice.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-center">
            <div className="w-full md:w-auto">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-[#002147]">Quick Links</h4>
              <nav className="mt-6 flex flex-col gap-4">
                <a href="/#home" onClick={(e) => handleScroll(e, '#home')} className="group flex w-fit items-center text-sm font-medium text-slate-600 transition-all hover:translate-x-1 hover:text-[#002147]">
                  <span className="mr-2 text-[#d4af37] opacity-0 transition-opacity group-hover:opacity-100">›</span>
                  Home
                </a>
                <Link to="/about" className="group flex w-fit items-center text-sm font-medium text-slate-600 transition-all hover:translate-x-1 hover:text-[#002147]">
                  <span className="mr-2 text-[#d4af37] opacity-0 transition-opacity group-hover:opacity-100">›</span>
                  About Us
                </Link>
                <a href="/#industry-partners" onClick={(e) => handleScroll(e, '#industry-partners')} className="group flex w-fit items-center text-sm font-medium text-slate-600 transition-all hover:translate-x-1 hover:text-[#002147]">
                  <span className="mr-2 text-[#d4af37] opacity-0 transition-opacity group-hover:opacity-100">›</span>
                  Partners
                </a>
                <a href="/#contact" onClick={(e) => handleScroll(e, '#contact')} className="group flex w-fit items-center text-sm font-medium text-slate-600 transition-all hover:translate-x-1 hover:text-[#002147]">
                  <span className="mr-2 text-[#d4af37] opacity-0 transition-opacity group-hover:opacity-100">›</span>
                  Contact
                </a>
              </nav>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end md:text-right">
            <div className="w-full md:w-auto">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-[#002147] md:text-right">Contact Us</h4>
              <div className="mt-6 flex flex-col gap-4">
                <a href="mailto:info@uog.edu.et" className="group flex items-center justify-start gap-3 text-sm font-medium text-slate-600 transition-colors hover:text-[#002147] md:justify-end">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#002147]/5 transition-colors group-hover:bg-[#d4af37]/10">
                    <Mail className="h-4 w-4 text-[#002147]/60 transition-colors group-hover:text-[#d4af37]" />
                  </div>
                  info@uog.edu.et
                </a>
                <a href="tel:+251588940290" className="group flex items-center justify-start gap-3 text-sm font-medium text-slate-600 transition-colors hover:text-[#002147] md:justify-end">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#002147]/5 transition-colors group-hover:bg-[#d4af37]/10">
                    <Phone className="h-4 w-4 text-[#002147]/60 transition-colors group-hover:text-[#d4af37]" />
                  </div>
                  +251 588 940 290
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-center border-t border-slate-200/80 pt-8 pb-4 text-center">
          <p className="text-sm sm:text-base font-medium tracking-wide text-[#002147]">
            © {new Date().getFullYear()} <span className="text-[#d4af37] font-bold whitespace-nowrap">University of Gondar</span> Internship Studio. <span className="text-slate-500">All rights reserved.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

function SectionHeading({ eyebrow, title, text, centered = false }) {
  return (
    <div className={centered ? 'mx-auto max-w-4xl text-center' : 'max-w-4xl'}>
      <p className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/20 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#d4af37] shadow-sm backdrop-blur-md">
        {eyebrow}
      </p>
      <h2 className="mt-5 font-['Inter'] text-3xl font-[900] tracking-[-0.04em] text-[#002147] sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">{text}</p>
    </div>
  );
}

function GlassStepCard({ item, index }) {
  const Icon = item.icon;

  return (
    <motion.article
      variants={fadeUp}
      whileHover={{ y: -10, scale: 1.02 }}
      className={`group relative overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br ${item.tone} p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-6`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.08)_100%)] opacity-80" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 shadow-[0_10px_24px_rgba(2,33,71,0.08)] ring-1 ring-white/70 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
            <Icon className={`h-7 w-7 ${item.accent}`} />
          </div>
          <div className="rounded-full border border-white/70 bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#002147] shadow-sm">
            {item.step}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="inline-flex rounded-full border border-white/70 bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#002147] shadow-sm">
            Step {index + 1}
          </div>
          <h3 className="font-['Inter'] text-xl font-[900] tracking-[-0.02em] text-[#002147]">
            {item.title}
          </h3>
          <p className="text-sm leading-7 text-slate-600 sm:text-[15px]">
            {item.text}
          </p>
        </div>

        <div className="mt-auto pt-6">
          <div className="h-px w-full bg-white/80" />
          <div className="mt-4 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span>Enterprise Flow</span>
            <ChevronRight className={`h-4 w-4 ${item.accent}`} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export default function AboutStudioPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#002147]">
      <HomeStyleNavbar />
      <div className="h-16 lg:h-20" aria-hidden="true" />

      <main>
        <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,33,71,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_30%)]" />
          <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#d4af37]">The Big Idea</p>
              <h1 className="mt-4 max-w-3xl font-['Inter'] text-4xl font-[900] tracking-[-0.04em] text-[#002147] sm:text-5xl lg:text-7xl">
                From Learning to Doing.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg lg:text-xl">
                We help University of Gondar students find the best places to practice what they learn in class.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {['Smart', 'Verified', 'Secure'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#002147] shadow-sm backdrop-blur-md">
                    <Sparkles className="h-3.5 w-3.5 text-[#d4af37]" />
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#002147] px-7 py-3.5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(0,33,71,0.16)] transition hover:-translate-y-0.5 hover:bg-[#0b2e5a]">
                  Join the Studio
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#002147] bg-transparent px-7 py-3.5 text-sm font-bold text-[#002147] transition hover:-translate-y-0.5 hover:bg-[#002147]/5">
                  Back to Home
                </Link>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: 'easeOut', delay: 0.08 }} className="relative">
              <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/82 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                <img src="/images/uog-main.jpg" alt="University of Gondar campus building" className="h-[420px] w-full rounded-[1.5rem] object-cover object-center" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4af37]">University of Gondar</p>
                    <h2 className="mt-3 font-['Inter'] text-2xl font-[900] tracking-[-0.03em] text-[#002147]">Simple, clear, and helpful</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">We make it easy for students and companies to connect.</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(135deg,#fff8db_0%,#ffffff_100%)] p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <BadgeCheck className="h-6 w-6 text-[#d4af37]" />
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Trusted System</p>
                    </div>
                    <div className="mt-4 space-y-3 text-sm font-medium text-slate-700">
                      <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Trusted companies</div>
                      <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Smart matching</div>
                      <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Safe student placement</div>
                    </div>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Studio Snapshot</p>
                        <p className="mt-2 text-lg font-bold text-[#002147]">A simple place to connect learning and work</p>
                      </div>
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#002147_0%,#0b2e5a_100%)] text-white shadow-[0_14px_30px_rgba(0,33,71,0.2)]">
                        <ShieldCheck className="h-7 w-7 text-[#FFD700]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[0.98fr_1.02fr] lg:items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} variants={fadeUp} className="relative">
              <div className="rounded-[2rem] border border-slate-200 bg-[#F8FAFC] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#d4af37]">Our Story</p>
                <h2 className="mt-4 font-['Inter'] text-3xl font-[900] tracking-[-0.03em] text-[#002147] sm:text-4xl lg:text-5xl">
                  70 Years of Teaching Excellence.
                </h2>
                <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">
                  The University of Gondar has been teaching for 70 years. Now, we are using technology to connect our students with the best companies in Ethiopia.
                </p>
                <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
                  This new Internship Studio helps the university keep its strong past while opening a simple path to real work.
                </p>
              </div>
            </motion.div>

            <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl">
              <img src="/images/uog-fasil-castle.jpg" alt="University heritage in Gondar" className="h-[420px] w-full rounded-[1.5rem] object-cover object-center" />
              <div className="absolute inset-x-4 bottom-4 rounded-[1.5rem] border border-white/80 bg-white/85 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.08)] backdrop-blur-md sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4af37]">Heritage & Digital Shift</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">Old strength, new technology.</p>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#002147] text-white shadow-[0_12px_28px_rgba(0,33,71,0.18)]">
                    <Sparkles className="h-6 w-6 text-[#FFD700]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto w-full max-w-7xl">
            <SectionHeading
              eyebrow="The Why"
              title="Why Choose Us?"
              text="Three simple reasons make the studio helpful for students and companies."
              centered
            />

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={stagger} className="mt-12 grid gap-6 lg:grid-cols-3">
              {missionPillars.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <motion.article key={pillar.title} variants={fadeUp} whileHover={{ y: -8 }} className={`group relative overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br ${pillar.tone} p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl`}>
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.1)_100%)] opacity-80" />
                    <div className="relative">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 shadow-[0_10px_24px_rgba(2,33,71,0.08)] ring-1 ring-white/70 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                        <Icon className={`h-7 w-7 ${pillar.accent}`} />
                      </div>
                      <h3 className="mt-6 font-['Inter'] text-2xl font-[900] tracking-[-0.02em] text-[#002147]">{pillar.title}</h3>
                      <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-[15px]">{pillar.text}</p>
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(0,33,71,0.10),transparent_30%)]" />
          <div className="relative mx-auto w-full max-w-7xl">
            <SectionHeading
              eyebrow="How It Works"
              title="How It Works"
              text="Five simple steps show how the studio connects students and companies."
              centered
            />

            <div className="relative mt-14">
              <div className="absolute left-[calc(10%+1rem)] right-[calc(10%+1rem)] top-1/2 hidden h-px bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent lg:block" aria-hidden="true" />
              <div className="grid gap-6 lg:grid-cols-5 lg:gap-4">
                {engineSteps.map((item, index) => (
                  <GlassStepCard key={item.title} item={item} index={index} />
                ))}
              </div>
            </div>

            <div className="mx-auto mt-10 max-w-4xl rounded-[2rem] border border-[#002147]/10 bg-white/85 p-6 text-center shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d4af37]">Simple Promise</p>
              <h3 className="mt-3 font-['Inter'] text-2xl font-[900] tracking-[-0.03em] text-[#002147] sm:text-3xl">Smart. Safe. Clear.</h3>
              <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
                Every step is made to help students learn, companies join, and the university keep the process simple and safe.
              </p>
            </div>
          </div>
        </section>
      </main>

      <HomeStyleFooter />
    </div>
  );
}
