import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import AnimatedHeadline from '../../../components/ui/AnimatedHeadline';
import {
  ArrowRight,
  Award,
  Briefcase,
  CheckCircle2,
  Copy,
  ChevronLeft,
  Building2,
  Brain,
  Cpu,
  GraduationCap,
  Lightbulb,
  Settings,
  Mail,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Phone,
  Rocket,
  Trophy,
  Users,
  X,
  ChevronRight
} from 'lucide-react';

const navItems = [
  { label: 'Home', href: '#home' },
  { label: 'About Us', href: '/about' },
  { label: 'Leadership', href: '#leadership' },
  { label: 'Partners', href: '#industry-partners' },
  { label: 'Campus', href: '#gallery' },
  { label: 'Stats', href: '#stats' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' }
];

// liveStats removed, fetched dynamically


const galleryItems = [
  {
    src: '/images/uog-fasil-castle.jpg',
    title: 'Historical Roots',
    desc: 'Fasil Castle and the city of Gondar reflect the university’s deep cultural and historical context.',
    detailTitle: 'A Legacy Rooted in Gondar’s History',
    detailParagraphs: [
      'The University of Gondar traces its story back to 1954, when it began as the Public Health College in the historic city of Gondar. From the outset, the institution was created to serve a national need: preparing skilled professionals who could respond to Ethiopia’s public health priorities with discipline, science, and service.',
      'Over the decades, that focused beginning expanded into a broader academic mission. UOG grew from a specialized college into a top-tier research university with a strong reputation for teaching, community engagement, and practical problem-solving. Its identity is shaped by a culture of service that connects scholarship to the needs of the country.',
      'The university’s close connection to Fasil Castle adds a unique layer of meaning. Few campuses can claim such a direct relationship with a living historical landscape. For students, that connection creates a powerful sense of place: they study at an institution that stands at the meeting point of Ethiopia’s heritage, civic pride, and future-building ambition.'
    ],
    quickStats: [
      { label: 'Campus', value: 'Maraki' },
      { label: 'Established', value: '1954' },
      { label: 'Key Focus', value: 'Research & Service' }
    ]
  },
  {
    src: '/images/uog-main-gate-wide.jpg',
    title: 'The Main Entrance',
    desc: 'A welcoming gateway that defines the university’s identity and first impression.',
    detailTitle: 'The Gateway to UOG Pride',
    detailParagraphs: [
      'The main entrance is more than a physical gateway. It represents the university’s long-standing role as one of Ethiopia’s most respected academic institutions, welcoming students into an environment built on discipline, opportunity, and public responsibility.',
      'For many students, passing through this gate marks the beginning of a personal transformation. UOG has built its reputation through rigorous learning, meaningful service, and a tradition of producing graduates who contribute to the public sector, research, and national development.',
      'The entrance also reflects the university’s urban and historical presence in Gondar. It signals that this is a university deeply connected to its surroundings while remaining forward-looking in its academic ambition.'
    ],
    quickStats: [
      { label: 'Campus', value: 'Maraki' },
      { label: 'Established', value: '1954' },
      { label: 'Key Focus', value: 'Academic Excellence' }
    ]
  },
  {
    src: '/images/uog-library-inside.jpg',
    title: 'Digital Library',
    desc: 'A focused environment for reading, research, and digital access to knowledge.',
    detailTitle: 'Scholarship, Research, and Deep Study',
    detailParagraphs: [
      'The library is central to UOG’s evolution into a research university. It supports the academic culture that has grown from the university’s health-science origins into a broader institutional commitment to innovation, inquiry, and evidence-based learning.',
      'Within this space, students and researchers gain access to the resources needed for serious scholarship. That matters at UOG because academic success here has always been tied to practical service, problem-solving, and the ability to use knowledge in ways that improve lives.',
      'A strong library is one of the clearest signs of institutional maturity. At UOG, it stands as a symbol of the university’s investment in ideas, academic rigor, and the future of Ethiopian higher education.'
    ],
    quickStats: [
      { label: 'Campus', value: 'Maraki' },
      { label: 'Established', value: '1954' },
      { label: 'Key Focus', value: 'Research & Service' }
    ]
  },
  {
    src: '/images/uog-lab-practice.jpg',
    title: 'Science & Innovation',
    desc: 'Hands-on learning that connects theory with real-world experimentation.',
    detailTitle: 'Where Practice Strengthens Purpose',
    detailParagraphs: [
      'Laboratory practice reflects one of UOG’s strongest academic traditions: learning through direct experience. That tradition began in the university’s early health-oriented years and continues today across science, technology, and applied fields.',
      'This hands-on environment helps students move from theory to action. It is part of what has allowed the University of Gondar to develop into a respected research institution that values practical competence as much as classroom knowledge.',
      'The result is a graduate experience built on confidence, discipline, and relevance. Students do not only study concepts at UOG; they learn how to apply them in ways that serve communities and support national development.'
    ],
    quickStats: [
      { label: 'Campus', value: 'Maraki' },
      { label: 'Established', value: '1954' },
      { label: 'Key Focus', value: 'Research & Service' }
    ]
  },
  {
    src: '/images/uog-study-hall.jpg',
    title: 'Collaborative Study',
    desc: 'A shared environment that encourages teamwork, focus, and academic growth.',
    detailTitle: 'A Culture of Shared Achievement',
    detailParagraphs: [
      'Collaborative study spaces reflect the social fabric of university life at UOG. They support students who learn best through discussion, preparation, and peer support, all of which are essential to a strong academic culture.',
      'The university’s growth since 1954 has always depended on people learning together and building on one another’s strengths. That spirit still shows up in the everyday routines of students who gather to prepare, question, revise, and improve.',
      'These spaces matter because academic excellence is not built in isolation. At UOG, they represent the discipline and community mindset that help students succeed while staying connected to a larger institutional mission.'
    ],
    quickStats: [
      { label: 'Campus', value: 'Maraki' },
      { label: 'Established', value: '1954' },
      { label: 'Key Focus', value: 'Academic Success' }
    ]
  },
  {
    src: '/images/uog-campus-walkway.jpg',
    title: 'Campus Life',
    desc: 'Walkways that connect learning spaces with a calm and active student atmosphere.',
    detailTitle: 'The Daily Path of UOG Student Life',
    detailParagraphs: [
      'The walkways of UOG represent more than movement between buildings. They capture the rhythm of a campus where learning, discussion, and service happen throughout the day in a connected academic environment.',
      'As the university expanded from its original public health mission into a broader research institution, student life became more dynamic and more interdisciplinary. These pathways now link generations of learners across faculties, projects, and shared experiences.',
      'For students, the campus environment creates a sense of continuity. It reminds them that they are part of an institution with a deep history, a living present, and a strong future.'
    ],
    quickStats: [
      { label: 'Campus', value: 'Maraki' },
      { label: 'Established', value: '1954' },
      { label: 'Key Focus', value: 'Student Experience' }
    ]
  },
  {
    src: '/images/uog-modern-facility.jpg',
    title: 'World-Class Infrastructure',
    desc: 'Modern facilities that support high-performance learning and student services.',
    detailTitle: 'Modern Capacity with Historical Purpose',
    detailParagraphs: [
      'Modern facilities show how far UOG has come since its founding in 1954. What began as a Public Health College has developed into a university with the scale and capability to support advanced learning, research, and student success.',
      'Infrastructure at UOG is not only about appearance. It supports the university’s long-term academic mission by creating spaces where ideas can be tested, services can be delivered, and student potential can be fully developed.',
      'This combination of modern capacity and historic purpose is central to the university’s identity. It tells students that UOG is both rooted in tradition and prepared for the demands of the future.'
    ],
    quickStats: [
      { label: 'Campus', value: 'Maraki' },
      { label: 'Established', value: '1954' },
      { label: 'Key Focus', value: 'Innovation & Growth' }
    ]
  },
  {
    src: '/images/uog-campus-view.jpg',
    title: 'Campus Panorama',
    desc: 'A wide view that captures the scale, atmosphere, and beauty of the university.',
    detailTitle: 'A University of Scale, Spirit, and Reach',
    detailParagraphs: [
      'The panoramic view captures the scale of a university that has grown steadily from its beginnings in public health education into a respected national institution. UOG’s campus today reflects that long journey of academic expansion and public service.',
      'Its setting in Gondar gives the university a distinctive atmosphere. Students study in a place where history, community, and scholarship are visibly linked, and that connection helps shape a strong sense of belonging and pride.',
      'For the UOG community, the campus view is a reminder that every building and pathway is part of a broader story. It is the story of an institution that has spent decades building knowledge, serving society, and earning trust.'
    ],
    quickStats: [
      { label: 'Campus', value: 'Maraki' },
      { label: 'Established', value: '1954' },
      { label: 'Key Focus', value: 'Research & Service' }
    ]
  },
  {
    src: '/images/uog-anniversary-banner.jpg',
    title: '70 Years of Service',
    desc: 'A celebration of seven decades of excellence, service, and impact.',
    detailTitle: 'Seventy Years of Service, Leadership, and Transformation',
    detailParagraphs: [
      'The 70 Years of Service celebration reflects one of the most meaningful milestones in the University of Gondar’s history. Since 1954, UOG has grown from a Public Health College into a top-tier research university with a deep commitment to Ethiopia’s development.',
      'That growth has been driven by a clear institutional purpose: to educate capable professionals, strengthen public service, and advance knowledge that matters. Over time, UOG has become known not only for academic quality but also for the social impact of its teaching, research, and community engagement.',
      'For students, this anniversary is more than a commemorative banner. It is proof that they belong to a university with a proven legacy, a strong identity, and a future built on excellence.'
    ],
    quickStats: [
      { label: 'Campus', value: 'Maraki' },
      { label: 'Established', value: '1954' },
      { label: 'Key Focus', value: 'Research & Service' }
    ]
  }
];

const industryPartners = [
  { src: '/images/ethio-telecom.jpg', alt: 'Ethio Telecom', title: 'Ethio Telecom', desc: 'Leading Digital Transformation in Ethiopia.' },
  { src: '/images/cbe-bank.jpg', alt: 'Commercial Bank of Ethiopia', title: 'CBE', desc: "The backbone of Ethiopia's financial sector." },
  { src: '/images/gondar-malt.jpg', alt: 'Gondar Malt Factory', title: 'Gondar Malt Factory', desc: 'A leader in industrial manufacturing and quality.' },
  { src: '/images/ministry-health.jpg', alt: 'Ministry of Health', title: 'Ministry of Health', desc: 'Modernizing healthcare through research and technology.' },
  { src: '/images/insa-tech.jpg', alt: 'INSA', title: 'INSA', desc: "Protecting the nation's digital sovereignty." },
  { src: '/images/ethiopian-airlines.jpg', alt: 'Ethiopian Airlines', title: 'Ethiopian Airlines', desc: 'The pride of Africa and global aviation leader.' }
];

const faqGroups = {
  students: [
    { question: 'How do I apply for an internship?', answer: 'You can apply by browsing the available opportunities and clicking the apply button.' },
    { question: 'What are the requirements for an internship?', answer: 'Requirements vary by position, but generally you need to be a registered student.' },
    { question: 'How long does an internship last?', answer: 'Most internships last between 3 to 6 months depending on the program.' },
    { question: 'Is the internship paid?', answer: 'Some internships are paid while others are unpaid. Check the specific details of each opportunity.' },
    { question: 'Can I do an internship part-time?', answer: 'Yes, some employers offer part-time internships to accommodate your study schedule.' },
    { question: 'Will I get academic credit?', answer: 'This depends on your department. Please consult with your academic advisor.' }
  ],
  employers: [
    { question: 'How do I post an internship?', answer: 'Register as an employer, verify your account, and then you can create new internship postings.' },
    { question: 'Is there a fee to post?', answer: 'No, posting internships on the UOG platform is completely free for verified industry partners.' },
    { question: 'How do I review applications?', answer: 'You can manage all applications through your employer dashboard.' },
    { question: 'Can I interview candidates on campus?', answer: 'Yes, we can facilitate on-campus interviews. Please contact our placement office.' },
    { question: 'What kind of students are available?', answer: 'We have students from various faculties including Technology, Medicine, Business, and more.' },
    { question: 'How do I provide feedback?', answer: 'At the end of the internship, you will receive a form to evaluate the student.' }
  ],
  general: [
    { question: 'Who can use this platform?', answer: 'This platform is exclusively for University of Gondar students and our verified industry partners.' },
    { question: 'How do I reset my password?', answer: 'Click on the "Forgot Password" link on the login page and follow the instructions.' },
    { question: 'Is my data secure?', answer: 'Yes, we use industry-standard encryption to protect all your personal and professional information.' },
    { question: 'Who do I contact for support?', answer: 'You can reach out to info@uog.edu.et or use the contact information at the bottom of the page.' },
    { question: 'Can alumni use the platform?', answer: 'Currently, the platform focuses on active students seeking academic internships.' },
    { question: 'Are there remote opportunities?', answer: 'Yes, some employers offer remote internships. You can filter for these in the search.' }
  ]
};

const reveal = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: 'easeOut' } }
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } }
};

const buttonScale = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } }
};

const wordContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.05 }
  }
};

const wordReveal = {
  hidden: { opacity: 0, x: -40, scale: 0.9 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', damping: 12, stiffness: 200, bounce: 0.5 }
  }
};

const lineReveal = {
  hidden: { opacity: 0, y: 35 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
  }
};

const floatAnimation = {
  y: [0, -15, 0],
  rotate: [0, 5, -5, 0],
  transition: {
    duration: 6,
    ease: "easeInOut",
    repeat: Infinity,
  }
};

const MotionLink = motion.create(Link);

function RevealSection({ id, className = '', children }) {
  return (
    <motion.section id={id} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.18 }} className={className}>
      {children}
    </motion.section>
  );
}

function SectionHeader({ eyebrow, title, text, centered = false }) {
  return (
    <div className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <p 
        className="inline-block text-xs font-[900] uppercase tracking-[0.3em] bg-gradient-to-r from-[#FFD700] via-[#FDB931] to-[#FFD700] bg-[length:200%_auto] text-transparent bg-clip-text drop-shadow-[0_0_12px_rgba(255,215,0,0.6)]" 
        style={{ animation: 'shimmer 3s linear infinite' }}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3 font-['Montserrat'] text-3xl font-[800] tracking-tight text-[#002147] sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-8 text-slate-500 sm:text-lg">{text}</p>
    </div>
  );
}

function ShineButton({ children, variant = 'primary', href, to, onClick, className = '' }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition duration-200';
  const styles =
    variant === 'primary'
      ? 'bg-[#FFD700] text-[#002147] shadow-[0_16px_32px_rgba(255,215,0,0.26)] hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(255,215,0,0.36)]'
      : 'border border-[#002147]/15 bg-white text-[#002147] shadow-[0_12px_28px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:shadow-[0_20px_36px_rgba(15,23,42,0.1)]';
  const merged = `${base} ${styles} ${className}`;

  if (href) {
    return (
      <a href={href} className={merged} onClick={onClick}>
        {children}
      </a>
    );
  }

  if (to) {
    return (
      <Link to={to} className={merged} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={merged}>
      {children}
    </button>
  );
}

function LogoMark({ compact = false }) {
  return (
    <div className={`grid ${compact ? 'h-11 w-11' : 'h-14 w-14'} shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-white/70`}>
      <img src="/uog-logo.jpg" alt="University of Gondar logo" className="h-full w-full object-cover" />
    </div>
  );
}

function CampusGalleryCard({ item, onSelect, featured = false }) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(item)}
      variants={reveal}
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative shrink-0 overflow-hidden rounded-[24px] bg-slate-900 text-left shadow-[0_12px_28px_rgba(15,23,42,0.1)] transition will-change-transform aspect-[4/5] h-[55vh] min-h-[22rem] ${featured ? 'w-[82vw] sm:w-[64vw] lg:w-[22vw]' : 'w-[74vw] sm:w-[54vw] lg:w-[20vw]'}`}
    >
      <img
        src={item.src}
        alt={item.title}
        className="absolute inset-0 h-full w-full object-cover brightness-100 contrast-100 saturate-105 transition duration-[2200ms] ease-out group-hover:scale-[1.06] group-hover:brightness-105 group-hover:contrast-102"
      />
      <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[linear-gradient(180deg,rgba(2,8,23,0)_0%,rgba(2,8,23,0.12)_45%,rgba(2,8,23,0.56)_100%)]" />

      <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
        <div className="translate-y-4 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/72">Campus Gallery</p>
          <h3 className="mt-1.5 text-xl font-semibold leading-tight sm:text-2xl">{item.title}</h3>
          <p className="mt-2 max-w-[24rem] text-xs leading-6 text-white/82 sm:text-sm">{item.desc}</p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-white/88">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/60">Click for details</div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:bg-white group-hover:text-[#002147]">
            <span>Read More</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function CampusGalleryModal({ item, onClose }) {
  if (!item) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={item.src}
        className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 28, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={(event) => event.stopPropagation()}
          className="flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_28px_80px_rgba(2,8,23,0.28)]"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#b8860b]">Campus Detail</p>
              <h3 className="mt-2 font-['Montserrat'] text-2xl font-semibold tracking-tight text-[#002147] sm:text-3xl">{item.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full bg-[#002147] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0b2e5a]"
            >
              Close
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid flex-1 gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative min-h-[280px] bg-slate-900 lg:min-h-0">
              <img src={item.src} alt={item.title} className="absolute inset-0 h-full w-full object-cover" />
            </div>

            <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#b8860b]">University of Gondar</p>
                <h4 className="mt-3 font-['Montserrat'] text-2xl font-semibold tracking-tight text-[#002147] sm:text-[2rem]">
                  {item.detailTitle}
                </h4>
                <div className="mt-5 space-y-4 text-sm leading-8 text-slate-600 sm:text-[15px] sm:leading-8">
                  {(item.detailParagraphs || [item.desc]).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>

                <div className="mt-7 rounded-[24px] border border-[#FFD700]/25 bg-[linear-gradient(180deg,#fffdf4_0%,#fff8db_100%)] p-5 shadow-[0_14px_32px_rgba(0,33,71,0.06)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b8860b]">Quick Stats</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {(item.quickStats || []).map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-[0_10px_24px_rgba(0,33,71,0.05)]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
                        <p className="mt-2 text-base font-semibold text-[#002147]">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#002147] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                  UOG Pride and Legacy
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#002147]">
                  Full-screen campus detail
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function CampusGalleryCarousel({ items, onSelect }) {
  const railRef = useRef(null);
  const [edgeHover, setEdgeHover] = useState('');

  const scrollByAmount = (direction) => {
    if (!railRef.current) return;
    const amount = Math.round(railRef.current.clientWidth * 0.82);
    railRef.current.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  return (
    <div className="relative py-2 sm:py-4 lg:py-6">
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-white via-white/90 to-transparent sm:w-24" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-white via-white/90 to-transparent sm:w-24" />
      <div
        className="relative w-full"
        onMouseMove={(event) => {
          const { left, width } = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - left;
          if (x < width * 0.12) setEdgeHover('left');
          else if (x > width * 0.88) setEdgeHover('right');
          else setEdgeHover('');
        }}
        onMouseLeave={() => setEdgeHover('')}
      >
        <button
          type="button"
          onClick={() => scrollByAmount(-1)}
          className={`absolute left-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/88 text-[#002147] shadow-[0_12px_28px_rgba(15,23,42,0.14)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1/2 hover:scale-105 hover:bg-white ${edgeHover === 'left' ? 'opacity-100' : 'opacity-0'}`}
          aria-label="Scroll gallery left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollByAmount(1)}
          className={`absolute right-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/88 text-[#002147] shadow-[0_12px_28px_rgba(15,23,42,0.14)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1/2 hover:scale-105 hover:bg-white ${edgeHover === 'right' ? 'opacity-100' : 'opacity-0'}`}
          aria-label="Scroll gallery right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div
          ref={railRef}
          className="mt-2 flex gap-4 overflow-x-auto pb-6 pr-4 pt-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing snap-x snap-mandatory scroll-smooth"
          style={{ paddingLeft: 'max(1rem, 5vw)', paddingRight: 'max(1rem, 5vw)' }}
        >
          {items.map((item, index) => (
            <div key={item.src} className="snap-center">
              <CampusGalleryCard item={item} featured={index === 0} onSelect={onSelect} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ProcessCard removed per request */

function LiveStatCard({ stat, loading = false }) {
  const Icon = stat.icon;
  const ref = useRef(null);
  const [count, setCount] = useState(stat.placeholder ?? stat.value ?? 0);

  useEffect(() => {
    let rafId = null;
    let observer = null;

    const animateTo = (from, to, duration = 1500) => {
      const start = performance.now();
      const step = (now) => {
        const elapsed = now - start;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = Math.round(from + (to - from) * eased);
        setCount(value);
        if (t < 1) rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    };

    if (typeof window !== 'undefined' && ref.current) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            const from = 0;
            const to = Number(stat.value) || Number(stat.placeholder) || 0;
            animateTo(from, to, 1400);
          }
        },
        { threshold: 0.3 }
      );
      observer.observe(ref.current);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
    };
  }, [stat.value, stat.placeholder]);

  return (
    <motion.article 
      ref={ref}
      variants={reveal} 
      whileHover={{ y: -6 }} 
      className="group relative overflow-hidden rounded-[24px] border border-[#002147]/10 bg-white p-8 shadow-[0_10px_28px_rgba(2,33,71,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(2,33,71,0.12)]"
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#FFD700]/10 blur-[30px] transition-all duration-500 group-hover:bg-[#FFD700]/25" />
      <div className="relative flex flex-col items-center text-center">
        <div className="grid h-16 w-16 place-items-center rounded-[18px] bg-[linear-gradient(135deg,#fff8db_0%,#fffdf4_100%)] text-[#002147] ring-1 ring-[#FFD700]/30 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 shadow-sm">
          <Icon className="h-7 w-7" />
        </div>
        <div className="mt-6">
          <p className="font-['Montserrat'] text-4xl font-[900] tracking-tight text-[#002147] sm:text-5xl">
            {count.toLocaleString()}{loading ? '+' : ''}
          </p>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.1em] text-slate-500">{stat.label}</p>
        </div>
      </div>
    </motion.article>
  );
}

function AccordionItem({ faq, isOpen, onToggle }) {
  return (
    <motion.div layout className="rounded-[12px] bg-white border border-[#002147]/10 shadow-[0_6px_20px_rgba(2,33,71,0.06)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(2,33,71,0.12)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-semibold text-[#002147] sm:text-base">{faq.question}</span>
        <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#FFD700] shadow-sm">
          <ChevronRight className="h-4 w-4 text-[#FFD700]" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key="content"
            layout
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="px-6 pb-6 text-sm leading-7 text-slate-600 sm:text-base"
          >
            <div>{faq.answer}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function IndustryPartnersSlider() {
  const track = [...industryPartners, ...industryPartners];

  return (
    <div className="group/slider relative w-full overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] py-7 sm:py-8 lg:py-10">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#f8fafc] to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#f8fafc] to-transparent sm:w-28" />

      <div className="partner-slider-track flex min-w-max items-stretch gap-5 px-0 will-change-transform" aria-label="Industry partner logos">
        {track.map((partner, index) => (
          <div
            key={`${partner.title}-${index}`}
            className="group relative h-[360px] w-[320px] shrink-0 overflow-hidden rounded-[18px] bg-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.16)] ring-1 ring-white/60 transition-transform duration-300 hover:-translate-y-1 sm:h-[380px] sm:w-[350px] lg:h-[400px] lg:w-[390px]"
          >
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-[1.08]"
              style={{ backgroundImage: `url(${partner.src})` }}
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,23,0.08)_0%,rgba(2,8,23,0.1)_45%,rgba(2,8,23,0.82)_100%)]" />

            <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
              <div className="max-w-[88%]">
                <h4 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{partner.title}</h4>
                <p className="mt-2 text-sm leading-7 text-white/88 sm:text-[15px]">{partner.desc}</p>
              </div>

              <div className="mt-5 flex items-center justify-start">
                <button
                  type="button"
                  className="translate-y-2 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 hover:bg-white hover:text-[#002147]"
                >
                  Explore More
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .partner-slider-track {
          animation: partner-scroll 44s linear infinite;
        }

        .group\/slider:hover .partner-slider-track {
          animation-play-state: paused;
        }

        @keyframes partner-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}

function FooterLink({ children, href }) {
  return (
    <a href={href} className="transition hover:text-[#FFD700]">
      {children}
    </a>
  );
}

function ContactCard({ icon: Icon, title, lines, action, className = '' }) {
  return (
    <motion.article
      variants={reveal}
      whileHover={{ y: -6 }}
      className={`group flex h-full min-h-[280px] flex-col rounded-[20px] border-[0.5px] border-[#002147]/20 bg-[#F8FAFC] p-8 shadow-[0_10px_28px_rgba(15,23,42,0.03)] transition-all duration-300 hover:border-[#002147]/50 hover:shadow-[0_12px_40px_rgba(0,33,71,0.12)] ${className}`}
    >
      <div className="flex items-start gap-5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#fceba1] text-[#002147] shadow-sm transition group-hover:scale-105">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1 mt-1">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#002147]">{title}</p>
          <div className="mt-4 space-y-3 text-[15px] leading-7 text-slate-700">{lines}</div>
        </div>
      </div>
      {action ? <div className="mt-auto pt-6">{action}</div> : null}
    </motion.article>
  );
}

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [selectedCampusSpot, setSelectedCampusSpot] = useState(null);
  const [openFaq, setOpenFaq] = useState(0);
  const [activeFaqCategory, setActiveFaqCategory] = useState('students');
  const DEFAULT_STATS = { totalColleges: 500, totalDepartments: 100, totalIndustryPartners: 50, totalStudents: 10 };
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    let mounted = true;
    let intervalId = null;

    const fetchStats = () => {
      if (!mounted) return;
      // indicate loading for network fetches but keep placeholders visible
      setStatsLoading(true);
      setStatsError(false);
      fetch('/api/landing/stats')
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (!mounted) return;
          if (data && data.success && data.data) {
            setStats({
              totalColleges: Number(data.data.totalColleges) || DEFAULT_STATS.totalColleges,
              totalDepartments: Number(data.data.totalDepartments) || DEFAULT_STATS.totalDepartments,
              totalIndustryPartners: Number(data.data.totalIndustryPartners ?? data.data.totalEmployers) || DEFAULT_STATS.totalIndustryPartners,
              totalStudents: Number(data.data.totalStudents ?? data.data.totalStudentsPlaced) || DEFAULT_STATS.totalStudents
            });
          } else {
            // fallback to defaults
            setStats(DEFAULT_STATS);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch landing stats:', err);
          if (!mounted) return;
          setStats(DEFAULT_STATS);
          setStatsError(true);
        })
        .finally(() => {
          if (!mounted) return;
          setStatsLoading(false);
        });
    };

    // initial fetch
    fetchStats();

    // poll every 30s
    intervalId = setInterval(fetchStats, 30000);

    // refresh when tab becomes visible again
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchStats();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const ids = ['home', 'leadership', 'industry-partners', 'gallery', 'stats', 'faq', 'contact'];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id || 'home');
          }
        });
      },
      { root: null, rootMargin: '-40% 0px -40% 0px', threshold: 0 }
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // reset open index when category changes
    setOpenFaq(-1);
  }, [activeFaqCategory]);

  // Smooth scroll handler for nav anchors
  const handleNavClick = (e, href) => {
    if (!href) return;
    if (href.startsWith('#')) {
      e.preventDefault();
      const id = href.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Update history without reload
        window.history.pushState(null, '', window.location.pathname + href);
      } else if (id === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        window.history.pushState(null, '', window.location.pathname + href);
      }
    }
  };

  const handleCopy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      void label;
    }
  };

  return (
    <div className="min-h-screen text-slate-900 bg-[#f8fafc]">
      <header className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${scrolled ? 'border-slate-200 bg-white/92 backdrop-blur-xl shadow-[0_12px_30px_rgba(15,23,42,0.08)]' : 'border-transparent bg-transparent'}`}>
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="#home" onClick={(e) => handleNavClick(e, '#home')} className="flex items-center gap-3">
            <LogoMark compact />
            <div>
              <p className={`font-['Montserrat'] text-base font-semibold text-[#002147]`}>UOG Internship Studio</p>
              <p className={`text-xs text-[#002147]/70`}>University of Gondar</p>
            </div>
          </a>

          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium lg:absolute lg:left-1/2 lg:transform lg:-translate-x-1/2">
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = item.href.startsWith('#') ? activeSection === item.href.replace('#', '') : false;
                if (item.href.startsWith('/')) {
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className="group relative inline-flex items-center rounded-full px-3.5 py-2 text-[13px] font-medium transition-all duration-200 text-[#002147] hover:bg-[#f0f4f8] hover:text-[#002147]"
                    >
                      <span className="relative z-10">{item.label}</span>
                    </Link>
                  );
                }
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative inline-flex items-center rounded-full px-3.5 py-2 text-[13px] font-medium transition-all duration-200 hover:bg-[#f0f4f8] hover:text-[#002147] ${isActive ? 'bg-[#fff8db] text-[#d4af37] shadow-[0_0_18px_rgba(212,175,55,0.22)]' : 'text-[#002147]'}`}
                  >
                    <span className={`relative z-10 ${isActive ? 'drop-shadow-[0_0_10px_rgba(212,175,55,0.5)]' : ''}`}>{item.label}</span>
                    <span className={`absolute inset-x-2 -bottom-0.5 h-[2px] rounded-full bg-[#FFD700] transition-all duration-300 ${isActive ? 'w-[calc(100%-16px)] opacity-100' : 'w-0 opacity-0 group-hover:w-[calc(100%-16px)] group-hover:opacity-100'}`} />
                  </a>
                );
              })}
            </div>
          </nav>

          <div className="hidden md:flex absolute right-6 top-3 items-center gap-3">
            <a
              href="/login"
              className={`rounded-full px-3 py-2 text-sm font-medium border border-transparent transition-colors duration-200 active:translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD700]/30 text-[#002147] hover:bg-[#f0f4f8]`}
            >
              Sign In
            </a>
            <a
              href="/register"
              className="rounded-full bg-[#FFD700] px-5 py-2.5 text-sm font-semibold text-[#002147] shadow-[0_18px_40px_rgba(255,215,0,0.22)] transition transform hover:-translate-y-0.5 hover:scale-105 active:translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD700]/40"
            >
              Sign Up
            </a>
          </div>

          <button type="button" onClick={() => setMobileOpen((current) => !current)} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors lg:hidden ${scrolled ? 'border-slate-200 bg-white text-[#002147]' : 'border-transparent bg-transparent text-[#002147]'}`} aria-label="Toggle menu">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen ? (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="border-t border-slate-200 bg-white/96 px-4 py-4 backdrop-blur-xl lg:hidden">
              <div className="space-y-1 text-sm font-medium text-slate-700">
                {navItems.map((item) => {
                  const isActive = item.href.startsWith('#') && activeSection === item.href.replace('#', '');
                  if (item.href.startsWith('/')) {
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-xl px-4 py-3 transition-all duration-200 hover:bg-[#f0f4f8] hover:text-[#002147]"
                      >
                        {item.label}
                      </Link>
                    );
                  }
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={(e) => {
                        handleNavClick(e, item.href);
                        setMobileOpen(false);
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      className={`block rounded-xl px-4 py-3 transition-all duration-200 hover:bg-[#f0f4f8] hover:text-[#002147] ${isActive ? 'bg-[#fff8db] text-[#d4af37] shadow-[0_0_18px_rgba(212,175,55,0.18)]' : ''}`}
                    >
                      {item.label}
                    </a>
                  );
                })}
                <ShineButton to="/register" className="w-full px-5 py-3" onClick={() => setMobileOpen(false)}>
                  Get Started
                </ShineButton>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>

      {/* spacer to offset fixed header so content isn't covered */}
      <div className="h-16 lg:h-20" aria-hidden="true" />

      <main>
        <motion.section
          id="home"
          className="relative isolate overflow-hidden bg-white h-[100vh] lg:h-[800px] flex items-center hero-light-mesh w-full mb-16 sm:mb-20 lg:mb-28"
          variants={reveal}
          initial="hidden"
          animate="visible"
        >
          {/* Full-width raw image with seamless left-side fade */}
          <div aria-hidden className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img
              src="/images/uog-modern-hall.jpg"
              alt="University of Gondar modern campus building"
              className="absolute inset-0 h-full w-full object-cover object-[75%_15%] kenburns-slow"
              style={{
                filter: 'brightness(1.15) contrast(1.1) saturate(1.2)',
                WebkitMaskImage: 'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0.48) 52%, rgba(255,255,255,0.9) 68%, rgba(255,255,255,1) 100%)',
                maskImage: 'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0.48) 52%, rgba(255,255,255,0.9) 68%, rgba(255,255,255,1) 100%)'
              }}
            />
          </div>

          <div className="relative z-20 mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:pl-10 lg:pr-8 xl:pl-12 xl:pr-12">
            <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-2xl py-6 relative -translate-y-6 sm:-translate-y-10 lg:-translate-y-14">
              <motion.div variants={lineReveal} className="mb-4 flex justify-start">
                <GraduationCap className="h-10 w-10 text-[#FFD700] md:h-12 md:w-12 lg:h-14 lg:w-14" strokeWidth={2.5} />
              </motion.div>

              <motion.h1
                variants={wordContainer}
                className="mt-2 font-['Inter'] text-4xl font-[800] tracking-[-0.03em] text-[#002147] sm:text-5xl lg:text-6xl xl:text-[4.25rem] leading-[1.0] lg:leading-[1.0] xl:leading-[1.0] select-none"
              >
                <span className="block overflow-hidden pb-1 pt-1">
                  <motion.span variants={lineReveal} className="block">
                    Turn Classroom Theory
                  </motion.span>
                </span>
                <span className="block overflow-hidden pb-1">
                  <motion.span variants={lineReveal} className="block">
                    into Real-World
                  </motion.span>
                </span>
                <span className="block overflow-hidden pb-2">
                  <motion.span variants={lineReveal} className="block text-[#FFD700]">
                    Impact.
                  </motion.span>
                </span>
              </motion.h1>

              <motion.p variants={lineReveal} className="mt-4 max-w-xl text-base leading-7 text-slate-700 sm:text-lg drop-shadow-sm">
                Practice what you learn. Build your future. Grow with a clear path from class to work.
              </motion.p>

              <motion.div variants={lineReveal} className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                <MotionLink variants={buttonScale} to="/auth/signup" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFD700] px-7 py-3.5 font-['Inter'] text-sm font-bold text-[#002147] shadow-[0_10px_24px_rgba(255,215,0,0.22)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#FFE04D] hover:shadow-[0_14px_28px_rgba(255,215,0,0.32)]">
                  Get Started
                  <ArrowRight className="h-4 w-4 text-[#002147]" />
                </MotionLink>
                <MotionLink variants={buttonScale} to="/about" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#002147] bg-transparent px-7 py-3.5 font-['Inter'] text-sm font-bold text-[#002147] transition duration-300 hover:-translate-y-0.5 hover:bg-[#002147]/5 hover:shadow-[0_4px_15px_rgba(0,33,71,0.05)]">
                  Learn More
                </MotionLink>
              </motion.div>
            </motion.div>
          </div>

          <style>{`
            /* Mesh gradient for Bright Hero */
            .hero-light-mesh {
              background-image: 
                radial-gradient(800px 600px at 15% 15%, rgba(255, 215, 0, 0.1), transparent 45%),
                radial-gradient(1000px 800px at 35% 85%, rgba(14, 165, 233, 0.06), transparent 50%),
                linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 100%);
            }

            /* Ken Burns effect for the right image */
            .kenburns-slow {
              animation: kenburns-slow 40s ease-in-out infinite alternate; 
              will-change: transform; 
              transform-origin: 80% 50%;
            }
            @keyframes kenburns-slow {
              0% { transform: scale(1.08) translateX(-1%); }
              100% { transform: scale(1) translateX(0); }
            }
          `}</style>
        </motion.section>

        {/* 'How it Works' section removed per request */}

        <RevealSection id="leadership" className="relative w-full overflow-hidden bg-[#F8FAFC] py-20 sm:py-24 lg:py-32">
          {/* Left Side: Photo (Edge-to-edge on lg screens) */}
          <div className="absolute inset-y-0 left-0 hidden w-full lg:block lg:w-[45%] xl:w-[42%] overflow-hidden">
            <motion.img
              initial={{ opacity: 0, x: -60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              src="/images/uog-president.jpg"
              alt="Dr. Asrat Atsedeweyn, President of the University of Gondar"
              className="h-full w-full object-cover object-top"
              style={{
                WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 75%, transparent 100%)',
                maskImage: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 75%, transparent 100%)'
              }}
            />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[45%_55%] xl:grid-cols-[42%_58%] gap-12 lg:gap-16">
              {/* Mobile/Tablet image representation */}
              <div className="relative h-[360px] w-full overflow-hidden rounded-2xl lg:hidden">
                <img
                  src="/images/uog-president.jpg"
                  alt="Dr. Asrat Atsedeweyn"
                  className="h-full w-full object-cover object-top"
                />
              </div>

              {/* Dummy spacing column to offset text on desktop */}
              <div className="hidden lg:block pointer-events-none" />

              {/* Right Side: The Message */}
              <motion.div
                initial={{ opacity: 0, x: 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
                className="relative flex flex-col justify-center py-4 lg:pl-8 xl:pl-12"
              >
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d4af37]">Leadership Vision</p>
                  <h2 className="mt-3 font-['Inter'] text-2xl font-[800] tracking-[-0.02em] text-[#002147] sm:text-3xl lg:text-4xl">
                    A Message from the President
                  </h2>
                </div>

                <blockquote className="relative mt-4">
                  {/* Huge decorative Quote Icon */}
                  <span className="absolute -top-16 -left-8 font-serif text-[12rem] text-[#002147]/5 leading-none select-none pointer-events-none">
                    “
                  </span>
                  <p className="font-['Playfair_Display',Georgia,serif] text-xl sm:text-2xl lg:text-3xl italic leading-[1.6] text-[#002147] relative z-10 font-medium">
                    Bridging the gap between conceptual knowledge and industrial practice is the cornerstone of our academic mission.
                  </p>
                </blockquote>

                <div className="mt-8 border-t border-slate-200/80 pt-6">
                  <h3 className="font-['Inter'] text-lg font-bold tracking-tight text-[#002147]">
                    Dr. Asrat Atsedeweyn
                  </h3>
                  <p className="mt-1 text-sm font-semibold uppercase tracking-[0.15em] text-[#d4af37]">
                    President, University of Gondar
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap');
          `}</style>
        </RevealSection>

        <RevealSection id="industry-partners" className="relative w-full overflow-hidden py-16 sm:py-20 lg:py-24">
          {/* Subtle sunshine background glow */}
          <div className="pointer-events-none absolute left-1/4 top-0 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFD700]/10 blur-[100px]" />
          
          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="inline-block text-xs font-[900] uppercase tracking-[0.3em] bg-gradient-to-r from-[#FFD700] via-[#FDB931] to-[#FFD700] bg-[length:200%_auto] text-transparent bg-clip-text drop-shadow-[0_0_12px_rgba(255,215,0,0.6)]" style={{ animation: 'shimmer 3s linear infinite' }}>
              Industry Partners
            </p>
            <h3 className="mt-2 font-['Montserrat'] text-3xl font-[800] tracking-tight text-[#002147] sm:text-4xl lg:text-5xl">Trusted Industry Partners</h3>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-500 sm:text-lg">We connect you with Ethiopia’s top organizations for your internship.</p>
          </div>
          
          <style>{`
            @keyframes shimmer {
              0% { background-position: 200% center; }
              100% { background-position: -200% center; }
            }
          `}</style>
          <div className="mt-7 w-full">
            <IndustryPartnersSlider />
          </div>
        </RevealSection>

        <RevealSection id="gallery" className="w-full py-20 sm:py-24 lg:py-28 bg-[linear-gradient(180deg,#ffffff_0%,#fffdf7_100%)]">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader eyebrow="Campus Life" title="Explore Our Campus" text="A vibrant environment designed for learning, research, and growth." centered />
          </div>

          <div className="mt-8 w-full">
            <CampusGalleryCarousel items={galleryItems} onSelect={setSelectedCampusSpot} />
          </div>
        </RevealSection>

        <RevealSection id="stats" className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto w-full max-w-7xl">
            <SectionHeader eyebrow="Live Statistics" title="The Internship Ecosystem in Numbers" text="Live data synchronized directly with the University of Gondar database." centered />
            <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {(() => {
                const statItems = [
                  { value: stats.totalColleges, label: 'Total Colleges', icon: Award, placeholder: DEFAULT_STATS.totalColleges },
                  { value: stats.totalDepartments, label: 'Total Departments', icon: Users, placeholder: DEFAULT_STATS.totalDepartments },
                  { value: stats.totalIndustryPartners, label: 'Industry Partners', icon: Briefcase, placeholder: DEFAULT_STATS.totalIndustryPartners },
                  { value: stats.totalStudents, label: 'Total Students', icon: GraduationCap, placeholder: DEFAULT_STATS.totalStudents }
                ];

                return statItems.map((stat) => (
                  <LiveStatCard key={stat.label} stat={stat} loading={statsLoading} />
                ));
              })()}
            </motion.div>
          </div>
        </RevealSection>

        <RevealSection id="faq" className="bg-[#F8FAFC] px-8 py-16 sm:px-12 lg:px-20 lg:py-20">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mx-auto w-full max-w-7xl text-center">
              <p className="inline-block text-xs font-[900] uppercase tracking-[0.3em] text-[#d4af37]">FAQ</p>
              <h2 className="mt-3 font-['Inter'] text-3xl font-[800] tracking-[-0.02em] text-[#002147] sm:text-4xl lg:text-5xl">Frequently asked questions</h2>
              <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">Quick answers to the most common questions students ask about placement and matching.</p>
            </div>

                <div className="mx-auto mt-10 w-full max-w-7xl">
              <div className="flex w-full items-center gap-3 overflow-auto pb-4">
                {[
                  { key: 'students', label: 'For Students' },
                  { key: 'employers', label: 'For Employers' },
                  { key: 'general', label: 'General' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFaqCategory(tab.key)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${activeFaqCategory === tab.key ? 'bg-[#002147] text-white' : 'bg-white/60 text-[#002147] border border-slate-100'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.18 }} className="mt-6 grid gap-6 lg:grid-cols-2">
                {faqGroups[activeFaqCategory].slice(0, 6).map((faq, idx) => (
                  <div key={faq.question} className="px-2">
                    <AccordionItem faq={faq} isOpen={openFaq === idx} onToggle={() => setOpenFaq(openFaq === idx ? -1 : idx)} />
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </RevealSection>

        <CampusGalleryModal item={selectedCampusSpot} onClose={() => setSelectedCampusSpot(null)} />

        <RevealSection id="contact" className="bg-white px-4 pb-16 pt-14 sm:px-6 lg:px-8 lg:pb-20 lg:pt-16">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#d4af37]">Contact Portal</p>
              <h2 className="mt-3 font-['Inter'] text-3xl font-[800] tracking-[-0.02em] text-[#002147] sm:text-4xl lg:text-5xl">Connect with Our Team</h2>
              <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">Our coordination office is here to assist students, academic departments, and industry partners.</p>
            </div>

            <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} className="mt-10 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
              <ContactCard
                icon={Mail}
                title="Email Us"
                lines={[
                  <div key="email" className="inline-flex items-center gap-2">
                    <a href="mailto:info@uog.edu.et" className="text-[15px] font-semibold tracking-[0.01em] text-[#002147] transition hover:text-[#b8860b]">
                      info@uog.edu.et
                    </a>
                    <button type="button" onClick={() => handleCopy('info@uog.edu.et', 'general')} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#002147] opacity-70 transition hover:bg-[#fff6cf] hover:text-[#b8860b] hover:opacity-100" aria-label="Copy email address">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>,
                  <div key="phone" className="block space-y-1.5">
                    <a href="tel:+251588940290" className="block text-[15px] font-semibold tracking-[0.01em] text-slate-700 transition hover:text-[#002147]">+251 588 940 290</a>
                  </div>
                ]}
                action={null}
              />

              <ContactCard
                icon={Mail}
                title="Student Support"
                lines={[
                  <div key="email" className="inline-flex items-center gap-2">
                    <a href="mailto:registrar@uog.edu.et" className="text-[15px] font-semibold tracking-[0.01em] text-[#002147] transition hover:text-[#b8860b]">
                      registrar@uog.edu.et
                    </a>
                    <button type="button" onClick={() => handleCopy('registrar@uog.edu.et', 'registrar')} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#002147] opacity-70 transition hover:bg-[#fff6cf] hover:text-[#b8860b] hover:opacity-100" aria-label="Copy email address">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>,
                  <div key="phone" className="block space-y-1.5">
                    <a href="tel:+251581141237" className="block text-[15px] font-semibold tracking-[0.01em] text-slate-700 transition hover:text-[#002147]">+251 58 114 1237</a>
                  </div>
                ]}
                action={null}
              />

              <ContactCard
                icon={Phone}
                title="Call Us"
                lines={[
                  <a key="phone1" href="tel:+251581141232" className="block text-[15px] font-semibold tracking-[0.01em] text-slate-700 transition hover:text-[#002147]">+251 581 141 232</a>,
                  <a key="phone2" href="tel:+251581114747" className="block text-[15px] font-semibold tracking-[0.01em] text-slate-700 transition hover:text-[#002147]">+251 58 111 4747</a>
                ]}
              />

              <ContactCard
                icon={MapPin}
                title="Visit Us"
                lines={[
                  <a
                    key="address"
                    href="https://www.google.com/maps/search/?api=1&query=Maraki%20Street%20Atse%20Tewodros%20Campus%20P.O.%20Box%20196%20Gondar%20Ethiopia"
                    target="_blank"
                    rel="noreferrer"
                    className="block text-[15px] font-semibold leading-7 tracking-[0.01em] text-slate-700 transition hover:text-[#002147]"
                  >
                    Maraki Street, Atse Tewodros Campus, P.O. Box 196, Gondar, Ethiopia.
                  </a>
                ]}
              />
            </motion.div>

            {/* Footer CTA removed as requested */}
          </div>
        </RevealSection>

        <SiteFooter />
      </main>
    </div>
  );
}

function SiteFooter() {
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
      {/* Subtle glow effect behind the logo area */}
      <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-[#FFD700]/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8 lg:gap-16">
          {/* Column 1: Brand & Mission */}
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-5">
              <div className="h-24 w-24 shrink-0 rounded-full bg-white p-1.5 shadow-[0_4px_20px_rgba(0,33,71,0.08)] ring-1 ring-slate-200 lg:h-32 lg:w-32">
                <img src="/uog-logo.jpg" alt="UOG" className="h-full w-full rounded-full object-cover" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-wide text-[#002147] lg:text-2xl whitespace-nowrap">
                  University of Gondar
                </h3>
                <p className="mt-1 text-sm font-semibold tracking-wide text-[#d4af37] lg:text-base whitespace-nowrap">Internship Studio</p>
              </div>
            </div>
            <p className="mt-8 max-w-sm text-sm leading-relaxed text-slate-600">
              Empowering the next generation of Ethiopian professionals by bridging the gap between academic theory and real-world industrial practice.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div className="flex flex-col items-start md:items-center">
            <div className="w-full md:w-auto">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-[#002147]">Quick Links</h4>
              <nav className="mt-6 flex flex-col gap-4">
                <a href="#home" onClick={(e) => handleScroll(e, '#home')} className="group flex w-fit items-center text-sm font-medium text-slate-600 transition-all hover:translate-x-1 hover:text-[#002147]">
                  <span className="mr-2 text-[#d4af37] opacity-0 transition-opacity group-hover:opacity-100">›</span>
                  Home
                </a>
                <Link to="/about" className="group flex w-fit items-center text-sm font-medium text-slate-600 transition-all hover:translate-x-1 hover:text-[#002147]">
                  <span className="mr-2 text-[#d4af37] opacity-0 transition-opacity group-hover:opacity-100">›</span>
                  About Us
                </Link>
                <a href="#industry-partners" onClick={(e) => handleScroll(e, '#industry-partners')} className="group flex w-fit items-center text-sm font-medium text-slate-600 transition-all hover:translate-x-1 hover:text-[#002147]">
                  <span className="mr-2 text-[#d4af37] opacity-0 transition-opacity group-hover:opacity-100">›</span>
                  Partners
                </a>
                <a href="#contact" onClick={(e) => handleScroll(e, '#contact')} className="group flex w-fit items-center text-sm font-medium text-slate-600 transition-all hover:translate-x-1 hover:text-[#002147]">
                  <span className="mr-2 text-[#d4af37] opacity-0 transition-opacity group-hover:opacity-100">›</span>
                  Contact
                </a>
              </nav>
            </div>
          </div>

          {/* Column 3: Contact Details */}
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

        {/* Bottom Bar: Copyright */}
        <div className="mt-16 flex flex-col items-center justify-center border-t border-slate-200/80 pt-8 pb-4 text-center">
          <p className="text-sm sm:text-base font-medium tracking-wide text-[#002147]">
            © {new Date().getFullYear()} <span className="text-[#d4af37] font-bold whitespace-nowrap">University of Gondar</span> Internship Studio. <span className="text-slate-500">All rights reserved.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

// Duplicate export removed