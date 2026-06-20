import React, { useEffect, useRef, useState } from 'react';

function randomChar() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+<>?';
  return chars[Math.floor(Math.random() * chars.length)];
}

export default function TextScramble({ text, speed = 30, duration = 900, highlight = 'Real-World Impact' }) {
  const [display, setDisplay] = useState('');
  const raf = useRef(null);

  useEffect(() => {
    let start = null;
    const chars = text.split('');
    const total = chars.length;
    const endTime = performance.now() + duration;

    function step(now) {
      if (!start) start = now;
      const remaining = Math.max(0, endTime - now);
      const progress = 1 - remaining / duration;

      const visibleCount = Math.floor(progress * total);
      const out = chars.map((c, i) => {
        if (i < visibleCount) return c;
        if (Math.random() < 0.28) return randomChar();
        return ' ';
      });

      setDisplay(out.join(''));

      if (now < endTime) {
        raf.current = requestAnimationFrame(step);
      } else {
        setDisplay(text);
      }
    }

    raf.current = requestAnimationFrame(step);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [text, duration, speed]);

  // highlight substring
  if (display === text) {
    const parts = text.split(highlight);
    if (parts.length > 1) {
      return (
        <span className="leading-tight">
          {parts[0]}
          <span className="gradient-highlight shimmer-shadow">{highlight}</span>
          {parts[1]}
        </span>
      );
    }
  }

  return <span className="leading-tight text-[#002147]">{display}</span>;
}
