import React, { useEffect, useState } from 'react';

function AnimatedCounter({ value, duration = 1000 }) {
  // Extract numbers from the value (handles strings with prefixes/suffixes gracefully)
  const stringVal = String(value);
  const numericMatch = stringVal.match(/\d+/);
  const targetNum = numericMatch ? parseInt(numericMatch[0], 10) : 0;
  const nonNumericPrefix = stringVal.split(/\d+/)[0] || '';
  const nonNumericSuffix = stringVal.split(/\d+/)[1] || '';

  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    let cancelled = false;

    const step = (timestamp) => {
      if (cancelled) return;
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing outQuad curve for premium organic feel
      const easedProgress = progress * (2 - progress);
      const currentValue = Math.floor(easedProgress * targetNum);

      setCount(currentValue);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(targetNum);
      }
    };

    window.requestAnimationFrame(step);

    return () => {
      cancelled = true;
    };
  }, [targetNum, duration]);

  return (
    <span>
      {nonNumericPrefix}
      {count.toLocaleString()}
      {nonNumericSuffix}
    </span>
  );
}

export default function StatsCard({ title, value, description }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-indigo-100/70 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md">
      {/* Premium Gradient Top Border Accent */}
      <div className="absolute top-0 left-0 h-[4px] w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
      
      {/* Decorative background light orb */}
      <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-indigo-50/20 blur-2xl transition-all duration-500 group-hover:bg-indigo-100/40" />
      
      <p className="text-xs font-bold tracking-wider text-indigo-950/80 uppercase">{title}</p>
      
      <h3 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 bg-clip-text text-transparent select-none">
        <AnimatedCounter value={value} />
      </h3>
      
      {description ? (
        <p className="mt-2 text-xs font-semibold text-slate-500 transition-colors duration-300 group-hover:text-slate-600">
          {description}
        </p>
      ) : null}
    </div>
  );
}
