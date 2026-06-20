import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaXTwitter, FaYoutube } from 'react-icons/fa6';
import { Mail, MapPin, Phone, Send, Clock } from 'lucide-react';
import PublicLayout from '@/components/public/PublicLayout';

const contactItems = [
  { label: 'Email', value: 'hello@uoginternshipstudio.com', icon: Mail },
  { label: 'Phone', value: '+251 9 00 00 00 00', icon: Phone },
  { label: 'Address', value: 'Gondar, Ethiopia', icon: MapPin },
  { label: 'Response Time', value: 'Within 24 hours', icon: Clock }
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};

function SectionTitle({ eyebrow, title, text, centered = false }) {
  return (
    <div className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-300">{eyebrow}</p>
      <h2 className="mt-3 font-['Montserrat'] text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">{text}</p>
    </div>
  );
}

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setSent(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSent(true);
  };

  return (
    <PublicLayout>
      <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.18),transparent_28%)]" />
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-300">Contact</p>
            <h1 className="mt-4 font-['Montserrat'] text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl lg:text-6xl">
              Talk to our team anytime
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
              Need help with courses, admission, pricing, or your account? Send a message and our team will reply with a simple, helpful answer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#contact" className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(59,130,246,0.3)] transition hover:brightness-110">
                Send Message
              </a>
              <a href="#map" className="rounded-full border border-slate-300 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-700 backdrop-blur-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                View Map
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            className="relative"
          >
            <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/70 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/70">
              <img
                src="/images/uog-main-gate.jpg"
                alt="Main gate"
                className="h-[360px] w-full rounded-[1.5rem] object-cover brightness-110 contrast-105 saturate-110"
              />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {contactItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                      <Icon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="contact" className="bg-slate-50/70 px-4 py-16 dark:bg-slate-900/35 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <SectionTitle
              eyebrow="Send a message"
              title="Modern contact form"
              text="Use the form below for questions about courses, accounts, support, partnerships, or anything else."
            />

            <motion.form
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
              onSubmit={handleSubmit}
              className="mt-8 rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-[0_16px_35px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900/75 sm:p-8"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Your Name', name: 'name', type: 'text', placeholder: 'Enter your name' },
                  { label: 'Email Address', name: 'email', type: 'email', placeholder: 'Enter your email' }
                ].map((field) => (
                  <motion.label key={field.name} variants={fadeUp} className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{field.label}</span>
                    <input
                      required
                      type={field.type}
                      value={form[field.name]}
                      onChange={(event) => updateField(field.name, event.target.value)}
                      placeholder={field.placeholder}
                      className="h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </motion.label>
                ))}
              </div>

              <motion.label variants={fadeUp} className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Subject</span>
                <input
                  required
                  type="text"
                  value={form.subject}
                  onChange={(event) => updateField('subject', event.target.value)}
                  placeholder="What can we help you with?"
                  className="h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </motion.label>

              <motion.label variants={fadeUp} className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Message</span>
                <textarea
                  required
                  rows="6"
                  value={form.message}
                  onChange={(event) => updateField('message', event.target.value)}
                  placeholder="Write your message here..."
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </motion.label>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(59,130,246,0.3)] transition hover:brightness-110"
                >
                  <Send className="h-4 w-4" />
                  Send Message
                </button>
                {sent ? <p className="text-sm font-medium text-green-600 dark:text-green-400">Message form ready. Connect this to your backend when needed.</p> : null}
              </div>
            </motion.form>
          </div>

          <div className="space-y-8">
            <div id="map" className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_16px_35px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900/75">
              <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Google Maps</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Find us in Gondar</p>
              </div>
              <iframe
                title="Google Maps location for UOG Internship Studio"
                src="https://www.google.com/maps?q=University%20of%20Gondar&output=embed"
                className="h-[380px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-[0_16px_35px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900/75">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Social Media</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {[
                  { icon: FaXTwitter, label: 'X' },
                  { icon: FaFacebookF, label: 'Facebook' },
                  { icon: FaInstagram, label: 'Instagram' },
                  { icon: FaLinkedinIn, label: 'LinkedIn' },
                  { icon: FaYoutube, label: 'YouTube' }
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <a
                      key={item.label}
                      href="#"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}