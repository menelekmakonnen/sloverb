/**
 * Custom animated SVG navigation icons for Sloverb.
 * Each icon is unique, reacts to: inactive, hover, click, active states.
 * Pure CSS animations — zero JS animation loops at rest.
 */

const iconStyle = `
  .nav-icon { transition: transform 0.2s ease, filter 0.2s ease; }
  .nav-icon:hover { transform: scale(1.1); }
  .nav-icon.active .icon-fill { fill: var(--accent); }
  .nav-icon.active .icon-stroke { stroke: var(--accent); }
  .nav-icon .icon-fill { fill: currentColor; transition: fill 0.2s ease; }
  .nav-icon .icon-stroke { stroke: currentColor; fill: none; transition: stroke 0.2s ease; }
  .nav-icon .icon-accent { transition: opacity 0.2s ease; opacity: 0; }
  .nav-icon:hover .icon-accent, .nav-icon.active .icon-accent { opacity: 1; }
  .nav-icon .icon-pulse { transform-origin: center; }
  .nav-icon:hover .icon-pulse { animation: icon-pulse 0.6s ease; }
  .nav-icon.clicked .icon-pulse { animation: icon-pop 0.3s ease; }
  @keyframes icon-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
  @keyframes icon-pop { 0%{transform:scale(1)} 50%{transform:scale(0.85)} 100%{transform:scale(1)} }
`;

// Inject styles once
let injected = false;
function ensureStyles() {
  if (injected) return;
  const s = document.createElement('style');
  s.textContent = iconStyle;
  document.head.appendChild(s);
  injected = true;
}

function Wrap({ size = 18, active, onClick, children }) {
  ensureStyles();
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      className={`nav-icon${active ? ' active' : ''}`}
      onClick={e => {
        e.currentTarget.classList.add('clicked');
        setTimeout(() => e.currentTarget.classList.remove('clicked'), 300);
        onClick?.(e);
      }}
    >
      {children}
    </svg>
  );
}

// ─── HOME: Sound wave house ───
export function HomeIcon({ size, active }) {
  return (
    <Wrap size={size} active={active}>
      <path className="icon-stroke" d="M3 12L12 3l9 9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path className="icon-stroke" d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9" strokeWidth="1.8" />
      <g className="icon-pulse">
        <rect className="icon-accent" x="10" y="14" width="1.5" height="3" rx="0.5" fill="var(--accent)" />
        <rect className="icon-accent" x="12.5" y="13" width="1.5" height="5" rx="0.5" fill="var(--accent)" opacity="0.7" />
      </g>
    </Wrap>
  );
}

// ─── STUDIO: Vinyl disc with needle ───
export function StudioIcon({ size, active }) {
  return (
    <Wrap size={size} active={active}>
      <circle className="icon-stroke" cx="12" cy="12" r="9" strokeWidth="1.5" />
      <circle className="icon-stroke" cx="12" cy="12" r="3" strokeWidth="1.5" />
      <circle className="icon-fill icon-pulse" cx="12" cy="12" r="1.2" />
      <path className="icon-accent" d="M18 4l2 2-5 5" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </Wrap>
  );
}

// ─── LIBRARY: Stacked records ───
export function LibraryIcon({ size, active }) {
  return (
    <Wrap size={size} active={active}>
      <rect className="icon-stroke" x="4" y="6" width="16" height="12" rx="2" strokeWidth="1.5" />
      <path className="icon-stroke" d="M7 6V4.5a1.5 1.5 0 011.5-1.5h7A1.5 1.5 0 0117 4.5V6" strokeWidth="1.2" />
      <g className="icon-pulse">
        <line className="icon-stroke" x1="8" y1="10" x2="16" y2="10" strokeWidth="1.2" strokeLinecap="round" />
        <line className="icon-stroke" x1="8" y1="13" x2="13" y2="13" strokeWidth="1.2" strokeLinecap="round" />
        <circle className="icon-accent" cx="15.5" cy="13" r="1" fill="var(--accent)" />
      </g>
    </Wrap>
  );
}

// ─── PLAYLISTS: Stacked lines with play button ───
export function PlaylistIcon({ size, active }) {
  return (
    <Wrap size={size} active={active}>
      <line className="icon-stroke" x1="4" y1="6" x2="16" y2="6" strokeWidth="1.5" strokeLinecap="round" />
      <line className="icon-stroke" x1="4" y1="10" x2="14" y2="10" strokeWidth="1.5" strokeLinecap="round" />
      <line className="icon-stroke" x1="4" y1="14" x2="12" y2="14" strokeWidth="1.5" strokeLinecap="round" />
      <line className="icon-stroke" x1="4" y1="18" x2="10" y2="18" strokeWidth="1.5" strokeLinecap="round" />
      <path className="icon-fill icon-pulse" d="M16 13l5 3.5-5 3.5z" />
      <circle className="icon-accent" cx="18.5" cy="16.5" r="5" fill="var(--accent)" opacity="0.1" />
    </Wrap>
  );
}

// ─── ARTISTS: Headphones ───
export function ArtistsIcon({ size, active }) {
  return (
    <Wrap size={size} active={active}>
      <path className="icon-stroke" d="M3 18v-6a9 9 0 0118 0v6" strokeWidth="1.5" strokeLinecap="round" />
      <g className="icon-pulse">
        <rect className="icon-stroke" x="3" y="15" width="3" height="5" rx="1.5" strokeWidth="1.3" />
        <rect className="icon-stroke" x="18" y="15" width="3" height="5" rx="1.5" strokeWidth="1.3" />
      </g>
      <circle className="icon-accent" cx="12" cy="8" r="1.5" fill="var(--accent)" />
    </Wrap>
  );
}

// ─── ALBUMS: CD case ───
export function AlbumsIcon({ size, active }) {
  return (
    <Wrap size={size} active={active}>
      <rect className="icon-stroke" x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
      <circle className="icon-stroke icon-pulse" cx="12" cy="12" r="4.5" strokeWidth="1.3" />
      <circle className="icon-fill" cx="12" cy="12" r="1.5" />
      <path className="icon-accent" d="M3 8h18" stroke="var(--accent)" strokeWidth="0.5" opacity="0.5" />
    </Wrap>
  );
}

// ─── FOLDERS: Open folder ───
export function FoldersIcon({ size, active }) {
  return (
    <Wrap size={size} active={active}>
      <path className="icon-stroke" d="M2 7V5a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" strokeWidth="1.5" />
      <g className="icon-pulse">
        <path className="icon-accent" d="M5 12h14" stroke="var(--accent)" strokeWidth="0.8" strokeLinecap="round" />
        <circle className="icon-accent" cx="12" cy="14" r="1" fill="var(--accent)" />
      </g>
    </Wrap>
  );
}

// ─── HISTORY: Clock with rewind ───
export function HistoryIcon({ size, active }) {
  return (
    <Wrap size={size} active={active}>
      <circle className="icon-stroke" cx="12" cy="12" r="9" strokeWidth="1.5" />
      <g className="icon-pulse">
        <path className="icon-stroke" d="M12 7v5l3 3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path className="icon-accent" d="M5 4l-2 3h4" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </Wrap>
  );
}

// ─── SETTINGS: Gear ───
export function SettingsIcon({ size, active }) {
  return (
    <Wrap size={size} active={active}>
      <circle className="icon-stroke icon-pulse" cx="12" cy="12" r="3" strokeWidth="1.5" />
      <path className="icon-stroke"
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        strokeWidth="1.3" />
    </Wrap>
  );
}

// ─── STREAM: Broadcast tower with signal waves ───
export function StreamIcon({ size, active }) {
  return (
    <Wrap size={size} active={active}>
      {/* Antenna tower */}
      <path className="icon-stroke" d="M12 20V10" strokeWidth="1.8" strokeLinecap="round" />
      <path className="icon-stroke" d="M8 20h8" strokeWidth="1.5" strokeLinecap="round" />
      <path className="icon-stroke" d="M9.5 20L12 12l2.5 8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Signal waves */}
      <g className="icon-pulse">
        <path className="icon-stroke" d="M8.5 7.5A5 5 0 0112 6a5 5 0 013.5 1.5" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        <path className="icon-accent" d="M6 5a8 8 0 016-2 8 8 0 016 2" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      </g>
      {/* Antenna dot */}
      <circle className="icon-fill icon-pulse" cx="12" cy="9" r="1.5" />
    </Wrap>
  );
}
