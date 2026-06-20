import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StudentProfileDrawer({ isOpen, onClose, application, onStatusUpdate, isBusy }) {
  if (!application) return null;

  const { studentId, studentProfile, coverLetter, status, remarks, internshipId } = application;
  const student = studentId || {};
  const profile = studentProfile || {};
  const portfolio = profile.portfolioLinks || {};

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const drawerVariants = {
    hidden: { x: '100%' },
    visible: { x: 0 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
                <h3 className="text-xl font-bold text-slate-900">Student Full Profile</h3>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 px-8 py-6 space-y-8 pb-32">
                {/* Profile Header */}
                <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
                  <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-100 border-4 border-white shadow-md">
                    {profile.profilePicUrl ? (
                      <img 
                        src={profile.profilePicUrl.startsWith('http') || profile.profilePicUrl.startsWith('data:') ? profile.profilePicUrl : `http://localhost:5000${profile.profilePicUrl}`} 
                        alt={student.fullName} 
                        className="h-full w-full object-cover" 
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-emerald-50 text-3xl font-bold text-emerald-600 uppercase">
                        {student.fullName?.charAt(0) || 'S'}
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">{student.fullName}</h2>
                    <p className="text-emerald-600 font-semibold">{profile.department}</p>
                    <p className="text-sm text-slate-500">{profile.college || 'University of Gondar'}</p>
                    {(application.match_score ?? application.matchScore ?? application.matchingScore) > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700 border border-sky-100">
                        <span>🔥</span> Match Score: {application.match_score ?? application.matchScore ?? application.matchingScore}%
                      </div>
                    )}
                  </div>
                  <div className="ml-auto text-right">
                     <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                        status === 'Placed' ? 'bg-emerald-100 text-emerald-700' : 
                        status === 'Rejected' ? 'bg-rose-100 text-rose-700' :
                        'bg-blue-100 text-blue-700'
                     }`}>
                        {status}
                     </span>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</p>
                    <p className="text-slate-900 font-medium">{student.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Phone Number</p>
                    <p className="text-slate-900 font-medium">{profile.phone || student.phone || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Year of Study</p>
                    <p className="text-slate-900 font-medium">{profile.yearOfStudy} Year</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">CGPA / GPA</p>
                    <p className="text-emerald-700 font-black text-lg">{profile.gpa || 'N/A'}</p>
                  </div>
                  {profile.address && (
                    <div className="space-y-1 col-span-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Address / Location</p>
                      <p className="text-slate-900 font-medium">{profile.address}</p>
                    </div>
                  )}
                </div>

                {/* Bio / Cover Letter */}
                <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <span>📄</span> Application Letter / Bio
                  </h4>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                    {coverLetter || profile.bio || "No cover letter provided."}
                  </p>
                </div>

                {/* Courses */}
                {profile.courses && profile.courses.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-800">Relevant Courses</h4>
                    <div className="flex flex-wrap gap-2">
                      {profile.courses.map((course, idx) => (
                        <span key={idx} className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700">
                          {course}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800">Skills & Expertise</h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills && profile.skills.length > 0 ? (
                      profile.skills.map((skill, idx) => (
                        <span key={idx} className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">No skills listed</span>
                    )}
                  </div>
                </div>

                {/* Portfolio Links */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800">Projects & Links</h4>
                  <div className="flex flex-wrap gap-4">
                    {portfolio.github && (
                      <a href={portfolio.github} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600 font-medium transition-colors">
                        <span className="text-lg">🔗</span> GitHub
                      </a>
                    )}
                    {portfolio.linkedin && (
                      <a href={portfolio.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600 font-medium transition-colors">
                        <span className="text-lg">🔗</span> LinkedIn
                      </a>
                    )}
                    {portfolio.website && (
                      <a href={portfolio.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600 font-medium transition-colors">
                        <span className="text-lg">🔗</span> Portfolio Website
                      </a>
                    )}
                    {!portfolio.github && !portfolio.linkedin && !portfolio.website && (
                      <span className="text-slate-400 italic">No links provided</span>
                    )}
                  </div>
                </div>

                {/* Resume Link */}
                <div className="pt-4">
                  {profile.resumeUrl && 
                   profile.resumeUrl.trim().length > 5 && 
                   !profile.resumeUrl.includes('chatgpt.com') && 
                   !profile.resumeUrl.includes('openai.com') ? (
                    <a 
                      href={profile.resumeUrl.startsWith('http') ? profile.resumeUrl : `http://localhost:5000${profile.resumeUrl}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 transition-all shadow-sm"
                    >
                      <span>📂</span> View Full CV / Resume PDF
                    </a>
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
                      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-400">
                        📄
                      </div>
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No CV or PDF Provided</p>
                      <p className="mt-1 text-xs text-slate-400 font-medium italic">ምንም አይነት ሲቪ ወይም ፒዲኤፍ አልተጫነም</p>
                    </div>
                  )}
                </div>

                {/* Admin/Department Remarks */}
                {remarks && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">Previous Comments / Remarks</p>
                    <p className="text-sm text-amber-800">{remarks}</p>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="absolute bottom-0 left-0 right-0 border-t bg-white p-6 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <div className="flex gap-3">
                  {!['Placed', 'Rejected', 'Accepted'].includes(status) && (
                    <>
                      <button
                        onClick={() => onStatusUpdate(application._id, 'Accepted')}
                        disabled={isBusy}
                        className="flex-1 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 transition-all"
                      >
                        Accept Student
                      </button>
                      <button
                        onClick={() => onStatusUpdate(application._id, 'Interview')}
                        disabled={isBusy}
                        className="flex-1 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                      >
                        Schedule Interview
                      </button>
                      <button
                        onClick={() => onStatusUpdate(application._id, 'Rejected')}
                        disabled={isBusy}
                        className="rounded-xl bg-rose-50 px-6 py-3.5 text-sm font-bold text-rose-600 border border-rose-100 hover:bg-rose-100 disabled:opacity-50 transition-all"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {['Placed', 'Accepted', 'Rejected'].includes(status) && (
                    <div className="w-full flex justify-center py-2">
                      <span className={`rounded-xl px-8 py-3 text-sm font-black uppercase tracking-widest opacity-80 ${
                        status === 'Placed' || status === 'Accepted' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'
                      }`}>
                        Application {status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
