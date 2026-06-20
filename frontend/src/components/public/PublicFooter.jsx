import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaXTwitter, FaYoutube } from 'react-icons/fa6';
import { Mail, MapPin, Phone } from 'lucide-react';

const footerLinks = [
  { label: 'Home', to: '/' },
  { label: 'Sign In', to: '/login' },
  { label: 'Get Started', to: '/register' }
];

export default function PublicFooter() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const contactHref = isHomePage ? '#contact' : '/contact';

  return (
    <footer className="border-t border-[#002147]/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.2fr_0.8fr_0.9fr]">
        <div>
          <p className="font-['Montserrat'] text-2xl font-semibold text-[#002147]">UOG Internship Studio</p>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
            A premium internship ecosystem for verified industries, ambitious students, and enterprise-level academic coordination.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {[FaXTwitter, FaFacebookF, FaInstagram, FaLinkedinIn, FaYoutube].map((Icon, index) => (
              <a
                key={index}
                href="#"
                className="grid h-10 w-10 place-items-center rounded-full border border-[#002147]/10 text-[#002147] transition hover:border-[#d4af37]/40 hover:text-[#d4af37]"
                aria-label="Social link"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start justify-start text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Quick Links</p>
          <div className="mt-4 w-full space-y-3 text-left text-sm text-slate-600">
            <a href={contactHref} className="block transition hover:text-[#d4af37]">
              Contact
            </a>
            {footerLinks.map((link) => (
              <Link key={link.to} to={link.to} className="block w-full text-left transition hover:text-[#d4af37]">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Contact</p>
          <div className="mt-4 space-y-4 text-sm text-slate-600">
            <p className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-[#d4af37]" />
              <span>Gondar, Ethiopia</span>
            </p>
            <p className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 text-[#d4af37]" />
              <span>+251 9 00 00 00 00</span>
            </p>
            <p className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-[#d4af37]" />
              <span>hello@uoginternshipstudio.com</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 flex w-full max-w-7xl flex-col gap-3 border-t border-[#002147]/10 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 UOG Internship Studio. All rights reserved.</p>
        <p>Built for a modern, bright, and trusted learning experience.</p>
      </div>
    </footer>
  );
}