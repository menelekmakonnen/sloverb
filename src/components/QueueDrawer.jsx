import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../stores/uiStore';
import { usePlayerStore } from '../stores/playerStore';
import { playbackEngine } from '../lib/playbackEngine';
import { X, Play, Trash2, GripVertical, ListMusic } from 'lucide-react';
import { useState } from 'react';

export default function QueueDrawer() {
  const { queueDrawerOpen, toggleQueueDrawer } = useUIStore();
  const { queue, currentTrack, fileName, removeFromQueue } = usePlayerStore();
  const [draggedIdx, setDraggedIdx] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const store = usePlayerStore.getState();
    const newQ = [...store.queue];
    const item = newQ.splice(draggedIdx, 1)[0];
    newQ.splice(index, 0, item);
    setDraggedIdx(index);
    store.setQueue(newQ);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  return (
    <AnimatePresence>
      {queueDrawerOpen && (
        <motion.div
          initial={{ x: 350, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 350, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 'var(--nowplaying-height)',
            width: 350, background: 'var(--bg-elevated)', borderLeft: '1px solid var(--glass-border)',
            display: 'flex', flexDirection: 'column', zIndex: 40,
            boxShadow: '-8px 0 32px rgba(0,0,0,0.5)'
          }}
        >
          {/* Header */}
          <div style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ListMusic size={18} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Play Queue</h3>
            </div>
            <button onClick={toggleQueueDrawer} style={{ color: 'var(--text-dim)', padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {/* Now Playing */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 12 }}>Now Playing</div>
              <div style={{ padding: '12px', background: 'var(--accent-muted)', borderRadius: 10, border: '1px solid var(--accent-secondary)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fileName || 'No track loaded'}
                </div>
                {currentTrack?.artist && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{currentTrack.artist}</div>}
              </div>
            </div>

            {/* Up Next */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Up Next</div>
                {queue.length > 0 && (
                  <button onClick={() => usePlayerStore.getState().clearQueue()} style={{ fontSize: 11, color: 'var(--text-dim)' }}>Clear</button>
                )}
              </div>

              {queue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)' }}>
                  <p style={{ fontSize: 13, margin: 0 }}>Queue is empty</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {queue.map((item, i) => (
                    <div
                      key={`${item.name}-${i}`}
                      draggable
                      onDragStart={e => handleDragStart(e, i)}
                      onDragOver={e => handleDragOver(e, i)}
                      onDragEnd={handleDragEnd}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                        background: draggedIdx === i ? 'var(--bg-hover)' : 'var(--bg-surface)',
                        borderRadius: 8, cursor: 'grab', border: '1px solid var(--glass-border)',
                        opacity: draggedIdx === i ? 0.5 : 1
                      }}
                    >
                      <GripVertical size={14} color="var(--text-dim)" style={{ cursor: 'grab' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{item.type === 'youtube' ? 'YouTube' : 'Local File'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => {
                           const st = usePlayerStore.getState();
                           const qItem = st.queue[i];
                           st.removeFromQueue(i);
                           // To play this, we just re-insert it at 0 and call playNext
                           st.setQueue([qItem, ...st.queue.filter((_, idx) => idx !== i)]);
                           playbackEngine.playNext();
                        }} style={{ color: 'var(--accent)', padding: 4 }}><Play size={14} /></button>
                        <button onClick={() => removeFromQueue(i)} style={{ color: 'var(--text-dim)', padding: 4 }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
