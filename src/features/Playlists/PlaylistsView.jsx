import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { playbackEngine } from '../../lib/playbackEngine';
import { ListMusic, Plus, Play, Trash2, Music, GripVertical, ArrowLeft, MoreHorizontal, Pencil } from 'lucide-react';

export default function PlaylistsView() {
  const { playlists, songs, addPlaylist, removePlaylist, removeFromPlaylist, saveToDisk } = useLibraryStore();
  const { addToast } = useUIStore();
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef(null);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    addPlaylist({ id: `pl_${Date.now()}`, name, itemIds: [], createdAt: Date.now() });
    setNewName('');
    setShowCreate(false);
    saveToDisk();
    addToast(`Created playlist: ${name}`, 'success');
  };

  const handleDelete = (e, pl) => {
    e.stopPropagation();
    removePlaylist(pl.id);
    saveToDisk();
    if (selectedPlaylist?.id === pl.id) setSelectedPlaylist(null);
    addToast(`Deleted: ${pl.name}`, 'info');
  };

  const handlePlayAll = (pl) => {
    const items = pl.itemIds
      .map(id => songs.find(s => s.id === id))
      .filter(Boolean);
    if (items.length === 0) return addToast('Playlist is empty', 'info');

    const store = usePlayerStore.getState();
    const first = items[0];
    const rest = items.slice(1).map(s => ({ type: 'library', name: s.name, path: s.path, id: s.id }));
    store.setQueue(rest);
    store.setPlaybackContext({ type: 'playlist', playlistId: pl.id });

    if (window.electronAPI) {
      window.electronAPI.readFile(first.path || first.id).then(buf => {
        const isVid = first.name?.endsWith('.mp4') || first.type === 'video';
        const f = new File([buf], first.name, { type: isVid ? 'video/mp4' : 'audio/wav' });
        f.path = first.path || first.id;
        playbackEngine.loadFileAndPlay(f, first);
      }).catch(() => addToast('Failed to load track', 'error'));
    }
  };

  const handleRemoveTrack = (plId, idx) => {
    removeFromPlaylist(plId, idx);
    saveToDisk();
  };

  const handlePlayTrack = async (song) => {
    if (!window.electronAPI) return;
    try {
      const buf = await window.electronAPI.readFile(song.path || song.id);
      const isVid = song.name?.endsWith('.mp4') || song.type === 'video';
      const f = new File([buf], song.name, { type: isVid ? 'video/mp4' : 'audio/wav' });
      f.path = song.path || song.id;
      playbackEngine.loadFileAndPlay(f, song);
    } catch { addToast('Failed to load track', 'error'); }
  };

  // ── Detail View ──
  if (selectedPlaylist) {
    const pl = playlists.find(p => p.id === selectedPlaylist.id) || selectedPlaylist;
    const tracks = pl.itemIds.map(id => songs.find(s => s.id === id)).filter(Boolean);

    return (
      <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px' }}>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ maxWidth: 800, margin: '0 auto' }}>
          {/* Back Button */}
          <button onClick={() => setSelectedPlaylist(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)', fontSize: 12, marginBottom: 20, padding: '6px 0' }}>
            <ArrowLeft size={14} /> All Playlists
          </button>

          {/* Playlist Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
            <div style={{
              width: 100, height: 100, borderRadius: 14,
              background: `linear-gradient(135deg, hsl(${(pl.name.charCodeAt(0) * 13) % 360}, 65%, 50%), hsl(${(pl.name.charCodeAt(0) * 13 + 45) % 360}, 55%, 35%))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)', flexShrink: 0,
            }}>
              <ListMusic size={36} color="rgba(255,255,255,0.5)" />
            </div>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)', letterSpacing: '-0.02em' }}>{pl.name}</h2>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 12px' }}>{tracks.length} tracks</p>
              <button onClick={() => handlePlayAll(pl)} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: 12, borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Play size={14} /> Play All
              </button>
            </div>
          </div>

          {/* Track List */}
          {tracks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
              <Music size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px', color: 'var(--text)' }}>No tracks yet</p>
              <p style={{ fontSize: 12, margin: 0 }}>Right-click songs in your Library to add them here</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {tracks.map((song, i) => {
                const hash = (song.id || '').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                return (
                  <div key={`${song.id}-${i}`} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8,
                    transition: 'background 0.15s', cursor: 'pointer',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onDoubleClick={() => handlePlayTrack(song)}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 24, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                    <div style={{
                      width: 36, height: 36, borderRadius: 6, flexShrink: 0,
                      background: `linear-gradient(135deg, hsl(${hash % 360}, 65%, 55%), hsl(${(hash + 40) % 360}, 60%, 35%))`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Music size={14} color="#fff" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>{song.artist || 'Unknown Artist'}</p>
                    </div>
                    <button onClick={() => handleRemoveTrack(pl.id, i)} style={{ color: 'var(--text-dim)', padding: 4, opacity: 0.6, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Grid View ──
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px' }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Playlists</h2>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>{playlists.length} collections</p>
          </div>
          <button onClick={() => { setShowCreate(true); setTimeout(() => inputRef.current?.focus(), 100); }} className="btn btn-accent-soft" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> New Playlist
          </button>
        </div>

        {/* Create Inline */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              style={{ marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Playlist name..."
                  className="input" style={{ flex: 1 }} />
                <button onClick={handleCreate} className="btn btn-primary" style={{ padding: '8px 16px' }}>Create</button>
                <button onClick={() => { setShowCreate(false); setNewName(''); }} className="btn btn-ghost" style={{ padding: '8px 12px' }}>Cancel</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Playlist Grid */}
        {playlists.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <ListMusic size={56} color="var(--text-dim)" style={{ marginBottom: 20, opacity: 0.4 }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>No Playlists Yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 24px' }}>Create a playlist and add songs from your Library.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {playlists.map(pl => {
              const h1 = (pl.name.charCodeAt(0) * 13) % 360;
              const h2 = (h1 + 45) % 360;
              const trackCount = pl.itemIds?.length || 0;
              return (
                <motion.div key={pl.id} whileHover={{ y: -4, scale: 1.02 }} transition={{ type: 'spring', damping: 20 }}
                  onClick={() => setSelectedPlaylist(pl)}
                  style={{
                    background: 'var(--bg-surface)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                    border: '1px solid var(--glass-border)', transition: 'box-shadow 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{
                    height: 130, background: `linear-gradient(135deg, hsl(${h1}, 65%, 50%), hsl(${h2}, 55%, 35%))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                  }}>
                    <ListMusic size={40} color="rgba(255,255,255,0.3)" />
                    <button onClick={(e) => handleDelete(e, pl)} style={{
                      position: 'absolute', top: 8, right: 8, padding: 4, borderRadius: 6,
                      background: 'rgba(0,0,0,0.3)', color: '#fff', opacity: 0.6, transition: 'opacity 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>{trackCount} track{trackCount !== 1 ? 's' : ''}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
