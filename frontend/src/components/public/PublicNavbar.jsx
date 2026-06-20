import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Menu, Sparkles, X } from 'lucide-react';

const publicLinks = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' }
];

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const contactHref = isHomePage ? '#contact' : '/contact';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleContactClick = (event) => {
    if (!isHomePage) {
      return;
    }

    event.preventDefault();
    const contactSection = document.getElementById('contact');

    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${scrolled ? 'border-slate-200 bg-white/92 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl' : 'border-transparent bg-transparent'}`}>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-xl ring-1 ring-white/70">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="font-['Montserrat'] text-base font-semibold text-[#002147]">UOG Internship Studio</p>
            <p className="text-xs text-[#002147]/70">University of Gondar</p>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#002147] md:absolute md:left-1/2 md:transform md:-translate-x-1/2">
          {publicLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={(e) => {
                // If it's an on-page anchor and we're already on home, smooth scroll instead of full navigation
                if (link.to.includes('#') && (location.pathname === '/' || location.pathname === '')) {
                  e.preventDefault();
                  const hash = link.to.split('#')[1];
                  const el = document.getElementById(hash);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="transition hover:text-[#d4af37]"
            >
              {link.label}
            </Link>
          ))}
          <a href={contactHref} onClick={handleContactClick} className="transition hover:text-[#d4af37]">
            Contact
          </a>
        </nav>

        <div className="hidden md:flex absolute right-6 top-3 items-center gap-3">
          <Link
            to="/login"
            className="rounded-full px-3 py-2 text-sm font-medium text-[#002147] border border-transparent transition-colors duration-200 active:translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD700]/30"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="rounded-full bg-[#FFD700] px-5 py-2.5 text-sm font-semibold text-[#002147] shadow-[0_18px_40px_rgba(255,215,0,0.22)] transition transform hover:-translate-y-0.5 hover:scale-105 active:translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD700]/40"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border md:hidden ${scrolled ? 'border-slate-200 bg-white text-[#002147]' : 'border-transparent bg-transparent text-[#002147]'}`}
          aria-label="Toggle navigation menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white/96 px-4 pb-4 pt-2 backdrop-blur-xl md:hidden">
          <div className="space-y-2 text-sm font-medium text-[#002147]">
            {publicLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={(e) => {
                  // If anchor to section and currently on home, smooth scroll and close
                  if (link.to.includes('#') && (location.pathname === '/' || location.pathname === '')) {
                    e.preventDefault();
                    const hash = link.to.split('#')[1];
                    const el = document.getElementById(hash);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setOpen(false);
                    return;
                  }
                  setOpen(false);
                }}
                className="block rounded-xl px-4 py-3 transition hover:bg-[#f0f4f8]"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={contactHref}
              onClick={(event) => {
                handleContactClick(event);
                setOpen(false);
              }}
              className="block rounded-xl px-4 py-3 transition hover:bg-[#f0f4f8]"
            >
              Contact
            </a>
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="block rounded-xl border border-slate-200 px-4 py-3 text-center transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD700]/30"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              onClick={() => setOpen(false)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-4 py-3 font-semibold text-[#002147] active:scale-95 active:brightness-95"
            >
              <Sparkles className="h-4 w-4" />
                Get Started
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}