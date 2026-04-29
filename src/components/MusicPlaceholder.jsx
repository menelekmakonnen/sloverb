import { useState, useEffect } from 'react';

/* ── Inject keyframes once globally ── */
let keyframesInjected = false;
function injectKeyframes() {
  if (keyframesInjected) return;
  keyframesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes placeholder-pulse {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.08); opacity: 0.2; }
    }
    @keyframes placeholder-burst {
      0% { opacity: 1; transform: scale(0.5); }
      100% { opacity: 0; transform: scale(1.5); }
    }
  `;
  document.head.appendChild(style);
}

/**
 * SVG placeholder for tracks/artists without album art.
 * STATIC by default — only animates on hover (pulse) and click (burst).
 * Each instance gets a unique color based on the seed string.
 */
export default function MusicPlaceholder({ seed = '', size = 40, style = {}, type = 'track' }) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  // Inject keyframes once on first mount
  useEffect(() => { injectKeyframes(); }, []);

  // Deterministic hue from seed
  const hash = (seed || 'x').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const h1 = hash % 360;
  const h2 = (h1 + 45) % 360;

  // Click burst — resets after animation
  useEffect(() => {
    if (clicked) {
      const t = setTimeout(() => setClicked(false), 600);
      return () => clearTimeout(t);
    }
  }, [clicked]);

  const burstScale = clicked ? 1.08 : 1;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); setClicked(true); }}
      style={{
        width: size, height: size, borderRadius: type === 'artist' ? '50%' : Math.min(size * 0.18, 14),
        overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        transform: `scale(${burstScale})`,
        boxShadow: hovered ? `0 4px 16px hsla(${h1}, 60%, 50%, 0.35)` : `0 2px 6px rgba(0,0,0,0.25)`,
        background: `linear-gradient(135deg, hsl(${h1}, 65%, 50%), hsl(${h2}, 55%, 35%))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        ...style,
      }}
    >
      {/* Center icon — pure CSS, no SVG animations */}
      <div style={{
        transition: 'transform 0.2s ease',
        transform: hovered ? 'scale(1.15)' : 'scale(1)',
      }}>
        {type === 'artist' ? (
          <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="5" fill="rgba(255,255,255,0.35)" />
            <ellipse cx="12" cy="20" rx="8" ry="5" fill="rgba(255,255,255,0.25)" />
          </svg>
        ) : (
          <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24" fill="none">
            <path d="M9 18V5l12-3v13" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="18" r="3" fill="rgba(255,255,255,0.35)" />
            <circle cx="21" cy="15" r="3" fill="rgba(255,255,255,0.3)" />
          </svg>
        )}
      </div>

      {/* Hover ring effect — CSS only, no SVG animate */}
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: 'inherit',
          border: `2px solid hsla(${h1}, 50%, 70%, 0.3)`,
          animation: 'placeholder-pulse 1.5s ease-in-out infinite',
        }} />
      )}

      {/* Click burst — simple CSS radial flash */}
      {clicked && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit',
          background: `radial-gradient(circle, hsla(${h1}, 70%, 65%, 0.5) 0%, transparent 70%)`,
          animation: 'placeholder-burst 0.5s ease-out forwards',
        }} />
      )}
    </div>
  );
}
