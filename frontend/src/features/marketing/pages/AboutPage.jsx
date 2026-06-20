import React from 'react';
import { motion } from 'framer-motion';
import { Award, BookOpen, Globe, Lightbulb, Target, Users, Zap } from 'lucide-react';
import PublicLayout from '@/components/public/PublicLayout';

const stats = [
  { value: '100K+', label: 'Learners supported' },
  { value: '250+', label: 'Practical lessons' },
  { value: '40+', label: 'Countries reached' },
  { value: '4.9/5', label: 'Average rating' }
];

const goals = [
  { title: 'Clear learning paths', text: 'Make every subject easy to follow with simple words and guided steps.', icon: BookOpen },
  { title: 'Real career growth', text: 'Help learners build skills that can be used in jobs, projects, and interviews.', icon: Target },
  { title: 'Global access', text: 'Open quality education to anyone with a phone, laptop, or tablet.', icon: Globe },
  { title: 'Supportive community', text: 'Create a friendly space where students can ask, share, and improve.', icon: Users }
];

const team = [
  { name: 'Learning Team', role: 'Course design and content' },
  { name: 'Mentor Team', role: 'Live classes and feedback' },
  { name: 'Support Team', role: 'Help and student care' },
  { name: 'Career Team', role: 'Portfolio and job support' }
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

function StatCard({ stat }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/80 p-5 text-center shadow-[0_16px_35px_rgba(15,23,42,0.08)] backdrop-blur-lg dark:border-slate-700 dark:bg-slate-900/75">
      <p className="font-['Montserrat'] text-3xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_30%)]" />
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-300">About Us</p>
            <h1 className="mt-4 font-['Montserrat'] text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl lg:text-6xl">
              A brighter way to learn online
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
              SkillRise Academy is built for learners who want simple lessons, strong support, and a premium experience that feels trusted from day one.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#mission" className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(59,130,246,0.3)] transition hover:brightness-110">
                Read Our Mission
              </a>
              <a href="#team" className="rounded-full border border-slate-300 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-700 backdrop-blur-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                Meet the Team
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
              <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                <div className="relative overflow-hidden rounded-[1.5rem]">
                  <img
                    src="/images/uog-campus-view.jpg"
                    alt="Bright campus view"
                    className="h-full min-h-[320px] w-full object-cover brightness-110 contrast-105 saturate-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-slate-950/10 to-transparent" />
                </div>
                <div className="grid gap-4">
                  <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-5 text-white">
                    <Lightbulb className="h-6 w-6 text-blue-100" />
                    <p className="mt-3 text-sm text-blue-100">Mission</p>
                    <p className="mt-2 text-lg font-semibold">Make quality learning easy, clear, and exciting for everyone.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                    <Zap className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Vision</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Become a global learning platform that students trust every day.</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {stats.map((stat) => <StatCard key={stat.label} stat={stat} />)}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="mission" className="bg-slate-50/70 px-4 py-16 dark:bg-slate-900/35 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto w-full max-w-7xl">
          <SectionTitle
            eyebrow="What We Stand For"
            title="Mission, vision, and learning goals"
            text="We focus on simple words, practical lessons, and a friendly experience that helps learners stay active and confident."
            centered
          />

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
            className="mt-10 grid gap-5 md:grid-cols-2"
          >
            {goals.map((goal) => {
              const Icon = goal.icon;

              return (
                <motion.article key={goal.title} variants={fadeUp} className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-[0_16px_35px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900/75">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">{goal.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{goal.text}</p>
                </motion.article>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section id="team" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto w-full max-w-7xl">
          <SectionTitle
            eyebrow="Our Team"
            title="A small team with a big learning focus"
            text="We work together to make the experience smooth, helpful, and professional for every student."
            centered
          />

          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {team.map((member, index) => (
              <motion.article
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="rounded-3xl border border-slate-200 bg-white/85 p-6 text-center shadow-[0_14px_32px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900/75"
              >
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-blue-500/20">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{member.name}</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{member.role}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-100">Inspiration</p>
            <h2 className="mt-4 font-['Montserrat'] text-3xl font-semibold tracking-tight sm:text-4xl">
              Learning should feel hopeful, personal, and possible.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-blue-100">
              Our goal is to create a platform that gives learners confidence, keeps lessons easy to understand, and supports growth from the first day to the last.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-white/10 p-5 backdrop-blur-md">
              <Award className="h-6 w-6 text-cyan-200" />
              <p className="mt-3 text-lg font-semibold">Trusted Quality</p>
              <p className="mt-2 text-sm leading-7 text-blue-100">Designed with premium spacing, clean content, and a modern feel.</p>
            </div>
            <div className="rounded-3xl bg-white/10 p-5 backdrop-blur-md">
              <Globe className="h-6 w-6 text-cyan-200" />
              <p className="mt-3 text-lg font-semibold">Global Access</p>
              <p className="mt-2 text-sm leading-7 text-blue-100">Built to serve students from different backgrounds and skill levels.</p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}