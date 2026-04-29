import { Play, User, Clock, ListPlus } from 'lucide-react';
import { motion } from 'framer-motion';

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrackRow({ item, onPlay, onQueue, index, onContextMenu, isActive }) {
  return (
    <motion.div
      whileHover={{ x: isActive ? 0 : 2 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
        borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s',
        background: isActive ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
        border: isActive ? '1px solid rgba(236, 72, 153, 0.2)' : '1px solid transparent',
      }}
      onMouseEnter={e => !isActive && (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}
      onDoubleClick={() => onPlay(item)}
      onContextMenu={onContextMenu}
    >
      {index !== undefined && (
        <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 20, textAlign: 'right', flexShrink: 0 }}>{index + 1}</span>
      )}
      <div style={{ width: 56, height: 42, borderRadius: 6, flexShrink: 0, background: 'var(--bg-surface)', overflow: 'hidden', position: 'relative' }}>
        <img
          src={item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { e.target.src = `https://i.ytimg.com/vi/${item.id}/default.jpg`; e.target.onerror = null; }}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <User size={9} /> {item.channel}
          {item.duration > 0 && <><span style={{ opacity: 0.5 }}>·</span><Clock size={9} /> {formatDuration(item.duration)}</>}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          onClick={e => { e.stopPropagation(); onPlay(item); }}
          className="btn btn-primary"
          style={{ padding: '5px 12px', fontSize: 10, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Play size={10} /> Stream
        </button>
        {onQueue && (
          <button
            onClick={e => { e.stopPropagation(); onQueue(item); }}
            className="btn btn-ghost"
            style={{ padding: '5px 8px', borderRadius: 16 }}
            title="Add to queue"
          >
            <ListPlus size={12} />
          </button>
        )}
      </div>
    </motion.div>
  );
}
