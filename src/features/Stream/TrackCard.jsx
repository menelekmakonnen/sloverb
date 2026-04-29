import { Play, ListPlus, Clock, User } from 'lucide-react';
import { motion } from 'framer-motion';

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrackCard({ item, onPlay, onQueue, onContextMenu, isActive }) {
  return (
    <motion.div
      whileHover={{ y: isActive ? 0 : -3, scale: isActive ? 1 : 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        background: isActive ? 'var(--bg-hover)' : 'var(--bg-surface)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        border: isActive ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: isActive ? '0 0 12px rgba(236,72,153,0.2)' : 'none',
      }}
      onMouseEnter={e => {
        if (isActive) return;
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={e => {
        if (isActive) return;
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      onDoubleClick={() => onPlay(item)}
      onContextMenu={onContextMenu}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', paddingTop: '56.25%', background: 'var(--bg-elevated)' }}>
        <img
          src={item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { e.target.src = `https://i.ytimg.com/vi/${item.id}/default.jpg`; e.target.onerror = null; }}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
        {/* Duration badge */}
        {item.duration > 0 && (
          <span style={{
            position: 'absolute', bottom: 6, right: 6,
            background: 'rgba(0,0,0,0.8)', color: '#fff',
            fontSize: 10, fontWeight: 600, padding: '2px 6px',
            borderRadius: 4, fontVariantNumeric: 'tabular-nums',
          }}>{formatDuration(item.duration)}</span>
        )}
        {/* Play overlay */}
        <div
          className="track-card-overlay"
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0'}
        >
          <button
            onClick={e => { e.stopPropagation(); onPlay(item); }}
            className="btn btn-primary"
            style={{
              width: 44, height: 44, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <Play size={18} style={{ marginLeft: 2 }} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px' }}>
        <p style={{
          margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.4,
        }}>{item.title}</p>
        <p style={{
          margin: '4px 0 0', fontSize: 10, color: 'var(--text-dim)',
          display: 'flex', alignItems: 'center', gap: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <User size={9} /> {item.channel}
        </p>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); onPlay(item); }}
            className="btn btn-primary"
            style={{ flex: 1, padding: '5px 0', fontSize: 10, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Play size={10} /> Stream
          </button>
          {onQueue && (
            <button
              onClick={e => { e.stopPropagation(); onQueue(item); }}
              className="btn btn-ghost"
              style={{ padding: '5px 8px', borderRadius: 8 }}
              title="Add to queue"
            >
              <ListPlus size={12} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
