import React, { useEffect, useMemo, useState } from 'react';
import { getMatchTone } from '@/utils/internshipMatching';

function useAnimatedNumber(target, duration = 700) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const startTime = performance.now();
    const startValue = value;

    const tick = (now) => {
      const elapsed = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setValue(Math.round(startValue + ((target - startValue) * eased)));

      if (elapsed < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [target, duration]);

  return value;
}

export default function MatchScoreBadge({ score = 0, reasoning = '', className = '' }) {
  const tone = useMemo(() => getMatchTone(score), [score]);
  const animatedScore = useAnimatedNumber(Number(score) || 0, 800);
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - ((Math.max(0, Math.min(100, animatedScore)) / 100) * circumference);
  const displayReasoning = score <= 0
    ? 'Your profile skills do not yet match this role\'s requirements.'
    : score >= 100
      ? 'Perfect Match! Your skills in React and HTML align perfectly.'
      : reasoning || 'Your match reasoning will appear here.';

  return (
    <div className={`rounded-[28px] border ${tone.border} ${tone.bg} p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] ${className}`}>
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
            <circle cx="48" cy="48" r="38" fill="none" stroke={tone.track} strokeWidth="10" />
            <circle
              cx="48"
              cy="48"
              r="38"
              fill="none"
              stroke={tone.accent}
              strokeLinecap="round"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 300ms ease, stroke 300ms ease' }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`text-2xl font-black leading-none ${tone.text}`}>{animatedScore}</span>
            <span className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Match</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">AI Matching Score</p>
          <p className={`mt-1 text-sm font-black ${tone.text}`}>{tone.label}</p>
          <p className="mt-2 text-xs leading-5 text-slate-600" style={{ maxHeight: '4.5rem', overflow: 'hidden' }}>
            {displayReasoning}
          </p>
        </div>
      </div>
    </div>
  );
}