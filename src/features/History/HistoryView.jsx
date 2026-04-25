import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLibraryStore } from '../../stores/libraryStore';
import { useUIStore } from '../../stores/uiStore';
import { playbackEngine } from '../../lib/playbackEngine';
import { History as HistoryIcon, Play, Trash2, Music, Clock, Calendar } from 'lucide-react';
import ArtThumb from '../../components/ArtThumb';

export default function HistoryView() {
  const { playHistory, clearPlayHistory } = useLibraryStore();
  const { addToast } = useUIStore();
  const [filter, setFilter] = useState('all');

  const now = Date.now();
  const DAY = 86400000;

  const filtered = playHistory.filter(item => {
    if (filter === 'today') return (now - item.playedAt) < DAY;
    if (filter === 'week') return (now - item.playedAt) < DAY * 7;
    return true;
  });

  const handlePlay = async (item) => {
    if (!window.electronAPI || !item.path) return;
    try {
      const buf = await window.electronAPI.readFile(item.path);
      const f = new File([buf], item.name || 'track', { type: 'audio/wav' });
      f.path = item.path;
      playbackEngine.loadFileAndPlay(f, { name: item.name, path: item.path, artist: item.artist, album: item.album });
    } catch {
      addToast('Failed to load track', 'error');
    }
  };

  const formatDate = (ms) => {
    const d = new Date(ms);
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < DAY) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < DAY * 2) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  // Group by date
  const groups = {};
  filtered.forEach(item => {
    const d = new Date(item.playedAt);
    const key = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  // Stats for recap
  const topArtists = {};
  const topSongs = {};
  playHistory.forEach(h => {
    if (h.artist) topArtists[h.artist] = (topArtists[h.artist] || 0) + 1;
    if (h.name) topSongs[h.name] = (topSongs[h.name] || 0) + 1;
  });
  const sortedArtists = Object.entries(topArtists).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const sortedSongs = Object.entries(topSongs).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px' }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Listening History</h2>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>{filtered.length} plays · {playHistory.length} total</p>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'week', label: 'This Week' },
              { id: 'today', label: 'Today' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                  background: filter === f.id ? 'var(--accent-muted)' : 'transparent',
                  color: filter === f.id ? 'var(--accent)' : 'var(--text-dim)',
                  border: `1px solid ${filter === f.id ? 'var(--accent-secondary)' : 'var(--glass-border)'}`,
                  transition: 'all 0.15s', cursor: 'pointer',
                }}
              >{f.label}</button>
            ))}
            {playHistory.length > 0 && (
              <button onClick={() => { clearPlayHistory(); addToast('History cleared', 'info'); }}
                style={{ padding: '6px 10px', borderRadius: 20, fontSize: 11, color: 'var(--text-dim)', background: 'transparent', border: '1px solid var(--glass-border)', cursor: 'pointer' }}
              ><Trash2 size={11} /></button>
            )}
          </div>
        </div>

        {/* Mini Stats */}
        {playHistory.length > 3 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160, padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Top Artists</div>
              {sortedArtists.map(([name, count], i) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: i === 0 ? 'var(--accent)' : 'var(--text)', padding: '2px 0', fontWeight: i === 0 ? 600 : 400 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  <span style={{ color: 'var(--text-dim)', flexShrink: 0, marginLeft: 8 }}>{count} plays</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 160, padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Most Played</div>
              {sortedSongs.map(([name, count], i) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: i === 0 ? 'var(--accent)' : 'var(--text)', padding: '2px 0', fontWeight: i === 0 ? 600 : 400 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{name}</span>
                  <span style={{ color: 'var(--text-dim)', flexShrink: 0, marginLeft: 8 }}>{count}×</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <HistoryIcon size={56} color="var(--text-dim)" style={{ marginBottom: 20, opacity: 0.4 }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>No Plays Yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
              {filter !== 'all' ? 'No plays found for this period.' : 'Play a track and it will appear here.'}
            </p>
          </div>
        ) : (
          Object.entries(groups).map(([date, items]) => (
            <div key={date} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Calendar size={12} color="var(--text-dim)" />
                <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{date}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {items.map((item, i) => (
                  <div key={`${item.playedAt}-${i}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderRadius: 10,
                      transition: 'background 0.15s', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; const b = e.currentTarget.querySelector('.h-btns'); if (b) b.style.opacity = '1'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; const b = e.currentTarget.querySelector('.h-btns'); if (b) b.style.opacity = '0'; }}
                    onDoubleClick={() => handlePlay(item)}
                  >
                    <ArtThumb path={item.path} seed={item.name} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                        {item.artist && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{item.artist}</span>}
                        <Clock size={9} color="var(--text-dim)" />
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{formatDate(item.playedAt)}</span>
                      </div>
                    </div>
                    <div className="h-btns" style={{ display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
                      <button onClick={(e) => { e.stopPropagation(); handlePlay(item); }} className="btn btn-accent-soft" style={{ padding: '3px 10px', fontSize: 10, borderRadius: 16 }}>
                        <Play size={10} /> Play
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </motion.div>
    </div>
  );
}
