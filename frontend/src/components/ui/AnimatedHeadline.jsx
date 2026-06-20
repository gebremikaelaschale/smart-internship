import React from 'react';
import { motion } from 'framer-motion';

// Splits text into words and staggers them with a gentle upward motion
export default function AnimatedHeadline({ text, highlight = 'Real-World Impact' }) {
  const words = text.split(' ');

  const container = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.06,
      },
    },
  };

  const word = {
    hidden: { y: 18, opacity: 0, skewY: 2 },
    visible: { y: 0, opacity: 1, skewY: 0, transition: { duration: 0.56, ease: [0.2, 0.8, 0.2, 1] } },
  };

  return (
    <motion.div variants={container} initial="hidden" animate="visible" aria-hidden={false} className="inline-block leading-tight">
      {words.map((w, i) => {
        // keep punctuation attached
        const clean = w.replace(/(^\s+|\s+$)/g, '');
        const isHighlight = clean.includes(highlight.split(' ')[0]) || highlight.includes(clean);
        return (
          <motion.span key={i} variants={word} className="inline-block mr-2">
            {isHighlight ? (
              <span className="relative inline-block text-transparent bg-clip-text gradient-highlight shimmer-shadow">{w}</span>
            ) : (
              <span className="inline-block text-[#002147]">{w}</span>
            )}
          </motion.span>
        );
      })}
    </motion.div>
  );
}
