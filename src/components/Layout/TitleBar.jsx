import { motion } from 'framer-motion';
import { useUIStore } from '../../stores/uiStore';
import { Minus, Square, X } from 'lucide-react';

export default function TitleBar() {
  const { mode } = useUIStore();

  const handleControl = (action) => {
    if (window.electronAPI?.windowControl) {
      window.electronAPI.windowControl(action);
    }
  };

  return (
    <div className="drag" style={{
      height: 'var(--titlebar-height)',
      background: mode === 'dark' ? 'rgba(6,6,14,0.85)' : 'rgba(248,249,252,0.9)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--glass-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      zIndex: 100,
      position: 'relative',
    }}>
      {/* Left — Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 20, height: 20,
          borderRadius: 6,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-secondary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px var(--accent-glow)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>S</span>
        </div>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-dim)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          Sloverb Studio
        </span>
      </div>

      {/* Right — Window Controls */}
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {[
          { icon: <Minus size={13} />, action: 'minimize', hoverBg: 'rgba(255,255,255,0.08)' },
          { icon: <Square size={10} />, action: 'maximize', hoverBg: 'rgba(255,255,255,0.08)' },
          { icon: <X size={13} />, action: 'close', hoverBg: 'rgba(239,68,68,0.2)' },
        ].map(({ icon, action, hoverBg }) => (
          <button
            key={action}
            onClick={() => handleControl(action)}
            style={{
              width: 28, height: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 4,
              color: 'var(--text-dim)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = hoverBg;
              e.currentTarget.style.color = action === 'close' ? '#ef4444' : 'var(--text)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-dim)';
            }}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}
