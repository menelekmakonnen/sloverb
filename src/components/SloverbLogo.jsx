import { useState } from 'react';

/**
 * Sloverb Logo — Complex animated SVG site icon.
 * A sound wave morphing into a vinyl disc orbit.
 * Reacts to hover (glow pulse) and click (burst spin).
 * Lightweight CSS-only animations, no requestAnimationFrame.
 */
export default function SloverbLogo({ size = 36 }) {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    setTimeout(() => setClicked(false), 600);
  };

  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48"
      className={`sloverb-logo${clicked ? ' logo-clicked' : ''}`}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent, #8b5cf6)" />
          <stop offset="100%" stopColor="var(--accent-secondary, #6366f1)" />
        </linearGradient>
        <radialGradient id="logo-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent, #8b5cf6)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Background disc */}
      <circle cx="24" cy="24" r="22" fill="url(#logo-grad)" className="logo-disc" />

      {/* Inner rings */}
      <circle cx="24" cy="24" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6" />
      <circle cx="24" cy="24" r="10" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

      {/* Vinyl center dot */}
      <circle cx="24" cy="24" r="4" fill="rgba(0,0,0,0.4)" />
      <circle cx="24" cy="24" r="1.5" fill="rgba(255,255,255,0.3)" />

      {/* Sound wave arcs */}
      <g className="logo-waves" fill="none" stroke="rgba(255,255,255,0.5)" strokeLinecap="round">
        <path d="M15 18c2-3 4-4 6-4s4 2 6 4" strokeWidth="1.3" />
        <path d="M13 22c3-5 6-7 11-7s8 3 11 7" strokeWidth="1" opacity="0.6" />
        <path d="M17 28c1.5 2 3.5 3 7 3s5.5-1 7-3" strokeWidth="1.3" />
        <path d="M14 31c2.5 3 5 5 10 5s7.5-2 10-5" strokeWidth="1" opacity="0.6" />
      </g>

      {/* S letter hint */}
      <path d="M19 16c0 0 3-2 5-2s4 1.5 4 3.5-2 3-4 3.5-4 1.5-4 3.5 2 3.5 5 3.5 5-2 5-2"
        fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" className="logo-s" />

      {/* Hover glow ring */}
      <circle cx="24" cy="24" r="23" fill="none" stroke="url(#logo-glow)" strokeWidth="2" className="logo-hover-ring" />

      <style>{`
        .sloverb-logo .logo-disc { transition: filter 0.3s ease; }
        .sloverb-logo:hover .logo-disc { filter: brightness(1.15) drop-shadow(0 0 8px var(--accent-glow, rgba(139,92,246,0.4))); }
        .sloverb-logo .logo-hover-ring { opacity: 0; transition: opacity 0.3s ease; }
        .sloverb-logo:hover .logo-hover-ring { opacity: 1; }
        .sloverb-logo .logo-waves { transition: transform 0.3s ease; }
        .sloverb-logo:hover .logo-waves { transform: translateY(-0.5px); }
        .sloverb-logo.logo-clicked .logo-disc { animation: logo-spin 0.6s ease; }
        .sloverb-logo .logo-s { transition: stroke 0.2s ease; }
        .sloverb-logo:hover .logo-s { stroke: rgba(255,255,255,0.5); }
        @keyframes logo-spin {
          0% { transform: rotate(0deg); transform-origin: 24px 24px; }
          100% { transform: rotate(360deg); transform-origin: 24px 24px; }
        }
      `}</style>
    </svg>
  );
}
